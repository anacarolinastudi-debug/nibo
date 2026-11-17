// Busca de XMLs de NFS-e (padrão nacional) na API de distribuição do ADN
// (Ambiente de Dados Nacional), com o certificado digital da própria empresa.
//
// Manual dos Contribuintes (gov.br/nfse, v1.0 de 12/02/2026):
//   GET /DFe/{NSU}  -> documentos fiscais em que o CNPJ figura como emitente,
//                      tomador ou intermediário, em ordem de NSU.
//   O certificado precisa ter o mesmo CNPJ raiz da empresa consultada; o
//   parâmetro cnpjConsulta informa o CNPJ (filial) a consultar.
//
// A documentação detalhada (Swagger) só abre com certificado, então a leitura
// da resposta é tolerante: aceita os nomes de campo em PascalCase ou camelCase
// e o XML em base64 puro ou base64 de gzip. Qualquer formato inesperado gera
// erro com a forma da resposta, para ajustar sem adivinhar.
const https = require('node:https');
const zlib = require('node:zlib');
const { XMLParser } = require('fast-xml-parser');
const prisma = require('../lib/prisma');
const certCrypto = require('../utils/certCrypto');
const fileStorage = require('./fileStorage.service');

const DEFAULT_BASE_URL = 'https://adn.nfse.gov.br/contribuintes';
const MAX_LOTES_POR_EXECUCAO = 60;
const PAUSA_ENTRE_LOTES_MS = 1200;

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

function baseUrl() {
  return (process.env.NFSE_ADN_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function cnpjRoot(value) {
  return onlyDigits(value).slice(0, 8);
}

function pick(obj, ...names) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const name of names) {
    if (obj[name] !== undefined && obj[name] !== null) return obj[name];
  }
  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  for (const name of names) {
    const found = lower[name.toLowerCase()];
    if (found !== undefined && found !== null) return found;
  }
  return undefined;
}

// XML do documento: base64, às vezes comprimido com gzip.
function decodeArquivo(encoded) {
  if (!encoded) throw new Error('Documento sem conteúdo (ArquivoXml vazio).');
  const raw = Buffer.from(String(encoded), 'base64');
  const buffer = raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw;
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  if (!text.trimStart().startsWith('<')) throw new Error('Conteúdo do documento não é um XML.');
  return text;
}

