// NF-e (modelo 55) recebidas pela Distribuição de DF-e da SEFAZ (Ambiente
// Nacional, NT 2014.002) com o certificado da própria empresa.
//
// - nfeDistDFeInteresse (distNSU): devolve, em ordem de NSU, resumos (resNFe),
//   notas completas (procNFe) e eventos (resEvento/procEventoNFe) em que o CNPJ
//   é destinatário, transportador ou autorizado (autXML). O emitente não recebe
//   as próprias notas por aqui, só os eventos delas.
// - O XML completo de uma nota recebida só é liberado depois da manifestação
//   do destinatário; registramos a "Ciência da Operação" (210210), que não é
//   conclusiva, e a nota completa chega numa distribuição seguinte.
// - Regras de uso: quando não há documentos novos (cStat 137) ou o NSU chegou
//   ao máximo, a próxima consulta só pode ser feita depois de 1 hora; consultas
//   em excesso geram cStat 656 (consumo indevido).
const https = require('node:https');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const forge = require('node-forge');
const { XMLParser } = require('fast-xml-parser');
const prisma = require('../lib/prisma');
const certCrypto = require('../utils/certCrypto');
const fileStorage = require('./fileStorage.service');
const { assertPermanentStorage } = require('./nfseAdn.service');

const DIST_URL = process.env.NFE_DIST_URL || 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const EVENTO_URL = process.env.NFE_EVENTO_URL || 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx';
const TP_AMB = process.env.NFE_TP_AMB || '1';
const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';
const UMA_HORA = 60 * 60 * 1000;
const MAX_CONSULTAS = 30;
const PAUSA_MS = 2000;

