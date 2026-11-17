const prisma = require('../lib/prisma');
const certCrypto = require('../utils/certCrypto');
const { inspectPfx } = require('../utils/certInspect');
const fileStorage = require('../services/fileStorage.service');
const nfseAdn = require('../services/nfseAdn.service');
const nfeDist = require('../services/nfeDist.service');

const { onlyDigits, cnpjRoot } = nfseAdn._private;

function firmWhere(req) {
  return { accountingFirmId: req.user.accountingFirmId };
}

async function findClient(req) {
  const client = await prisma.client.findFirst({ where: { id: req.params.clientId, ...firmWhere(req) }, include: { nfseConfig: true } });
  if (!client) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
  return client;
}

// Nunca devolve o certificado nem a senha, só metadados.
function serializeConfig(config) {
  if (!config) return null;
  return {
    subject: config.certificateSubject,
    cnpj: config.certificateCnpj,
    validUntil: config.certificateValidUntil,
    uploadedAt: config.certificateUploadedAt,
    expired: config.certificateValidUntil ? config.certificateValidUntil < new Date() : false,
    lastNsu: config.lastNsu.toString(),
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastSyncError: config.lastSyncError,
    lastSyncCount: config.lastSyncCount,
    nfe: {
      lastSyncAt: config.nfeLastSyncAt,
      lastSyncStatus: config.nfeLastSyncStatus,
      lastSyncError: config.nfeLastSyncError,
      lastSyncCount: config.nfeLastSyncCount,
      nextAllowedAt: config.nfeNextAllowedAt,
    },
  };
}

function serializeDocument(doc) {
  return {
    id: doc.id,
    nsu: doc.nsu.toString(),
    chaveAcesso: doc.chaveAcesso,
    tipoDocumento: doc.tipoDocumento,
    papel: doc.papel,
    numero: doc.numero,
    dataEmissao: doc.dataEmissao,
    competencia: doc.competencia,
    valorServico: doc.valorServico === null ? null : Number(doc.valorServico),
    emitenteDoc: doc.emitenteDoc,
    emitenteNome: doc.emitenteNome,
    tomadorDoc: doc.tomadorDoc,
    tomadorNome: doc.tomadorNome,
    cancelada: doc.cancelada,
    eventoDescricao: doc.eventoDescricao,
  };
}

function monthRange(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
}

function documentFilter(req, clientId) {
  const where = { ...firmWhere(req), clientId };
  const range = monthRange(req.query.mes);
  if (range) where.OR = [{ competencia: range }, { competencia: null, dataEmissao: range }];
  if (['EMITIDA', 'RECEBIDA', 'INTERMEDIARIO', 'EVENTO'].includes(req.query.papel)) where.papel = req.query.papel;
  return where;
}

async function listClients(req, res) {
  const clients = await prisma.client.findMany({
    where: { ...firmWhere(req), active: true },
    include: { nfseConfig: true },
    orderBy: { name: 'asc' },
  });
  const counts = await prisma.nfseDocument.groupBy({ by: ['clientId'], where: firmWhere(req), _count: { _all: true } });
  const countBy = Object.fromEntries(counts.map((row) => [row.clientId, row._count._all]));
  const nfeCounts = await prisma.nfeDocument.groupBy({ by: ['clientId'], where: firmWhere(req), _count: { _all: true } });
  const nfeBy = Object.fromEntries(nfeCounts.map((row) => [row.clientId, row._count._all]));
  res.json(clients.map((client) => ({
    id: client.id,
    name: client.name,
    cnpj: client.cnpj,
    code: client.code,
    documents: countBy[client.id] || 0,
    nfeDocuments: nfeBy[client.id] || 0,
    state: client.state || null,
    config: serializeConfig(client.nfseConfig),
  })));
}

async function uploadCertificate(req, res) {
  const client = await findClient(req);
  if (!req.file) return res.status(400).json({ error: 'Arquivo do certificado (.pfx) não enviado.' });
  if (!req.body.passphrase) return res.status(400).json({ error: 'Informe a senha do certificado.' });
  if (!certCrypto.isConfigured()) {
    return res.status(500).json({ error: 'CERT_ENCRYPTION_KEY não configurada no servidor. Configure antes de enviar certificados.' });
  }
  let meta;
  try {
    meta = inspectPfx(req.file.buffer, req.body.passphrase);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const certificateCnpj = meta.cnpj;
  if (certificateCnpj && onlyDigits(client.cnpj).length === 14 && cnpjRoot(certificateCnpj) !== cnpjRoot(client.cnpj)) {
    return res.status(400).json({ error: `Este certificado é do CNPJ ${certificateCnpj}, que não é da empresa ${client.name}. Envie o certificado da própria empresa.` });
  }
  if (meta.validUntil && meta.validUntil < new Date()) {
    return res.status(400).json({ error: `Este certificado venceu em ${meta.validUntil.toLocaleDateString('pt-BR')}. Envie o certificado atual.` });
  }
  const data = {
    accountingFirmId: client.accountingFirmId,
    certificatePfxEncrypted: certCrypto.encrypt(req.file.buffer),
    certificatePassphraseEncrypted: certCrypto.encrypt(req.body.passphrase),
    certificateSubject: meta.subject,
    certificateCnpj,
    certificateValidUntil: meta.validUntil,
    certificateUploadedAt: new Date(),
  };
  const config = await prisma.clientNfseConfig.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, ...data },
    update: data,
  });
  res.json(serializeConfig(config));
}