// Normaliza a resposta da distribuição em { status, documentos: [{ nsu, chave, tipo, xml }] }.
function normalizeLote(body) {
  if (!body || typeof body !== 'object') throw new Error('Resposta vazia da API do ADN.');
  const status = String(pick(body, 'StatusProcessamento', 'statusProcessamento', 'Status') || '');
  let lote = pick(body, 'LoteDFe', 'loteDFe', 'Lote', 'Documentos', 'DFe');
  if (lote && !Array.isArray(lote)) lote = [lote];
  const erros = pick(body, 'Erros', 'erros', 'Erro');
  const documentos = (lote || []).map((item) => ({
    nsu: BigInt(onlyDigits(pick(item, 'NSU', 'Nsu')) || '0'),
    chave: onlyDigits(pick(item, 'ChaveAcesso', 'chaveAcesso', 'Chave')),
    tipo: String(pick(item, 'TipoDocumento', 'tipoDocumento', 'Tipo') || 'DESCONHECIDO').toUpperCase(),
    xml: decodeArquivo(pick(item, 'ArquivoXml', 'arquivoXml', 'Arquivo', 'Xml')),
  }));
  if (!lote && !/NENHUM/i.test(status)) {
    const shape = Object.keys(body).join(', ');
    const detail = erros ? ` Erros: ${JSON.stringify(erros).slice(0, 300)}` : '';
    throw new Error(`Resposta do ADN em formato não reconhecido (campos: ${shape}; status: ${status || '-'}).${detail}`);
  }
  return { status, documentos, erros };
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00-03:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function docOf(node) {
  return onlyDigits(pick(node, 'CNPJ', 'CPF', 'NIF')) || null;
}

const EVENTOS = {
  101101: 'Cancelamento',
  105102: 'Cancelamento por substituição',
  101103: 'Solicitação de análise fiscal para cancelamento',
  105104: 'Cancelamento deferido por análise fiscal',
  105105: 'Cancelamento indeferido por análise fiscal',
  202201: 'Confirmação do prestador',
  203202: 'Confirmação do tomador',
  204203: 'Confirmação do intermediário',
  205204: 'Confirmação tácita',
  202205: 'Rejeição do prestador',
  203206: 'Rejeição do tomador',
  204207: 'Rejeição do intermediário',
  205208: 'Anulação da rejeição',
  305101: 'Cancelamento por ofício',
  305102: 'Bloqueio por ofício',
  305103: 'Desbloqueio por ofício',
};
const EVENTOS_DE_CANCELAMENTO = new Set(['101101', '105102', '105104', '305101']);

// Lê os dados úteis de uma NFS-e ou de um evento, e o papel da empresa nela.
function parseDocumento(xml, clientCnpj) {
  const tree = parser.parse(xml);
  const nfse = tree.NFSe;
  if (nfse) {
    const inf = nfse.infNFSe || {};
    const dps = inf.DPS?.infDPS || {};
    const emitDoc = docOf(inf.emit) || docOf(dps.prest);
    const tomaDoc = docOf(dps.toma);
    const interDoc = docOf(dps.interm);
    const root = cnpjRoot(clientCnpj);
    let papel = 'RECEBIDA';
    if (emitDoc && cnpjRoot(emitDoc) === root) papel = 'EMITIDA';
    else if (tomaDoc && cnpjRoot(tomaDoc) === root) papel = 'RECEBIDA';
    else if (interDoc && cnpjRoot(interDoc) === root) papel = 'INTERMEDIARIO';
    const chave = onlyDigits(String(inf['@_Id'] || '').replace(/^NFS/, ''));
    const valor = dps.valores?.vServPrest?.vServ ?? inf.valores?.vLiq;
    return {
      kind: 'NFSE',
      chave,
      papel,
      numero: inf.nNFSe ? String(inf.nNFSe) : null,
      dataEmissao: toDate(dps.dhEmi || inf.dhProc),
      competencia: toDate(dps.dCompet),
      valorServico: valor !== undefined && valor !== '' ? Number(valor) : null,
      emitenteDoc: emitDoc,
      emitenteNome: inf.emit?.xNome || dps.prest?.xNome || null,
      tomadorDoc: tomaDoc,
      tomadorNome: dps.toma?.xNome || null,
    };
  }

  const evento = tree.evento || tree.Evento || tree.pedRegEvento;
  if (evento) {
    const inf = evento.infEvento || evento;
    const ped = inf.pedRegEvento?.infPedReg || inf.infPedReg || {};
    const chave = onlyDigits(ped.chNFSe || inf.chNFSe || '');
    const codigo = Object.keys(ped).map((k) => k.match(/^e(\d{6})$/)?.[1]).find(Boolean) || '';
    return {
      kind: 'EVENTO',
      chave,
      papel: 'EVENTO',
      codigoEvento: codigo,
      eventoDescricao: EVENTOS[codigo] || (codigo ? `Evento ${codigo}` : 'Evento'),
      cancela: EVENTOS_DE_CANCELAMENTO.has(codigo),
      dataEmissao: toDate(ped.dhEvento || inf.dhProc),
    };
  }

  return { kind: 'OUTRO', chave: '', papel: 'OUTRO' };
}

// Chamada HTTPS com certificado (mTLS). Separada para poder ser trocada nos testes.
function requestJson(url, { pfx, passphrase }) {
  const ca = process.env.NFSE_ADN_CA_PEM ? process.env.NFSE_ADN_CA_PEM.replace(/\\n/g, '\n') : undefined;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      pfx,
      passphrase,
      ca,
      headers: { Accept: 'application/json' },
      timeout: 60000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = null; }
        resolve({ status: res.statusCode, body, text });
      });
    });
    req.on('timeout', () => req.destroy(new Error('A API do ADN não respondeu em 60 segundos.')));
    req.on('error', (error) => {
      if (/UNABLE_TO_VERIFY|SELF_SIGNED|CERT_/i.test(error.code || error.message)) {
        reject(new Error(`Não foi possível validar o certificado do servidor do ADN (${error.code || error.message}). Configure NFSE_ADN_CA_PEM com a cadeia ICP-Brasil.`));
      } else if (/mac verify|bad decrypt|PKCS12/i.test(error.message)) {
        reject(new Error('Não foi possível abrir o certificado da empresa. Envie o .pfx novamente com a senha correta.'));
      } else {
        reject(error);
      }
    });
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadCertificate(config) {
  return {
    pfx: certCrypto.decrypt(config.certificatePfxEncrypted),
    passphrase: certCrypto.decrypt(config.certificatePassphraseEncrypted).toString('utf8'),
  };
}

const running = new Set();