const UF_CODIGO = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17', MA: '21', PI: '22', CE: '23', RN: '24', PB: '25',
  PE: '26', AL: '27', SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41', SC: '42', RS: '43', MS: '50',
  MT: '51', GO: '52', DF: '53',
};

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true });

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
const root = (value) => onlyDigits(value).slice(0, 8);
const escapeXml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findKey(node, key) {
  if (!node || typeof node !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
  for (const value of Object.values(node)) {
    const found = findKey(value, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00-03:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------- SOAP ----------

function soapEnvelope(body) {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
    + `<soap12:Body>${body}</soap12:Body></soap12:Envelope>`;
}

function postSoap(url, action, xml, { pfx, passphrase }) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(xml, 'utf8');
    const req = https.request(url, {
      method: 'POST',
      pfx,
      passphrase,
      timeout: 60000,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"`,
        'Content-Length': payload.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('A SEFAZ não respondeu em 60 segundos.')));
    req.on('error', (error) => {
      if (/mac verify|bad decrypt|PKCS12/i.test(error.message)) reject(new Error('Não foi possível abrir o certificado da empresa. Envie o .pfx novamente com a senha correta.'));
      else reject(error);
    });
    req.end(payload);
  });
}

// ---------- Distribuição ----------

function distRequestXml({ cUFAutor, cnpj, ultNsu }) {
  const dist = `<distDFeInt xmlns="${NS_NFE}" versao="1.01"><tpAmb>${TP_AMB}</tpAmb><cUFAutor>${cUFAutor}</cUFAutor>`
    + `<CNPJ>${cnpj}</CNPJ><distNSU><ultNSU>${String(ultNsu).padStart(15, '0')}</ultNSU></distNSU></distDFeInt>`;
  return soapEnvelope(`<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${dist}</nfeDadosMsg></nfeDistDFeInteresse>`);
}

function decodeDocZip(encoded) {
  const raw = Buffer.from(String(encoded || ''), 'base64');
  return (raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw).toString('utf8').replace(/^﻿/, '');
}

function parseDistResponse(text) {
  const tree = parser.parse(text);
  const ret = findKey(tree, 'retDistDFeInt');
  if (!ret) {
    const fault = findKey(tree, 'Text') || findKey(tree, 'faultstring');
    throw new Error(`Resposta inesperada da SEFAZ na distribuição${fault ? `: ${typeof fault === 'object' ? JSON.stringify(fault) : fault}` : ''}.`);
  }
  // Os documentos são lidos direto do texto: cada docZip tem NSU, schema e o
  // conteúdo em base64 (gzip). Não depende de como o parser monta a árvore.
  const docs = [];
  for (const match of String(text).matchAll(/<(?:[\w-]+:)?docZip\b([^>]*)>([^<]*)<\/(?:[\w-]+:)?docZip>/g)) {
    const attrs = match[1];
    docs.push({
      nsu: BigInt(onlyDigits((attrs.match(/NSU="([^"]*)"/) || [])[1]) || '0'),
      schema: String((attrs.match(/schema="([^"]*)"/) || [])[1] || ''),
      xml: decodeDocZip(match[2].trim()),
    });
  }
  return {
    cStat: String(ret.cStat || ''),
    xMotivo: String(ret.xMotivo || ''),
    ultNsu: BigInt(onlyDigits(ret.ultNSU) || '0'),
    maxNsu: BigInt(onlyDigits(ret.maxNSU) || '0'),
    docs,
  };
}

const EVENTOS = {
  110110: 'Carta de correção',
  110111: 'Cancelamento',
  110112: 'Cancelamento por substituição',
  210200: 'Confirmação da operação',
  210210: 'Ciência da operação',
  210220: 'Desconhecimento da operação',
  210240: 'Operação não realizada',
  610110: 'Prestação de serviço em desacordo',
};
const CANCELA = new Set(['110111', '110112']);

function docOf(node) {
  return onlyDigits(node?.CNPJ || node?.CPF) || null;
}

// Interpreta um documento distribuído e o papel da empresa nele.
function parseDistDoc(xml, schema, clientCnpj) {
  const tree = parser.parse(xml);
  const clientRoot = root(clientCnpj);
  if (/^resNFe/i.test(schema) || tree.resNFe) {
    const r = tree.resNFe || {};
    return {
      tipo: 'RESUMO',
      papel: 'RECEBIDA',
      chave: onlyDigits(r.chNFe),
      emitenteDoc: docOf(r),
      emitenteNome: r.xNome || null,
      dataEmissao: toDate(r.dhEmi),
      valorTotal: r.vNF !== undefined ? Number(r.vNF) : null,
      situacao: r.cSitNFe ? String(r.cSitNFe) : null,
    };
  }
  if (/^procNFe/i.test(schema) || tree.nfeProc) {
    const inf = tree.nfeProc?.NFe?.infNFe || {};
    const emit = docOf(inf.emit);
    const dest = docOf(inf.dest);
    let papel = 'TERCEIRO';
    if (dest && root(dest) === clientRoot) papel = 'RECEBIDA';
    else if (emit && root(emit) === clientRoot) papel = 'EMITIDA';
    const chave = onlyDigits(String(inf['@_Id'] || '').replace(/^NFe/, '')) || onlyDigits(tree.nfeProc?.protNFe?.infProt?.chNFe);
    return {
      tipo: 'NFE',
      papel,
      chave,
      numero: inf.ide?.nNF ? String(inf.ide.nNF) : null,
      serie: inf.ide?.serie !== undefined ? String(inf.ide.serie) : null,
      dataEmissao: toDate(inf.ide?.dhEmi || inf.ide?.dEmi),
      valorTotal: inf.total?.ICMSTot?.vNF !== undefined ? Number(inf.total.ICMSTot.vNF) : null,
      emitenteDoc: emit,
      emitenteNome: inf.emit?.xNome || null,
      destinatarioDoc: dest,
      destinatarioNome: inf.dest?.xNome || null,
    };
  }
  const evento = tree.resEvento || tree.procEventoNFe?.evento?.infEvento || tree.procEventoNFe?.retEvento?.infEvento;
  if (evento) {
    const codigo = String(evento.tpEvento || '');
    return {
      tipo: 'EVENTO',
      papel: 'EVENTO',
      chave: onlyDigits(evento.chNFe),
      dataEmissao: toDate(evento.dhEvento || evento.dhRecbto),
      eventoDescricao: EVENTOS[codigo] || evento.xEvento || evento.descEvento || (codigo ? `Evento ${codigo}` : 'Evento'),
      cancela: CANCELA.has(codigo),
    };
  }
  return { tipo: 'OUTRO', papel: 'TERCEIRO', chave: '' };
}

// ---------- Ciência da Operação (evento assinado) ----------

function loadSigningMaterial(pfx, passphrase) {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), passphrase);
  const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]
    || (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map((bag) => bag.cert);
  const cert = certs.find((item) => !item.getExtension('basicConstraints')?.cA) || certs[0];
  if (!keyBag?.key || !cert) throw new Error('O certificado não tem chave privada utilizável para assinar a Ciência da Operação.');
  const certBase64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
  return { key: keyBag.key, certBase64 };
}

function nowBrasilia() {
  const local = new Date(Date.now() - 3 * 60 * 60 * 1000 - 60 * 1000); // 1 minuto antes, para nunca ficar no futuro
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

// Assinatura XMLDSig envelopada (C14N 2001, RSA-SHA1), no formato exigido pela NF-e.
// O XML é gerado aqui mesmo já na forma canônica, então não precisa de canonizador.
function signedEvento({ cnpj, chave, dhEvento, key, certBase64 }) {
  const id = `ID210210${chave}01`;
  const content = `<cOrgao>91</cOrgao><tpAmb>${TP_AMB}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe><dhEvento>${dhEvento}</dhEvento>`
    + '<tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>'
    + '<detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento>';
  const canonicalInf = `<infEvento xmlns="${NS_NFE}" Id="${id}">${content}</infEvento>`;
  const digest = crypto.createHash('sha1').update(canonicalInf, 'utf8').digest('base64');
  const signedInfoBody = '<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>'
    + '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>'
    + `<Reference URI="#${id}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>`
    + '<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms>'
    + `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digest}</DigestValue></Reference>`;
  const canonicalSignedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoBody}</SignedInfo>`;
  const md = forge.md.sha1.create();
  md.update(canonicalSignedInfo, 'utf8');
  const signature = forge.util.encode64(key.sign(md));
  return `<evento xmlns="${NS_NFE}" versao="1.00"><infEvento Id="${id}">${content}</infEvento>`
    + `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo>${signedInfoBody}</SignedInfo>`
    + `<SignatureValue>${signature}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo></Signature></evento>`;
}

function eventoRequestXml(eventos) {
  const idLote = String(Date.now()).slice(-15).padStart(15, '0');
  const env = `<envEvento xmlns="${NS_NFE}" versao="1.00"><idLote>${idLote}</idLote>${eventos.join('')}</envEvento>`;
  return soapEnvelope(`<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${env}</nfeDadosMsg>`);
}

function parseEventoResponse(text) {
  const tree = parser.parse(text);
  const ret = findKey(tree, 'retEnvEvento');
  if (!ret) throw new Error('Resposta inesperada da SEFAZ ao registrar a Ciência da Operação.');
  let itens = ret.retEvento || [];
  if (!Array.isArray(itens)) itens = [itens];
  return {
    cStat: String(ret.cStat || ''),
    xMotivo: String(ret.xMotivo || ''),
    resultados: itens.map((item) => ({
      chave: onlyDigits(item.infEvento?.chNFe),
      cStat: String(item.infEvento?.cStat || ''),
      xMotivo: String(item.infEvento?.xMotivo || ''),
    })),
  };
}

// 135 registrado; 136 registrado sem vínculo; 573 duplicidade (já havia ciência)
const CIENCIA_OK = new Set(['135', '136', '573']);

// ---------- Rotina por cliente ----------

const running = new Set();

async function saveDoc({ client, doc, info }) {
  const exists = await prisma.nfeDocument.findUnique({ where: { clientId_nsu: { clientId: client.id, nsu: doc.nsu } } });
  if (exists) return false;
  const xmlRef = await fileStorage.saveFile({
    buffer: Buffer.from(doc.xml, 'utf8'),
    originalName: `${info.chave || doc.nsu}.xml`,
    mimeType: 'application/xml',
    folder: `nfe/${client.accountingFirmId}/${client.id}`,
  });
  await prisma.nfeDocument.create({
    data: {
      accountingFirmId: client.accountingFirmId,
      clientId: client.id,
      nsu: doc.nsu,
      chaveAcesso: info.chave || '',
      tipo: info.tipo === 'OUTRO' ? doc.schema.split('_')[0].toUpperCase() || 'OUTRO' : info.tipo,
      papel: info.papel,
      numero: info.numero || null,
      serie: info.serie || null,
      dataEmissao: info.dataEmissao || null,
      valorTotal: info.valorTotal ?? null,
      emitenteDoc: info.emitenteDoc || null,
      emitenteNome: info.emitenteNome || null,
      destinatarioDoc: info.destinatarioDoc || null,
      destinatarioNome: info.destinatarioNome || null,
      situacao: info.situacao || null,
      cancelada: info.situacao === '3',
      ciencia: info.tipo === 'RESUMO' && info.situacao !== '3' ? 'PENDENTE' : null,
      eventoDescricao: info.eventoDescricao || null,
      xmlRef,
    },
  });
  return true;
}

async function registrarCiencias({ client, cnpj, cert, post }) {
  const resumos = await prisma.nfeDocument.findMany({
    where: { clientId: client.id, tipo: 'RESUMO', ciencia: 'PENDENTE' },
    orderBy: { nsu: 'asc' },
    take: 200,
  });
  const completas = new Set((await prisma.nfeDocument.findMany({
    where: { clientId: client.id, tipo: 'NFE', chaveAcesso: { in: resumos.map((item) => item.chaveAcesso) } },
    select: { chaveAcesso: true },
  })).map((item) => item.chaveAcesso));
  const pendentes = resumos.filter((item) => item.chaveAcesso && !completas.has(item.chaveAcesso));
  await prisma.nfeDocument.updateMany({ where: { id: { in: resumos.filter((item) => completas.has(item.chaveAcesso)).map((item) => item.id) } }, data: { ciencia: 'ENVIADA' } });
  if (pendentes.length === 0) return 0;

  const signing = loadSigningMaterial(cert.pfx, cert.passphrase);
  let enviadas = 0;
  for (let i = 0; i < pendentes.length; i += 20) {
    const lote = pendentes.slice(i, i + 20);
    const dhEvento = nowBrasilia();
    const eventos = lote.map((item) => signedEvento({ cnpj, chave: item.chaveAcesso, dhEvento, ...signing }));
    const response = await post(EVENTO_URL, 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento', eventoRequestXml(eventos), cert);
    if (response.status >= 400 && !/retEnvEvento/.test(response.text)) {
      throw new Error(`A SEFAZ recusou a Ciência da Operação (HTTP ${response.status}).`);
    }
    const ret = parseEventoResponse(response.text);
    const porChave = Object.fromEntries(ret.resultados.map((item) => [item.chave, item]));
    for (const item of lote) {
      const res = porChave[item.chaveAcesso];
      const ok = res && CIENCIA_OK.has(res.cStat);
      if (ok) enviadas += 1;
      await prisma.nfeDocument.update({
        where: { id: item.id },
        data: ok
          ? { ciencia: 'ENVIADA', cienciaErro: null }
          : { ciencia: 'ERRO', cienciaErro: res ? `${res.cStat} - ${res.xMotivo}` : `${ret.cStat} - ${ret.xMotivo}` },
      });
    }
    if (i + 20 < pendentes.length) await sleep(PAUSA_MS);
  }
  return enviadas;
}

async function syncClient(clientId, { post = postSoap, pause = PAUSA_MS, force = false, refazer = false } = {}) {
  assertPermanentStorage();
  if (running.has(clientId)) throw Object.assign(new Error('A busca de NF-e deste cliente já está em andamento.'), { status: 409 });
  running.add(clientId);
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { nfseConfig: true } });
  try {
    const config = client?.nfseConfig;
    if (!config) throw Object.assign(new Error('Cadastre o certificado digital da empresa antes de buscar as notas.'), { status: 400 });
    if (config.certificateValidUntil && config.certificateValidUntil < new Date()) {
      throw Object.assign(new Error('O certificado digital desta empresa está vencido. Envie o certificado novo.'), { status: 400 });
    }
    const cnpj = onlyDigits(client.cnpj);
    if (cnpj.length !== 14) throw Object.assign(new Error('A busca de NF-e exige CNPJ válido no cadastro do cliente.'), { status: 400 });
    const cUFAutor = UF_CODIGO[String(client.state || '').toUpperCase()];
    if (!cUFAutor) throw Object.assign(new Error('Preencha a UF (estado) no cadastro do cliente para buscar NF-e.'), { status: 400 });
    if (!force && config.nfeNextAllowedAt && config.nfeNextAllowedAt > new Date()) {
      const hora = config.nfeNextAllowedAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      throw Object.assign(new Error(`A SEFAZ só permite nova consulta desta empresa a partir das ${hora} (horário de Brasília).`), { status: 429 });
    }

    await prisma.clientNfseConfig.update({ where: { id: config.id }, data: { nfeLastSyncStatus: 'EM_ANDAMENTO', nfeLastSyncError: null } });
    const cert = {
      pfx: certCrypto.decrypt(config.certificatePfxEncrypted),
      passphrase: certCrypto.decrypt(config.certificatePassphraseEncrypted).toString('utf8'),
    };
    let ultNsu = refazer ? 0n : config.nfeLastNsu;
    let recebidos = 0;
    let saved = 0;
    let nextAllowedAt = null;
    let aviso = '';
    let ultimaResposta = '';

    for (let consulta = 0; consulta < MAX_CONSULTAS; consulta += 1) {
      const response = await post(DIST_URL, 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse', distRequestXml({ cUFAutor, cnpj, ultNsu }), cert);
      if (response.status === 403) throw new Error('A SEFAZ recusou o certificado (HTTP 403). Confira se é o e-CNPJ da própria empresa e se está válido.');
      const ret = parseDistResponse(response.text);
      ultimaResposta = `SEFAZ ${ret.cStat} - ${ret.xMotivo} (ultNSU ${ret.ultNsu}, maxNSU ${ret.maxNsu})`;
      if (ret.cStat === '656') {
        nextAllowedAt = new Date(Date.now() + UMA_HORA);
        aviso = 'A SEFAZ pediu para aguardar 1 hora (consumo indevido). A próxima busca continua de onde parou.';
        break;
      }
      if (ret.cStat === '137') { nextAllowedAt = new Date(Date.now() + UMA_HORA); break; }
      if (ret.cStat !== '138') throw new Error(`A SEFAZ respondeu ${ret.cStat} - ${ret.xMotivo}`);
      if (ret.docs.length === 0) {
        // Nunca avançar o NSU sem ter gravado os documentos.
        const trecho = String(response.text).replace(/\s+/g, ' ').slice(0, 600);
        throw new Error(`A SEFAZ informou documentos (138), mas nenhum foi lido. Trecho da resposta: ${trecho}`);
      }
      recebidos += ret.docs.length;

      for (const doc of ret.docs) {
        const info = parseDistDoc(doc.xml, doc.schema, cnpj);
        if (await saveDoc({ client, doc, info })) saved += 1;
        if (info.tipo === 'EVENTO' && info.cancela && info.chave) {
          await prisma.nfeDocument.updateMany({ where: { clientId, chaveAcesso: info.chave, tipo: { in: ['NFE', 'RESUMO'] } }, data: { cancelada: true, ciencia: null } });
        }
      }
      if (ret.ultNsu > ultNsu) ultNsu = ret.ultNsu;
      await prisma.clientNfseConfig.update({ where: { id: config.id }, data: { nfeLastNsu: ultNsu } });
      if (ret.ultNsu >= ret.maxNsu) { nextAllowedAt = new Date(Date.now() + UMA_HORA); break; }
      if (pause) await sleep(pause);
    }

    // Cancelamento pode chegar antes da nota.
    const cancelamentos = await prisma.nfeDocument.findMany({ where: { clientId, tipo: 'EVENTO', eventoDescricao: { startsWith: 'Cancelamento' } }, select: { chaveAcesso: true } });
    const chaves = [...new Set(cancelamentos.map((item) => item.chaveAcesso).filter(Boolean))];
    if (chaves.length) await prisma.nfeDocument.updateMany({ where: { clientId, chaveAcesso: { in: chaves }, tipo: { in: ['NFE', 'RESUMO'] } }, data: { cancelada: true, ciencia: null } });

    let ciencias = 0;
    try {
      ciencias = await registrarCiencias({ client, cnpj, cert, post });
    } catch (error) {
      aviso = `${aviso} Ciência da Operação: ${error.message}`.trim();
    }

    const parts = [saved ? `${saved} documento(s) novo(s).` : 'Sem documentos novos.', ciencias ? `Ciência registrada em ${ciencias} nota(s); o XML completo chega na próxima busca.` : '', aviso].filter(Boolean);
    await prisma.clientNfseConfig.update({
      where: { id: config.id },
      data: {
        nfeLastSyncAt: new Date(),
        nfeLastSyncStatus: 'SUCESSO',
        // Guarda a última resposta da SEFAZ para conferência na tela.
        nfeLastSyncError: [aviso, ultimaResposta].filter(Boolean).join(' | ') || null,
        nfeLastSyncCount: saved,
        ...(nextAllowedAt ? { nfeNextAllowedAt: nextAllowedAt } : {}),
      },
    });
    return { saved, ciencias, message: parts.join(' ') };
  } catch (error) {
    if (client?.nfseConfig) {
      await prisma.clientNfseConfig.update({
        where: { id: client.nfseConfig.id },
        data: { nfeLastSyncAt: new Date(), nfeLastSyncStatus: 'ERRO', nfeLastSyncError: String(error.message).slice(0, 1000) },
      }).catch(() => {});
    }
    throw error;
  } finally {
    running.delete(clientId);
  }
}

module.exports = {
  syncClient,
  isRunning: (clientId) => running.has(clientId),
  _private: { distRequestXml, parseDistResponse, parseDistDoc, signedEvento, eventoRequestXml, parseEventoResponse, loadSigningMaterial, nowBrasilia, UF_CODIGO },
};
