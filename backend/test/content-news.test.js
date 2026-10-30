const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'news-content-test-only';
process.env.OPENAI_API_KEY = 'sk-test-never-sent';
const id = 'a4444444-4444-4444-8444-444444444444';
const article = { id, title: 'Orientacoes para pequenos negocios', summary: 'Organize os registros da empresa.', url: 'https://www.contabeis.com.br/noticias/12345/orientacoes-empresas/', publishedAt: new Date('2026-10-29T16:00:00Z'), source: { name: 'Portal Contabeis' } };
let calls = [];
const service = require('../src/services/contentAi.service');
service.generateContentWithAI = async (request) => { calls.push(request); return { title: 'Texto original', slides: [], caption: 'Legenda', sources: [{ title: 'Receita', url: 'https://www.gov.br/receitafederal/' }] }; };
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {
  contentStudioSettings: { findUnique: async () => null },
  accountingFirm: { findUnique: async () => ({ name: 'Young Contabil' }) },
  newsArticle: { findUnique: async ({ where }) => where.id === id ? article : null },
} };
require('express-async-errors');
const express = require('express'), jwt = require('jsonwebtoken');
let server, base;
before(async () => {
  const app = express(); app.use(express.json()); app.use('/content', require('../src/routes/content.routes'));
  app.use((error, req, res, next) => res.status(error.status || 400).json({ error: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}/content/generate`;
});
after(async () => new Promise(resolve => server.close(resolve)));
const call = body => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ sub: 'u', role: 'ADMIN', accountingFirmId: 'firm' }, process.env.JWT_SECRET) }, body: JSON.stringify({ topic: 'Tema editado', audience: 'MEIs', count: 1, ...body }) });
test('news generation uses server-side reference and always retains original attribution', async () => {
  const response = await call({ articleId: id, context: 'Pedido adicional do usuario' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(calls.at(-1).brief.context.includes(article.url));
  assert.ok(calls.at(-1).brief.context.includes(article.summary));
  assert.ok(calls.at(-1).brief.context.includes('Pedido adicional do usuario'));
  assert.equal(calls.at(-1).brief.audience, 'MEIs');
  assert.equal(result.sources[0].url, article.url);
  assert.equal(result.sources[1].url, 'https://www.gov.br/receitafederal/');
});
test('missing and invalid news IDs fail before calling the AI', async () => {
  const beforeCount = calls.length;
  assert.equal((await call({ articleId: 'a5555555-5555-4555-8555-555555555555' })).status, 404);
  assert.equal((await call({ articleId: 'invalid' })).status, 400);
  assert.equal(calls.length, beforeCount);
});