// Baixa tudo o que ainda não foi baixado para o cliente, a partir do último NSU.
async function syncClient(clientId, { request = requestJson, pause = PAUSA_ENTRE_LOTES_MS } = {}) {
  if (running.has(clientId)) throw Object.assign(new Error('A busca deste cliente já está em andamento.'), { status: 409 });
  running.add(clientId);
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { nfseConfig: true } });
  try {
    if (!client?.nfseConfig) throw Object.assign(new Error('Cadastre o certificado digital da empresa antes de buscar as notas.'), { status: 400 });
    const config = client.nfseConfig;
    if (config.certificateValidUntil && config.certificateValidUntil < new Date()) {
      throw Object.assign(new Error('O certificado digital desta empresa está vencido. Envie o certificado novo.'), { status: 400 });
    }
    const cnpj = onlyDigits(client.cnpj);
    if (cnpj.length !== 14) throw Object.assign(new Error('A busca de NFS-e no ADN exige CNPJ válido no cadastro do cliente.'), { status: 400 });

    await prisma.clientNfseConfig.update({ where: { id: config.id }, data: { lastSyncStatus: 'EM_ANDAMENTO', lastSyncError: null } });
    const cert = loadCertificate(config);
    let lastNsu = config.lastNsu;
    let saved = 0;
    let lotes = 0;
    let stopReason = 'Sem documentos novos.';

    while (lotes < MAX_LOTES_POR_EXECUCAO) {
      lotes += 1;
      const url = `${baseUrl()}/DFe/${lastNsu.toString()}?cnpjConsulta=${cnpj}&lote=true`;
      const response = await request(url, cert);
      if (response.status === 404 || response.status === 204) break;
      if (response.status === 429) { stopReason = 'Limite de consultas da API atingido; a próxima busca continua de onde parou.'; break; }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`O ADN recusou o certificado (HTTP ${response.status}). Confira se o certificado é da própria empresa (mesmo CNPJ raiz) e está válido.`);
      }
      if (response.status >= 400 || !response.body) {
        const detail = response.body ? JSON.stringify(response.body).slice(0, 300) : String(response.text || '').slice(0, 200);
        throw new Error(`A API do ADN respondeu HTTP ${response.status}: ${detail}`);
      }

      const { documentos, status } = normalizeLote(response.body);
      const novos = documentos.filter((doc) => doc.nsu > lastNsu || (lastNsu === 0n && doc.nsu === 0n));
      if (novos.length === 0) break;

      for (const doc of novos) {
        const info = parseDocumento(doc.xml, cnpj);
        const chave = info.chave || doc.chave;
        const exists = await prisma.nfseDocument.findUnique({ where: { clientId_nsu: { clientId, nsu: doc.nsu } } });
        if (!exists) {
          const xmlRef = await fileStorage.saveFile({
            buffer: Buffer.from(doc.xml, 'utf8'),
            originalName: `${chave || doc.nsu}.xml`,
            mimeType: 'application/xml',
            folder: `nfse/${client.accountingFirmId}/${clientId}`,
          });
          await prisma.nfseDocument.create({
            data: {
              accountingFirmId: client.accountingFirmId,
              clientId,
              nsu: doc.nsu,
              chaveAcesso: chave,
              tipoDocumento: info.kind === 'OUTRO' ? doc.tipo : info.kind,
              papel: info.papel,
              numero: info.numero || null,
              dataEmissao: info.dataEmissao || null,
              competencia: info.competencia || null,
              valorServico: info.valorServico ?? null,
              emitenteDoc: info.emitenteDoc || null,
              emitenteNome: info.emitenteNome || null,
              tomadorDoc: info.tomadorDoc || null,
              tomadorNome: info.tomadorNome || null,
              eventoDescricao: info.eventoDescricao || null,
              xmlRef,
            },
          });
          saved += 1;
        }
        if (info.kind === 'EVENTO' && info.cancela && chave) {
          await prisma.nfseDocument.updateMany({ where: { clientId, chaveAcesso: chave, tipoDocumento: 'NFSE' }, data: { cancelada: true } });
        }
        if (doc.nsu > lastNsu) lastNsu = doc.nsu;
      }
      await prisma.clientNfseConfig.update({ where: { id: config.id }, data: { lastNsu } });
      if (/NENHUM/i.test(status)) break;
      if (lotes === MAX_LOTES_POR_EXECUCAO) stopReason = 'Muitos documentos; a próxima busca continua de onde parou.';
      if (pause) await sleep(pause);
    }

    // Um cancelamento pode chegar antes da nota (NSUs fora de ordem).
    const cancelamentos = await prisma.nfseDocument.findMany({
      where: { clientId, tipoDocumento: 'EVENTO', eventoDescricao: { startsWith: 'Cancelamento' } },
      select: { chaveAcesso: true },
    });
    const chaves = [...new Set(cancelamentos.map((item) => item.chaveAcesso).filter(Boolean))];
    if (chaves.length) {
      await prisma.nfseDocument.updateMany({ where: { clientId, tipoDocumento: 'NFSE', chaveAcesso: { in: chaves } }, data: { cancelada: true } });
    }

    await prisma.clientNfseConfig.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCESSO', lastSyncError: null, lastSyncCount: saved },
    });
    return { saved, lastNsu: lastNsu.toString(), message: saved ? `${saved} documento(s) novo(s).` : stopReason };
  } catch (error) {
    if (client?.nfseConfig) {
      await prisma.clientNfseConfig.update({
        where: { id: client.nfseConfig.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'ERRO', lastSyncError: String(error.message).slice(0, 1000) },
      }).catch(() => {});
    }
    throw error;
  } finally {
    running.delete(clientId);
  }
}

// ZIP simples (sem compressão), suficiente para XMLs. Evita dependência nova.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

module.exports = {
  syncClient,
  createZip,
  _private: { normalizeLote, decodeArquivo, parseDocumento, onlyDigits, cnpjRoot, crc32, baseUrl },
};
