const test = require('node:test');
const assert = require('node:assert/strict');
const identify = require('../src/services/conferenceIdentify');
const conference = require('../src/services/driveConference.service');

const clients = [
  { id: 'c-boarden', name: 'BOARDEN MARKETING DIGITAL LTDA', cnpj: '52.598.394/0001-25', code: '6', email: 'financeiro@boarden.test' },
  { id: 'c-mei', name: '46.886.694 JOILSON XAVIER DA SILVA', cnpj: '46.886.694/0001-07', code: '33', email: 'joilson@test.dev' },
  { id: 'c-pf', name: 'SILVIA FERNANDA AGUIAR', cnpj: 'PF-123', code: '15', email: '' },
];
const obligations = [
  { id: 'o-das', name: 'DAS - Simples Nacional', nickname: 'DAS', department: 'Departamento Fiscal', frequency: 'MONTHLY' },
  { id: 'o-dasmei', name: 'DAS MEI', nickname: 'DASMEI', department: 'Departamento Fiscal', frequency: 'MONTHLY' },
  { id: 'o-fgts', name: 'FGTS Digital mensal', nickname: 'FGTS', department: 'Departamento Pessoal', frequency: 'MONTHLY' },
  { id: 'o-folha', name: 'Folha de pagamento mensal', nickname: 'FOLHA', department: 'Departamento Pessoal', frequency: 'MONTHLY' },
];
const links = [
  { clientId: 'c-boarden', obligationId: 'o-das', active: true },
  { clientId: 'c-boarden', obligationId: 'o-fgts', active: true },
  { clientId: 'c-mei', obligationId: 'o-dasmei', active: true },
];

const dasText = `Documento de Arrecadação do Simples Nacional
CNPJ Razão Social
52.598.394/0001-25 BOARDEN MARKETING DIGITAL LTDA
Período de Apuração Vencimento Número do Documento
Outubro/2026 20/11/2026 07.20.26305.1234567-8
Pagar este documento até 20/11/2026
Valor Total do Documento
1.234,56`;

test('identifica DAS do Simples: cliente, obrigação, competência, vencimento e valor', () => {
  const result = identify.identifyDocument(dasText, { clients, obligations, links, firmTaxId: '11.222.333/0001-44' });
  assert.equal(result.client.id, 'c-boarden');
  assert.equal(result.obligation.id, 'o-das');
  assert.deepEqual(result.competence, { month: 10, year: 2026 });
  assert.equal(result.dueDate.toISOString().slice(0, 10), '2026-11-20');
  assert.equal(result.totalValue, 1234.56);
  assert.deepEqual(result.taskPeriod, { year: 2026, month: 11 });
  assert.deepEqual(result.notes, []);
});

test('DAS do MEI não é confundido com DAS do Simples', () => {
  const text = `Documento de Arrecadação do Simples Nacional - DAS
Microempreendedor Individual - SIMEI
CNPJ 46.886.694/0001-07
Período de Apuração: 10/2026  Data de Vencimento: 20/11/2026  Valor Total do Documento: R$ 81,90`;
  const result = identify.identifyDocument(text, { clients, obligations, links });
  assert.equal(result.client.id, 'c-mei');
  assert.equal(result.obligation.id, 'o-dasmei');
  assert.equal(result.totalValue, 81.9);
});

test('FGTS Digital com competência MM/AAAA', () => {
  const text = 'Guia do FGTS Digital - GFD\nEmpregador 52.598.394/0001-25\nCompetência 10/2026\nPagar até 20/11/2026\nValor a recolher 456,78';
  const result = identify.identifyDocument(text, { clients, obligations, links });
  assert.equal(result.obligation.id, 'o-fgts');
  assert.deepEqual(result.competence, { month: 10, year: 2026 });
});

test('ignora o CNPJ do próprio escritório e avisa quando não acha o cliente', () => {
  const text = 'Folha de pagamento\nEscritório 11.222.333/0001-44\nCompetência: 09/2026';
  const result = identify.identifyDocument(text, { clients, obligations, links, firmTaxId: '11222333000144' });
  assert.equal(result.client, null);
  assert.match(result.notes.join(' '), /Cliente não identificado/);
});

test('PDF sem texto vira aviso para identificar manualmente', () => {
  const result = identify.identifyDocument('', { clients, obligations, links });
  assert.match(result.notes[0], /sem texto legível|não tem texto/);
});

test('competência digitada recalcula o mês da tarefa', () => {
  assert.deepEqual(identify.periodsFromReference('10/2026', { frequency: 'MONTHLY' }).taskPeriod, { year: 2026, month: 11 });
  assert.deepEqual(identify.periodsFromReference('12/2026', { frequency: 'MONTHLY' }).taskPeriod, { year: 2027, month: 1 });
  assert.deepEqual(identify.periodsFromReference('10/2026', { dueDate: '2026-11-25T12:00:00Z' }).taskPeriod, { year: 2026, month: 11 });
  assert.equal(identify.periodsFromReference('13/2026').competence, null);
});

