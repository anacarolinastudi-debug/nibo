const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const forge = require('node-forge');
const { _private } = require('../src/services/nfeDist.service');

const { distRequestXml, parseDistResponse, parseDistDoc, signedEvento, eventoRequestXml, parseEventoResponse, loadSigningMaterial, nowBrasilia } = _private;

const CLIENTE = '11222333000181';
const FORNECEDOR = '55666777000188';
const CHAVE = '35261155666777000188550010000012341000012345';
const gz = (xml) => zlib.gzipSync(Buffer.from(xml)).toString('base64');

const resNFe = `<resNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><chNFe>${CHAVE}</chNFe><CNPJ>${FORNECEDOR}</CNPJ><xNome>FORNECEDOR EXEMPLO LTDA</xNome><IE>123</IE><dhEmi>2026-11-05T10:00:00-03:00</dhEmi><tpNF>1</tpNF><vNF>1500.75</vNF><digVal>x</digVal><dhRecbto>2026-11-05T10:00:05-03:00</dhRecbto><nProt>1</nProt><cSitNFe>1</cSitNFe></resNFe>`;
const procNFe = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${CHAVE}" versao="4.00"><ide><cUF>35</cUF><serie>1</serie><nNF>1234</nNF><dhEmi>2026-11-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>${FORNECEDOR}</CNPJ><xNome>FORNECEDOR EXEMPLO LTDA</xNome></emit><dest><CNPJ>${CLIENTE}</CNPJ><xNome>OFICINA TESTE LTDA</xNome></dest><total><ICMSTot><vNF>1500.75</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe></nfeProc>`;
const resEvento = `<resEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><cOrgao>35</cOrgao><CNPJ>${FORNECEDOR}</CNPJ><chNFe>${CHAVE}</chNFe><dhEvento>2026-11-06T09:00:00-03:00</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><xEvento>Cancelamento</xEvento></resEvento>`;

const distResponse = (docs, cStat = '138', ult = '000000000000012', max = '000000000000020') => `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDistDFeInteresseResult><retDistDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>1</tpAmb><cStat>${cStat}</cStat><xMotivo>ok</xMotivo><ultNSU>${ult}</ultNSU><maxNSU>${max}</maxNSU>${docs.length ? `<loteDistDFeZip>${docs.join('')}</loteDistDFeZip>` : ''}</retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`;

function testPfx() {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const subject = [{ name: 'commonName', value: `OFICINA TESTE LTDA:${CLIENTE}` }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey);
  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'x', { algorithm: '3des' })).getBytes();
  return { pfx: Buffer.from(der, 'binary'), publicKey: keys.publicKey };
}