async function removeCertificate(req, res) {
  const client = await findClient(req);
  await prisma.clientNfseConfig.deleteMany({ where: { clientId: client.id } });
  res.status(204).end();
}

// A busca pode levar alguns minutos: responde na hora e roda em segundo plano.
async function syncNow(req, res) {
  const client = await findClient(req);
  if (!client.nfseConfig) return res.status(400).json({ error: 'Cadastre o certificado digital da empresa antes de buscar as notas.' });
  // Só bloqueia se a busca está de fato rodando neste servidor (um reinício
  // do Render interrompe a busca e deixaria o status preso).
  if (nfseAdn.isRunning(client.id)) {
    return res.status(409).json({ error: 'A busca deste cliente já está em andamento.' });
  }
  nfseAdn.assertPermanentStorage();
  const refazer = req.query.refazer === '1';
  nfseAdn.syncClient(client.id, { refazer }).catch((error) => console.error(`Busca de NFS-e (${client.name}):`, error.message));
  res.status(202).json({ started: true });
}

async function listDocuments(req, res) {
  const client = await findClient(req);
  const documents = await prisma.nfseDocument.findMany({
    where: documentFilter(req, client.id),
    orderBy: [{ dataEmissao: 'desc' }, { nsu: 'desc' }],
    take: 1000,
  });
  res.json(documents.map(serializeDocument));
}

async function downloadXml(req, res) {
  const doc = await prisma.nfseDocument.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });
  const buffer = await fileStorage.readFile(doc.xmlRef);
  if (!buffer) return res.status(404).json({ error: 'O arquivo XML não está mais disponível.' });
  const name = `${doc.chaveAcesso || doc.nsu.toString()}${doc.tipoDocumento === 'EVENTO' ? '-evento' : ''}.xml`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(buffer);
}