test('encontra a pasta do cliente pelo nome ou pelo código', () => {
  const { findClientFolder, findDepartmentFolder } = conference._private;
  const folders = [{ id: 'f1', name: 'YOUNG ASSESSORIA' }, { id: 'f2', name: '06 - Boarden' }, { id: 'f3', name: 'Grafica Copy e Mais' }];
  assert.equal(findClientFolder(folders, { name: 'BOARDEN MARKETING DIGITAL LTDA', code: '6' }).id, 'f2');
  assert.equal(findClientFolder(folders, { name: 'GRAFICA COPY E MAIS LTDA', code: '9' }).id, 'f3');
  assert.equal(findClientFolder(folders, { name: 'OUTRO CLIENTE', code: '99' }), null);
  assert.equal(findDepartmentFolder([{ id: 'd', name: 'DEPARTAMENTO FISCAL' }], 'Departamento Fiscal').id, 'd');
  assert.equal(findDepartmentFolder([{ id: 'd', name: 'Fiscal' }], 'Departamento Fiscal').id, 'd');
});

// ---------- Fluxo de aprovação com banco, Drive e e-mail simulados ----------

function fakeDrive(tree) {
  let next = 1;
  const moves = [];
  return {
    moves,
    tree,
    isConfigured: () => true,
    listChildren: async (parentId) => (tree[parentId] || []),
    createFolder: async (parentId, name) => { const folder = { id: `new-${next++}`, name }; (tree[parentId] ||= []).push(folder); return folder; },
    moveFile: async (fileId, from, to) => { moves.push({ fileId, from, to }); return {}; },
  };
}

function fakeDb({ protocol, link }) {
  const calls = { statuses: [], updates: [] };
  return {
    calls,
    protocolDocument: {
      findFirst: async () => ({ ...protocol }),
      update: async ({ data }) => { Object.assign(protocol, data); calls.updates.push(data); return { ...protocol }; },
    },
    clientObligation: { findFirst: async () => link },
    clientObligationStatus: { upsert: async (args) => { calls.statuses.push(args); return {}; } },
    accountingFirm: { findUnique: async () => ({ id: 'firm', name: 'Young Contábil', driveConferenceFolderId: 'conf', driveClientsFolderId: 'root' }) },
  };
}

const baseProtocol = () => ({
  id: 'p1', accountingFirmId: 'firm', status: 'CONFERENCIA', fileName: 'das.pdf', fileUrl: 'storage:x', sourceDriveFileId: 'drive-file',
  clientId: 'c-boarden', obligationId: 'o-das', reference: '10/2026', competenceYear: 2026, competenceMonth: 10, taskYear: 2026, taskMonth: 11,
  dueDate: new Date('2026-11-20T12:00:00Z'), totalValue: 1234.56,
  client: clients[0], obligation: obligations[0],
});
const storage = { readFile: async () => Buffer.from('%PDF') };

test('aprovar: envia e-mail, baixa a tarefa do mês e move para CLIENTE/DEPARTAMENTO/ANO/MMAAAA', async () => {
  const protocol = baseProtocol();
  const db = fakeDb({ protocol, link: { id: 'link-1' } });
  const driveApi = fakeDrive({ root: [{ id: 'cli', name: '06 - Boarden' }], cli: [{ id: 'dep', name: 'DEPARTAMENTO FISCAL' }], dep: [{ id: 'y2026', name: '2026' }], y2026: [] });
  const sent = [];
  const send = async (message) => { sent.push(message); return { sent: true }; };
  const result = await conference.approveAndSend('p1', { id: 'u1', accountingFirmId: 'firm' }, { db, driveApi, storage, send });

  assert.equal(sent[0].to, 'financeiro@boarden.test');
  assert.match(sent[0].subject, /DAS - Simples Nacional - competência 10\/2026/);
  assert.match(sent[0].text, /Valor: R\$\s?1\.234,56/);
  assert.equal(sent[0].attachments[0].filename, 'das.pdf');
  assert.deepEqual(db.calls.statuses[0].create, { linkId: 'link-1', year: 2026, month: 11, taskStatus: 'CONCLUIDA' });
  assert.equal(protocol.status, 'PROTOCOLADO');
  assert.equal(driveApi.moves[0].from, 'conf');
  assert.equal(driveApi.tree.y2026[0].name, '102026');
  assert.equal(driveApi.moves[0].to, driveApi.tree.y2026[0].id);
  assert.equal(protocol.driveDestination, '06 - Boarden / DEPARTAMENTO FISCAL / 2026 / 102026');
  assert.equal(result.warning, null);
});

