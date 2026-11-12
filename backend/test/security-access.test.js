const test = require('node:test');
const assert = require('node:assert/strict');

// --- Banco simulado para o controller de clientes ---
const prismaPath = require.resolve('../src/lib/prisma');
const clients = [
  { id: 'c1', accountingFirmId: 'firm', name: 'Cliente Um', govbrLoginEncrypted: null, govbrPasswordEncrypted: null, active: true },
  { id: 'c2', accountingFirmId: 'firm', name: 'Cliente Dois', govbrLoginEncrypted: null, govbrPasswordEncrypted: null, active: true },
];
const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {
  client: {
    findMany: async ({ where }) => clients.filter((row) => matches(row, where)).map((row) => ({ ...row })),
    findFirst: async ({ where }) => clients.find((row) => matches(row, where)) || null,
  },
} };

process.env.CERT_ENCRYPTION_KEY = 'chave-de-teste';
const secretCrypto = require('../src/utils/certCrypto');
clients[1].govbrPasswordEncrypted = secretCrypto.encrypt('senha-gov-do-cliente-dois');
clients[1].govbrLoginEncrypted = secretCrypto.encrypt('login-dois');

const clientsCtrl = require('../src/controllers/clients.controller');

function fakeRes() {
  const result = { status: 200 };
  return { result, status(v) { result.status = v; return this; }, json(v) { result.body = v; return this; }, set() { return this; }, sendStatus(v) { result.status = v; return this; } };
}

test('usuário do portal só lista o próprio cliente', async () => {
  const res = fakeRes();
  await clientsCtrl.list({ user: { role: 'CLIENT', accountingFirmId: 'firm', clientId: 'c1' } }, res);
  assert.deepEqual(res.result.body.map((c) => c.id), ['c1']);
});

test('usuário do portal não abre a ficha de outro cliente', async () => {
  const res = fakeRes();
  await clientsCtrl.getById({ params: { id: 'c2' }, user: { role: 'CLIENT', accountingFirmId: 'firm', clientId: 'c1' } }, res);
  assert.equal(res.result.status, 404);
});

test('usuário do portal nunca recebe senha gov.br, nem do próprio cadastro', async () => {
  const res = fakeRes();
  await clientsCtrl.getById({ params: { id: 'c2' }, user: { role: 'CLIENT', accountingFirmId: 'firm', clientId: 'c2' } }, res);
  assert.equal(res.result.status, 200);
  assert.equal(res.result.body.govbrPassword, undefined);
  assert.equal(res.result.body.hasGovbrAccess, true);
});

test('equipe do escritório continua vendo a senha gov.br', async () => {
  const res = fakeRes();
  await clientsCtrl.getById({ params: { id: 'c2' }, user: { role: 'ACCOUNTANT', accountingFirmId: 'firm' } }, res);
  assert.equal(res.result.body.govbrPassword, 'senha-gov-do-cliente-dois');
});

// --- Token dos webhooks ---
test('token do webhook é por escritório e recusa valores errados', () => {
  process.env.JWT_SECRET = 'segredo-de-teste';
  const { webhookToken, isValidWebhookToken, buildWebhookUrl } = require('../src/utils/webhookToken');
  const token = webhookToken('firm-a');
  assert.ok(isValidWebhookToken('firm-a', token));
  assert.equal(isValidWebhookToken('firm-b', token), false);
  assert.equal(isValidWebhookToken('firm-a', ''), false);
  assert.equal(isValidWebhookToken('firm-a', undefined), false);
  assert.equal(isValidWebhookToken('firm-a', token.slice(0, -1) + (token.endsWith('0') ? '1' : '0')), false);
  assert.match(buildWebhookUrl('https://api.test', '/api/whatsapp/evolution/webhook', 'firm-a'), /\?firmId=firm-a&token=[a-f0-9]{40}$/);
});

test('webhook da Evolution sem token é recusado e não grava nada', async () => {
  const whatsapp = require('../src/controllers/whatsapp.controller');
  const res = fakeRes();
  await whatsapp.receiveEvolutionWebhook({ query: { firmId: 'firm' }, body: { event: 'messages.upsert', data: { key: { remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, res);
  assert.equal(res.result.status, 403);
});

test('webhook da Meta sem token é recusado', async () => {
  const whatsapp = require('../src/controllers/whatsapp.controller');
  const res = fakeRes();
  await whatsapp.receiveWebhook({ query: { firmId: 'firm', token: 'errado' }, body: { entry: [] } }, res);
  assert.equal(res.result.status, 403);
});

// --- Chave dos tokens de login ---
test('em produção, sem JWT_SECRET, o servidor recusa gerar tokens', () => {
  const saved = { JWT_SECRET: process.env.JWT_SECRET, RENDER: process.env.RENDER };
  delete process.env.JWT_SECRET;
  process.env.RENDER = 'true';
  try {
    const { generateToken } = require('../src/utils/jwt');
    assert.throws(() => generateToken({ sub: 'x' }), /JWT_SECRET/);
  } finally {
    if (saved.JWT_SECRET) process.env.JWT_SECRET = saved.JWT_SECRET;
    if (saved.RENDER) process.env.RENDER = saved.RENDER; else delete process.env.RENDER;
  }
});

// --- Limite de tentativas de login ---
test('bloqueia após muitas tentativas para o mesmo e-mail', () => {
  const { loginRateLimit, _reset } = require('../src/middleware/loginRateLimit');
  _reset();
  let passed = 0;
  let last;
  for (let i = 0; i < 10; i += 1) {
    last = fakeRes();
    loginRateLimit({ ip: '1.2.3.4', body: { email: 'Alguem@Teste.com' } }, last, () => { passed += 1; });
  }
  assert.equal(passed, 8);
  assert.equal(last.result.status, 429);
});

// --- Rotas restritas à equipe ---
function routeGuards(router, method, path) {
  const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  return layer ? layer.route.stack.length : 0;
}

test('rotas de equipe em demandas exigem perfil de equipe', () => {
  const router = require('../src/routes/demands.routes');
  for (const [method, path] of [['post', '/responsibilities/transfer'], ['post', '/processes'], ['post', '/templates'], ['delete', '/:id']]) {
    assert.equal(routeGuards(router, method, path), 2, `${method.toUpperCase()} ${path} deveria ter a verificação de perfil`);
  }
  assert.equal(routeGuards(router, 'get', '/'), 1);
});

test('WhatsApp, e-CAC e departamentos ficam restritos à equipe', () => {
  for (const file of ['whatsapp', 'ecac', 'departments']) {
    const router = require(`../src/routes/${file}.routes`);
    const guards = router.stack.filter((l) => !l.route && l.name === 'requireRoleMiddleware' || (!l.route && /roles/.test(l.handle.toString())));
    assert.ok(guards.length >= 1, `${file} deveria exigir perfil de equipe`);
  }
});