test('monta a consulta de distribuição por NSU', () => {
  const xml = distRequestXml({ cUFAutor: '35', cnpj: CLIENTE, ultNsu: 12n });
  assert.match(xml, /<distDFeInt xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe" versao="1\.01"><tpAmb>1<\/tpAmb><cUFAutor>35<\/cUFAutor><CNPJ>11222333000181<\/CNPJ><distNSU><ultNSU>000000000000012<\/ultNSU><\/distNSU><\/distDFeInt>/);
  assert.match(xml, /<nfeDistDFeInteresse xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe\/wsdl\/NFeDistribuicaoDFe"><nfeDadosMsg>/);
});

test('lê o lote da distribuição: resumo, nota completa e cancelamento', () => {
  const ret = parseDistResponse(distResponse([
    `<docZip NSU="000000000000010" schema="resNFe_v1.01.xsd">${gz(resNFe)}</docZip>`,
    `<docZip NSU="000000000000011" schema="procNFe_v4.00.xsd">${gz(procNFe)}</docZip>`,
    `<docZip NSU="000000000000012" schema="resEvento_1.01.xsd">${gz(resEvento)}</docZip>`,
  ]));
  assert.equal(ret.cStat, '138');
  assert.equal(ret.ultNsu, 12n);
  assert.equal(ret.maxNsu, 20n);
  assert.equal(ret.docs.length, 3);

  const resumo = parseDistDoc(ret.docs[0].xml, ret.docs[0].schema, CLIENTE);
  assert.equal(resumo.tipo, 'RESUMO');
  assert.equal(resumo.chave, CHAVE);
  assert.equal(resumo.valorTotal, 1500.75);
  assert.equal(resumo.emitenteNome, 'FORNECEDOR EXEMPLO LTDA');

  const nota = parseDistDoc(ret.docs[1].xml, ret.docs[1].schema, CLIENTE);
  assert.equal(nota.tipo, 'NFE');
  assert.equal(nota.papel, 'RECEBIDA');
  assert.equal(nota.numero, '1234');
  assert.equal(nota.serie, '1');
  assert.equal(nota.chave, CHAVE);

  const evento = parseDistDoc(ret.docs[2].xml, ret.docs[2].schema, CLIENTE);
  assert.equal(evento.tipo, 'EVENTO');
  assert.equal(evento.cancela, true);
  assert.equal(evento.eventoDescricao, 'Cancelamento');
});

test('reconhece "nenhum documento" e consumo indevido', () => {
  assert.equal(parseDistResponse(distResponse([], '137', '000000000000020', '000000000000020')).docs.length, 0);
  assert.equal(parseDistResponse(distResponse([], '656')).cStat, '656');
  assert.throws(() => parseDistResponse('<html>erro</html>'), /Resposta inesperada/);
});

test('assina a Ciência da Operação com XMLDSig verificável', () => {
  const { pfx, publicKey } = testPfx();
  const signing = loadSigningMaterial(pfx, 'x');
  const dhEvento = nowBrasilia();
  assert.match(dhEvento, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
  const evento = signedEvento({ cnpj: CLIENTE, chave: CHAVE, dhEvento, ...signing });

  const id = `ID210210${CHAVE}01`;
  assert.equal(id.length, 54);
  const inf = evento.match(/<infEvento Id="([^"]+)">([\s\S]*?)<\/infEvento>/);
  assert.equal(inf[1], id);
  const canonicalInf = `<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${id}">${inf[2]}</infEvento>`;
  const digest = crypto.createHash('sha1').update(canonicalInf, 'utf8').digest('base64');
  assert.equal(evento.match(/<DigestValue>([^<]+)<\/DigestValue>/)[1], digest);

  const signedInfo = evento.match(/<SignedInfo>([\s\S]*?)<\/SignedInfo>/)[1];
  const canonicalSignedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}</SignedInfo>`;
  const md = forge.md.sha1.create();
  md.update(canonicalSignedInfo, 'utf8');
  const signature = forge.util.decode64(evento.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)[1]);
  assert.equal(publicKey.verify(md.digest().bytes(), signature), true);
  assert.match(inf[2], /<cOrgao>91<\/cOrgao>.*<tpEvento>210210<\/tpEvento><nSeqEvento>1<\/nSeqEvento><verEvento>1\.00<\/verEvento><detEvento versao="1\.00"><descEvento>Ciencia da Operacao<\/descEvento><\/detEvento>/);

  const envelope = eventoRequestXml([evento]);
  assert.match(envelope, /<nfeDadosMsg xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe\/wsdl\/NFeRecepcaoEvento4"><envEvento xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe" versao="1\.00"><idLote>\d{15}<\/idLote><evento/);
});

test('lê o retorno do registro de eventos', () => {
  const xml = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote><tpAmb>1</tpAmb><cStat>128</cStat><xMotivo>Lote de evento processado</xMotivo><retEvento versao="1.00"><infEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><chNFe>${CHAVE}</chNFe></infEvento></retEvento></retEnvEvento></nfeResultMsg></soap:Body></soap:Envelope>`;
  const ret = parseEventoResponse(xml);
  assert.equal(ret.cStat, '128');
  assert.deepEqual(ret.resultados, [{ chave: CHAVE, cStat: '135', xMotivo: 'Evento registrado' }]);
});

test('lê docZip com prefixo de namespace e atributos em outra ordem', () => {
  const xml = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><r:retDistDFeInt xmlns:r="http://www.portalfiscal.inf.br/nfe"><r:cStat>138</r:cStat><r:xMotivo>Documento localizado</r:xMotivo><r:ultNSU>000000000000651</r:ultNSU><r:maxNSU>000000000000651</r:maxNSU><r:loteDistDFeZip><r:docZip schema="resNFe_v1.01.xsd" NSU="000000000000650">${gz(resNFe)}</r:docZip></r:loteDistDFeZip></r:retDistDFeInt></s:Body></s:Envelope>`;
  const ret = parseDistResponse(xml);
  assert.equal(ret.docs.length, 1);
  assert.equal(ret.docs[0].nsu, 650n);
  assert.equal(ret.docs[0].schema, 'resNFe_v1.01.xsd');
  assert.match(ret.docs[0].xml, /<chNFe>/);
});
