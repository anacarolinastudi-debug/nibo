require('dotenv').config({ path: '.env.development.local', override: true });
const assert = require('node:assert/strict');
assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1', 'Integration test requires isolated local database');
require('express-async-errors');
const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('../src/lib/prisma');
const { generateToken } = require('../src/utils/jwt');
const service = require('../src/services/accountingNews.service');
service.requestSync = async () => ({ state: 'IDLE', queued: false });
async function main() {
  const suffix = randomUUID(), firmIds = [], users = [], articles = [];
  let server;
  const sourceId = 'test-' + suffix;
  const preferredId = 'test-preferred-' + suffix;
  try {
    for (let i = 0; i < 2; i++) {
      const firm = await db.accountingFirm.create({ data: { name: 'News test', cnpj: suffix + i, email: 'test@example.invalid' } }); firmIds.push(firm.id);
      const user = await db.user.create({ data: { name: 'News test', email: suffix + i + '@example.invalid', role: 'ACCOUNTANT', passwordHash: 'not-a-real-password', accountingFirmId: firm.id } }); users.push(user);
    }
    await db.newsSource.create({ data: { id: sourceId, name: 'Test official source', url: 'https://www.gov.br/', scope: 'FEDERAL' } });
    await db.newsSource.create({ data: { id: preferredId, name: 'Preferred editorial source', url: 'https://www.contabeis.com.br/noticias/', scope: 'NACIONAL', priority: 100 } });
    for (let i = 0; i < 2; i++) articles.push(await db.newsArticle.create({ data: { sourceId, url: 'https://www.gov.br/test-' + suffix + i, title: 'Publicacao teste ' + i, summary: 'Resumo', kind: 'NEWS', area: 'FISCAL', scope: 'FEDERAL', publishedAt: new Date(`2026-10-${i + 20}T16:00:00Z`) } }));
    const app = express(); app.use(express.json()); app.use('/api/updates', require('../src/routes/updates.routes')); app.use(require('../src/middleware/errorHandler'));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/updates`;
    const auth = (index, extra = {}) => ({ Authorization: 'Bearer ' + generateToken({ sub: users[index].id, accountingFirmId: firmIds[index], role: 'ACCOUNTANT', ...extra }), 'Content-Type': 'application/json' });
    assert.equal((await fetch(base + '/articles')).status, 401);
    assert.equal((await fetch(base + '/articles/' + articles[0].id)).status, 401);
    const detail = await fetch(base + '/articles/' + articles[0].id, { headers: auth(0) });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).title, articles[0].title);
    assert.equal((await fetch(base + '/articles/not-a-uuid', { headers: auth(0) })).status, 400);
    assert.equal((await fetch(base + '/articles/a5555555-5555-4555-8555-555555555555', { headers: auth(0) })).status, 404);
    assert.equal((await fetch(base + '/articles', { headers: auth(0, { role: 'CLIENT' }) })).status, 403);
    assert.equal((await fetch(base + '/articles', { headers: auth(0, { accountingFirmId: firmIds[1] }) })).status, 403);
    const marked = await fetch(base + '/articles/' + articles[0].id + '/state', { method: 'PATCH', headers: auth(0), body: JSON.stringify({ read: true, bookmarked: true }) }); assert.equal(marked.status, 200);
    const get = async (index, query) => (await fetch(base + '/articles?source=' + sourceId + '&' + query, { headers: auth(index) })).json();
    assert.equal((await get(0, 'bookmarked=true')).total, 1);
    assert.equal((await get(1, 'bookmarked=true')).total, 0);
    assert.equal((await get(0, 'read=unread')).total, 1);
    assert.equal((await get(1, 'read=unread')).total, 2);
    assert.equal((await get(0, 'from=2026-10-21&to=2026-10-21')).total, 1);
    const prefix = 'ordering-' + suffix;
    await db.newsArticle.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ sourceId: preferredId, url: 'https://www.contabeis.com.br/noticias/test-' + suffix + i, title: prefix + ' preferred ' + i, summary: 'Resumo', kind: 'NEWS', area: 'FISCAL', scope: 'NACIONAL', publishedAt: new Date('2026-10-01T16:00:00Z'), sortDate: new Date(Date.UTC(2026, 9, 1, 16, i)) })) });
    await db.newsArticle.create({ data: { sourceId, url: 'https://www.gov.br/test-newer-' + suffix, title: prefix + ' newer official', summary: 'Resumo', kind: 'NEWS', area: 'FISCAL', scope: 'FEDERAL', publishedAt: new Date('2026-10-29T16:00:00Z'), sortDate: new Date('2026-10-29T16:00:00Z') } });
    const ordered = async query => (await fetch(base + '/articles?q=' + prefix + '&' + query, { headers: auth(0) })).json();
    const first = await ordered('page=1');
    assert.equal(first.total, 27);
    assert.ok(first.items.every(item => item.source.id === preferredId), 'preferred source comes before newer official articles across pages');
    const second = await ordered('page=2');
    assert.deepEqual(second.items.map(item => item.source.id), [preferredId, sourceId]);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 27);
    assert.ok(new Date(first.items[0].publishedAt) <= new Date(second.items[1].publishedAt));
    assert.equal((await ordered('source=' + sourceId)).items[0].source.id, sourceId, 'explicit source filters still win');
    assert.equal((await ordered('from=2026-10-29&to=2026-10-29')).items[0].source.id, sourceId, 'date filters still win');
    assert.equal((await fetch(base + '/articles?from=2026-02-31', { headers: auth(0) })).status, 400);
    await db.user.update({ where: { id: users[1].id }, data: { active: false } });
    assert.equal((await fetch(base + '/status', { headers: auth(1) })).status, 403);
    console.log('PASS: authentication, inactive accounts, firm isolation, personal marks, date filters and validation');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.newsArticle.deleteMany({ where: { sourceId: { in: [sourceId, preferredId] } } });
    await db.newsSource.deleteMany({ where: { id: { in: [sourceId, preferredId] } } });
    await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await db.accountingFirm.deleteMany({ where: { id: { in: firmIds } } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
