const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const records = [];
const match = (item, where) => Object.entries(where).every(([key, value]) => item[key] === value);
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { contentProject: {
  findMany: async ({ where }) => records.filter((item) => match(item, where)),
  findFirst: async ({ where }) => records.find((item) => match(item, where)),
  create: async ({ data }) => { const item = { ...data, id: `project-${records.length}` }; records.push(item); return item; },
  updateMany: async ({ where, data }) => { const item = records.find((row) => match(row, where)); if (item) Object.assign(item, data); return { count: item ? 1 : 0 }; },
  deleteMany: async ({ where }) => { const index = records.findIndex((row) => match(row, where)); if (index >= 0) records.splice(index, 1); return { count: index >= 0 ? 1 : 0 }; },
} } };
process.env.JWT_SECRET = 'content-studio-test-only';
require('express-async-errors');
const express = require('express');
const jwt = require('jsonwebtoken');
let server, origin;
before(async () => {
  const app = express(); app.use(express.json()); app.use('/api/content', require('../src/routes/content.routes'));
  app.use((error, req, res, next) => res.status(error.name === 'ZodError' ? 400 : 500).json({ error: error.name }));
  server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  origin = `http://127.0.0.1:${server.address().port}/api/content`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });
const project = { title: 'Carrossel de teste', status: 'DRAFT', settings: { template: 'cover', accent: '#123456', fontSize: 82, caption: 'Legenda', slides: [{ eyebrow: 'Tema', headline: 'Meu negocio', body: 'Informacao', footer: 'Contato' }] } };
async function call(path = '', { role = 'ADMIN', firm = 'firm-a', method = 'GET', body, anonymous = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!anonymous) headers.Authorization = `Bearer ${jwt.sign({ sub: 'user', role, accountingFirmId: firm }, process.env.JWT_SECRET)}`;
  return fetch(origin + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test('only authenticated office staff can access content', async () => {
  assert.equal((await call('', { anonymous: true })).status, 401);
  assert.equal((await call('', { role: 'CLIENT' })).status, 403);
  assert.equal((await call('', { firm: '' })).status, 403);
  assert.equal((await call('', { role: 'ACCOUNTANT' })).status, 200);
});
test('saved content is scoped to its firm and survives reads and edits', async () => {
  const created = await call('', { method: 'POST', body: { ...project, accountingFirmId: 'firm-b' } });
  assert.equal(created.status, 201);
  const item = await created.json();
  assert.equal(item.accountingFirmId, 'firm-a');
  assert.equal((await (await call('', { firm: 'firm-b' })).json()).length, 0);
  assert.equal((await call(`/${item.id}`, { method: 'PUT', firm: 'firm-b', body: project })).status, 404);
  assert.equal((await call(`/${item.id}`, { method: 'DELETE', firm: 'firm-b' })).status, 404);
  const updated = await call(`/${item.id}`, { method: 'PUT', body: { ...project, title: 'Atualizado' } });
  assert.equal((await updated.json()).title, 'Atualizado');
  assert.equal((await (await call()).json())[0].settings.caption, 'Legenda');
});
test('rejects invalid templates, slide limits and unsafe color values', async () => {
  for (const settings of [{ ...project.settings, slides: [] }, { ...project.settings, slides: Array(11).fill(project.settings.slides[0]) }, { ...project.settings, template: 'unknown' }, { ...project.settings, accent: 'javascript:alert(1)' }]) {
    assert.equal((await call('', { method: 'POST', body: { ...project, settings } })).status, 400);
  }
});
test('staff can delete their own saved content', async () => {
  const [item] = await (await call()).json();
  assert.equal((await call(`/${item.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await (await call()).json()).length, 0);
});
test('white editorial layout and company profile persist in saved projects', async () => {
  const settings = { ...project.settings, background: 'white', profileHandle: '@youngcontabil' };
  const response = await call('', { method: 'POST', body: { ...project, settings } });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.settings.background, 'white');
  assert.equal(saved.settings.profileHandle, '@youngcontabil');
});
