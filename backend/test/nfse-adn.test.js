const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { createZip, _private } = require('../src/services/nfseAdn.service');

const { normalizeLote, decodeArquivo, parseDocumento, crc32 } = _private;

const CHAVE = '35269022211222333000181000000000008726110604014657';
const nfseXml = (prest, toma) => `<?xml version="1.0" encoding="utf-8"?>
<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${CHAVE}">
<xLocEmi>Limeira</xLocEmi><nNFSe>87</nNFSe><dhProc>2026-11-12T17:24:11-03:00</dhProc>
<emit><CNPJ>${prest}</CNPJ><xNome>OFICINA TESTE LTDA</xNome></emit><valores><vLiq>1950.00</vLiq></valores>
<DPS versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS Id="DPS1">
<dhEmi>2026-11-12T17:24:10-03:00</dhEmi><dCompet>2026-11-12</dCompet>
<prest><CNPJ>${prest}</CNPJ></prest><toma><CNPJ>${toma}</CNPJ><xNome>CLIENTE TOMADOR SA</xNome></toma>
<valores><vServPrest><vServ>1950.00</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>`;

const eventoXml = `<?xml version="1.0" encoding="utf-8"?><evento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
<infEvento Id="EVT1"><dhProc>2026-11-13T10:00:00-03:00</dhProc><pedRegEvento versao="1.01"><infPedReg Id="PRE1">
<chNFSe>${CHAVE}</chNFSe><dhEvento>2026-11-13T09:59:00-03:00</dhEvento><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>1</cMotivo></e101101>
</infPedReg></pedRegEvento></infEvento></evento>`;

test('lê NFS-e emitida pela empresa com número, competência, valor e tomador', () => {
  const info = parseDocumento(nfseXml('11222333000181', '99888777000166'), '11.222.333/0002-62');
  assert.equal(info.kind, 'NFSE');
  assert.equal(info.papel, 'EMITIDA', 'mesmo CNPJ raiz (filial) conta como emitida');
  assert.equal(info.chave, CHAVE);
  assert.equal(info.numero, '87');
  assert.equal(info.valorServico, 1950);
  assert.equal(info.tomadorNome, 'CLIENTE TOMADOR SA');
  assert.equal(info.competencia.toISOString().slice(0, 10), '2026-11-12');
  assert.equal(info.dataEmissao.toISOString(), '2026-11-12T20:24:10.000Z');
});

test('identifica NFS-e recebida quando a empresa é a tomadora', () => {
  const info = parseDocumento(nfseXml('99888777000166', '11222333000181'), '11222333000181');
  assert.equal(info.papel, 'RECEBIDA');
  assert.equal(info.emitenteNome, 'OFICINA TESTE LTDA');
});

test('reconhece evento de cancelamento e a nota a que se refere', () => {
  const info = parseDocumento(eventoXml, '11222333000181');
  assert.equal(info.kind, 'EVENTO');
  assert.equal(info.chave, CHAVE);
  assert.equal(info.codigoEvento, '101101');
  assert.equal(info.cancela, true);
  assert.equal(info.eventoDescricao, 'Cancelamento');
});

test('decodifica XML em base64 com e sem gzip', () => {
  const xml = nfseXml('11222333000181', '99888777000166');
  assert.equal(decodeArquivo(Buffer.from(xml).toString('base64')), xml);
  assert.equal(decodeArquivo(zlib.gzipSync(Buffer.from(xml)).toString('base64')), xml);
  assert.throws(() => decodeArquivo(Buffer.from('{"a":1}').toString('base64')), /não é um XML/);
});

test('normaliza o lote da distribuição em PascalCase ou camelCase', () => {
  const arquivo = zlib.gzipSync(Buffer.from(eventoXml)).toString('base64');
  const pascal = normalizeLote({ StatusProcessamento: 'DOCUMENTOS_LOCALIZADOS', LoteDFe: [{ NSU: 12, ChaveAcesso: CHAVE, TipoDocumento: 'EVENTO', ArquivoXml: arquivo }] });
  assert.equal(pascal.documentos.length, 1);
  assert.equal(pascal.documentos[0].nsu, 12n);
  assert.equal(pascal.documentos[0].tipo, 'EVENTO');
  const camel = normalizeLote({ statusProcessamento: 'DOCUMENTOS_LOCALIZADOS', loteDFe: [{ nsu: '13', chaveAcesso: CHAVE, tipoDocumento: 'nfse', arquivoXml: arquivo }] });
  assert.equal(camel.documentos[0].nsu, 13n);
  assert.equal(camel.documentos[0].tipo, 'NFSE');
  assert.deepEqual(normalizeLote({ StatusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO' }).documentos, []);
  assert.throws(() => normalizeLote({ Mensagem: 'x' }), /formato não reconhecido \(campos: Mensagem/);
});

test('gera ZIP válido com crc correto', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const zip = createZip([{ name: 'Emitidas/a.xml', data: Buffer.from('<a/>') }, { name: 'Recebidas/b.xml', data: Buffer.from('<b/>') }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const end = zip.subarray(zip.length - 22);
  assert.equal(end.readUInt32LE(0), 0x06054b50);
  assert.equal(end.readUInt16LE(10), 2);
});