async function downloadZip(req, res) {
  const client = await findClient(req);
  if (!monthRange(req.query.mes)) return res.status(400).json({ error: 'Informe o mês no formato AAAA-MM.' });
  const documents = await prisma.nfseDocument.findMany({ where: documentFilter(req, client.id), orderBy: { nsu: 'asc' } });
  if (documents.length === 0) return res.status(404).json({ error: 'Nenhum XML para esse filtro.' });
  const files = [];
  const used = new Set();
  for (const doc of documents) {
    const buffer = await fileStorage.readFile(doc.xmlRef);
    if (!buffer) continue;
    const folder = { EMITIDA: 'Emitidas', RECEBIDA: 'Recebidas', INTERMEDIARIO: 'Intermediario', EVENTO: 'Eventos' }[doc.papel] || 'Outros';
    let name = `${folder}/${doc.chaveAcesso || doc.nsu.toString()}${doc.tipoDocumento === 'EVENTO' ? `-evento-${doc.nsu}` : ''}.xml`;
    if (used.has(name)) name = name.replace(/\.xml$/, `-${doc.nsu}.xml`);
    used.add(name);
    files.push({ name, data: buffer });
  }
  if (files.length === 0) {
    return res.status(410).json({ error: 'Os XMLs desta competência não estão mais no armazenamento. Use "Baixar tudo de novo" na linha da empresa para recuperá-los.' });
  }
  const missing = documents.length - files.length;
  if (missing > 0) res.setHeader('X-Nfse-Faltando', String(missing));
  const [year, month] = req.query.mes.split('-');
  const safeName = client.name.normalize('NFD').replace(/[^\w ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="NFSe_${safeName}_${month}${year}.zip"`);
  res.send(nfseAdn.createZip(files));
}

// ---------- NF-e (modelo 55) ----------

function serializeNfe(doc) {
  return {
    id: doc.id,
    nsu: doc.nsu.toString(),
    chaveAcesso: doc.chaveAcesso,
    tipo: doc.tipo,
    papel: doc.papel,
    numero: doc.numero,
    serie: doc.serie,
    dataEmissao: doc.dataEmissao,
    valorTotal: doc.valorTotal === null ? null : Number(doc.valorTotal),
    emitenteDoc: doc.emitenteDoc,
    emitenteNome: doc.emitenteNome,
    destinatarioDoc: doc.destinatarioDoc,
    destinatarioNome: doc.destinatarioNome,
    cancelada: doc.cancelada,
    ciencia: doc.ciencia,
    cienciaErro: doc.cienciaErro,
    eventoDescricao: doc.eventoDescricao,
  };
}

function nfeFilter(req, clientId) {
  const where = { ...firmWhere(req), clientId };
  const range = monthRange(req.query.mes);
  if (range) where.dataEmissao = range;
  if (['NFE', 'RESUMO', 'EVENTO'].includes(req.query.tipo)) where.tipo = req.query.tipo;
  return where;
}

async function syncNfeNow(req, res) {
  const client = await findClient(req);
  if (!client.nfseConfig) return res.status(400).json({ error: 'Cadastre o certificado digital da empresa antes de buscar as notas.' });
  if (nfeDist.isRunning(client.id)) return res.status(409).json({ error: 'A busca de NF-e deste cliente já está em andamento.' });
  nfseAdn.assertPermanentStorage();
  const next = client.nfseConfig.nfeNextAllowedAt;
  if (next && next > new Date()) {
    const hora = next.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    return res.status(429).json({ error: `A SEFAZ só permite nova consulta desta empresa a partir das ${hora} (horário de Brasília).` });
  }
  const refazer = req.query.refazer === '1';
  nfeDist.syncClient(client.id, { refazer }).catch((error) => console.error(`Busca de NF-e (${client.name}):`, error.message));
  res.status(202).json({ started: true });
}

async function listNfe(req, res) {
  const client = await findClient(req);
  const documents = await prisma.nfeDocument.findMany({ where: nfeFilter(req, client.id), orderBy: [{ dataEmissao: 'desc' }, { nsu: 'desc' }], take: 1000 });
  res.json(documents.map(serializeNfe));
}

async function downloadNfeXml(req, res) {
  const doc = await prisma.nfeDocument.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!doc) return res.status(404).json({ error: 'Documento não encontrado.' });
  const buffer = await fileStorage.readFile(doc.xmlRef);
  if (!buffer) return res.status(404).json({ error: 'O arquivo XML não está mais disponível.' });
  const suffix = doc.tipo === 'NFE' ? '' : `-${doc.tipo.toLowerCase()}`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.chaveAcesso || doc.nsu.toString()}${suffix}.xml"`);
  res.send(buffer);
}

// ZIP do mês só com as notas completas e os eventos; resumo não é NF-e válida.
async function downloadNfeZip(req, res) {
  const client = await findClient(req);
  if (!monthRange(req.query.mes)) return res.status(400).json({ error: 'Informe o mês no formato AAAA-MM.' });
  const documents = await prisma.nfeDocument.findMany({ where: { ...nfeFilter(req, client.id), tipo: { in: ['NFE', 'EVENTO'] } }, orderBy: { nsu: 'asc' } });
  if (documents.length === 0) return res.status(404).json({ error: 'Nenhuma NF-e completa nesse mês.' });
  const files = [];
  const used = new Set();
  for (const doc of documents) {
    const buffer = await fileStorage.readFile(doc.xmlRef);
    if (!buffer) continue;
    const folder = doc.tipo === 'EVENTO' ? 'Eventos' : { RECEBIDA: 'Recebidas', EMITIDA: 'Emitidas' }[doc.papel] || 'Outras';
    let name = `${folder}/${doc.chaveAcesso || doc.nsu.toString()}${doc.tipo === 'EVENTO' ? `-evento-${doc.nsu}` : ''}.xml`;
    if (used.has(name)) name = name.replace(/\.xml$/, `-${doc.nsu}.xml`);
    used.add(name);
    files.push({ name, data: buffer });
  }
  if (files.length === 0) return res.status(410).json({ error: 'Os XMLs deste mês não estão mais no armazenamento.' });
  const [year, month] = req.query.mes.split('-');
  const safeName = client.name.normalize('NFD').replace(/[^\w ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="NFe_${safeName}_${month}${year}.zip"`);
  res.send(nfseAdn.createZip(files));
}

module.exports = { listClients, uploadCertificate, removeCertificate, syncNow, listDocuments, downloadXml, downloadZip, syncNfeNow, listNfe, downloadNfeXml, downloadNfeZip };