test('aprovar respeita estrutura sem pasta de ano (DEPARTAMENTO/MMAAAA)', async () => {
  const protocol = baseProtocol();
  const db = fakeDb({ protocol, link: { id: 'link-1' } });
  const driveApi = fakeDrive({ root: [{ id: 'cli', name: 'BOARDEN MARKETING DIGITAL LTDA' }], cli: [{ id: 'dep', name: 'Fiscal' }], dep: [{ id: 'm09', name: '092026' }] });
  await conference.approveAndSend('p1', { id: 'u1', accountingFirmId: 'firm' }, { db, driveApi, storage, send: async () => ({ sent: true }) });
  assert.equal(driveApi.tree.dep.find((f) => f.name === '102026').id, driveApi.moves[0].to);
});

test('sem e-mail do cliente, não envia nem baixa', async () => {
  const protocol = { ...baseProtocol(), client: clients[2], clientId: 'c-pf' };
  const db = fakeDb({ protocol, link: { id: 'l' } });
  let sentCount = 0;
  await assert.rejects(
    conference.approveAndSend('p1', { id: 'u1', accountingFirmId: 'firm' }, { db, driveApi: fakeDrive({}), storage, send: async () => { sentCount += 1; return { sent: true }; } }),
    /não tem e-mail válido/,
  );
  assert.equal(sentCount, 0);
  assert.equal(db.calls.statuses.length, 0);
});

test('sem vínculo da obrigação com o cliente, explica e não envia', async () => {
  const db = fakeDb({ protocol: baseProtocol(), link: null });
  await assert.rejects(
    conference.approveAndSend('p1', { id: 'u1', accountingFirmId: 'firm' }, { db, driveApi: fakeDrive({}), storage, send: async () => ({ sent: true }) }),
    /não está vinculada/,
  );
});

test('e-mail não configurado: não baixa a tarefa', async () => {
  const db = fakeDb({ protocol: baseProtocol(), link: { id: 'l' } });
  await assert.rejects(
    conference.approveAndSend('p1', { id: 'u1', accountingFirmId: 'firm' }, { db, driveApi: fakeDrive({}), storage, send: async () => ({ sent: false }) }),
    /não está configurado/,
  );
  assert.equal(db.calls.statuses.length, 0);
});

test('falha ao mover no Drive não desfaz o envio, mas avisa', async () => {
  const protocol = baseProtocol();
  const db = fakeDb({ protocol, link: { id: 'l' } });
  const driveApi = { ...fakeDrive({}), listChildren: async () => { throw new Error('sem permissão'); } };
  const result = await conference.approveAndSend('p1', { id: 'u1', accountingFirmId: 'firm' }, { db, driveApi, storage, send: async () => ({ sent: true }) });
  assert.equal(protocol.status, 'PROTOCOLADO');
  assert.match(result.warning, /não foi movido no Drive: sem permissão/);
});

test('sincronização importa só PDFs novos e registra a identificação', async () => {
  const created = [];
  const db = {
    accountingFirm: { findUnique: async () => ({ id: 'firm', cnpj: '11222333000144', driveConferenceFolderId: 'conf' }), update: async () => ({}) },
    protocolDocument: { findMany: async () => [{ sourceDriveFileId: 'old' }], create: async ({ data }) => { created.push(data); return data; } },
    client: { findMany: async () => clients },
    obligation: { findMany: async () => obligations },
    obligationRobot: { findMany: async () => [] },
    clientObligation: { findMany: async () => links },
  };
  const driveApi = {
    isConfigured: () => true,
    listChildren: async () => [
      { id: 'old', name: 'antigo.pdf', mimeType: 'application/pdf' },
      { id: 'new', name: 'guia.pdf', mimeType: 'application/pdf' },
      { id: 'img', name: 'foto.jpg', mimeType: 'image/jpeg' },
    ],
    downloadFile: async () => Buffer.from('nao e pdf de verdade'),
  };
  const result = await conference.syncFirm('firm', { db, driveApi, storage: { saveFile: async () => 'storage:k' } });
  assert.equal(result.imported, 1);
  assert.equal(created[0].sourceDriveFileId, 'new');
  assert.equal(created[0].status, 'CONFERENCIA');
  assert.equal(created[0].fileUrl, 'storage:k');
  assert.match(created[0].identificationNotes, /não tem texto legível/);
});

test('link ou ID da pasta do Drive', () => {
  const { folderIdFromInput } = require('../src/services/googleDrive.service');
  assert.equal(folderIdFromInput('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing'), '1AbCdEfGhIjKlMnOp');
  assert.equal(folderIdFromInput('1AbCdEfGhIjKlMnOp'), '1AbCdEfGhIjKlMnOp');
  assert.equal(folderIdFromInput('não é link'), null);
});
