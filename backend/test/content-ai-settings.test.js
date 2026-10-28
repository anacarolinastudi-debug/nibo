const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'ai-settings-jwt-test-only';
process.env.CERT_ENCRYPTION_KEY = 'ai-settings-encryption-test-only';
delete process.env.OPENAI_API_KEY;
const rows = new Map();
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {
  contentStudioSettings: {
    findUnique: async ({ where }) => rows.get(where.accountingFirmId) || null,
    upsert: async ({ where, create, update }) => { const row = rows.get(where.accountingFirmId); const next = row ? { ...row, ...update } : { ...create }; rows.set(where.accountingFirmId, next); return next; },
    updateMany: async ({ where, data }) => { const row = rows.get(where.accountingFirmId); if (row) Object.assign(row, data); return { count: row ? 1 : 0 }; },
  },
  accountingFirm: { findUnique: async () => ({ name: 'Escritorio teste' }) },
} };
require('express-async-errors');
const express = require('express'), jwt = require('jsonwebtoken');
const { decrypt } = require('../src/utils/certCrypto');
let server, origin;
before(async () => {
  const app = express(); app.use(express.json()); app.use('/content', require('../src/routes/content.routes'));
  app.use((error, req, res, next) => res.status(error.status || 400).json({ error: error.message }));
  server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  origin = `http://127.0.0.1:${server.address().port}/content`;
});
after(async () => new Promise((resolve) => server.close(resolve)));
function call(path, { role = 'ADMIN', firm = 'office-a', method = 'GET', body } = {}) {
  return fetch(origin + path, { method, headers: { Authorization: `Bearer ${jwt.sign({ sub: 'user', role, accountingFirmId: firm }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test('only administrator can connect a key and the secret is never returned', async () => {
  const secret = 'sk-test-only-key-12345678901234567890';
  assert.equal((await call('/settings/ai', { role: 'ACCOUNTANT', method: 'PUT', body: { apiKey: secret } })).status, 403);
  const response = await call('/settings/ai', { method: 'PUT', body: { apiKey: secret } });
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes(secret));
  const stored = rows.get('office-a').apiKeyEncrypted;
  assert.notEqual(stored, secret);
  assert.equal(decrypt(stored).toString(), secret);
  const status = await call('/settings');
  const text = await status.text();
  assert.ok(!text.includes(secret)); assert.ok(!text.includes(stored));
  assert.equal(JSON.parse(text).configured, true);
  assert.equal((await (await call('/settings', { firm: 'office-b' })).json()).configured, false);
});
test('unconfigured offices cannot generate and clients cannot access the configuration', async () => {
  assert.equal((await call('/generate', { firm: 'office-b', method: 'POST', body: { topic: 'Rotina financeira', count: 1 } })).status, 409);
  assert.equal((await call('/settings', { role: 'CLIENT' })).status, 403);
});
test('removing an AI key preserves the studio logo', async () => {
  rows.get('office-a').logoUrl = 'data:image/png;base64,test';
  assert.equal((await call('/settings/ai', { method: 'DELETE' })).status, 200);
  assert.equal(rows.get('office-a').apiKeyEncrypted, null);
  assert.equal(rows.get('office-a').logoUrl, 'data:image/png;base64,test');
});
