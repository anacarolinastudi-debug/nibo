const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractMetadata, matchingSource, discoverLinks, resolveCandidate, searchKey } = require('../src/services/accountingNewsOnline.service');
const { SOURCES } = require('../src/data/accountingNewsSources');
const portal = SOURCES.find(source => source.id === 'portal-contabeis');
const url = 'https://www.contabeis.com.br/noticias/12345/rotina-das-empresas/';
test('only registered HTTPS article URLs are accepted, not arbitrary hosts or forum pages', () => {
  assert.equal(matchingSource(url, [portal]).id, portal.id);
  for (const invalid of ['http://127.0.0.1/test', 'https://evil.test/noticias/article-long', 'https://user:pass@www.contabeis.com.br/noticias/article-long', 'https://www.contabeis.com.br/forum/12345/article-long']) assert.equal(matchingSource(invalid, [portal]), undefined);
});
test('live publisher metadata, not AI text, supplies title/excerpt/date', () => {
  const html = '<html><head><meta property="og:title" content="Organizacao fiscal para pequenos negocios"><meta name="description" content="Orientacoes para empresas."><meta property="article:published_time" content="2026-10-29T14:00:00-03:00"></head><body><script>alert(1)</script></body></html>';
  const item = extractMetadata(html, url, portal);
  assert.equal(item.title, 'Organizacao fiscal para pequenos negocios');
  assert.equal(item.summary, 'Orientacoes para empresas.');
  assert.equal(item.publishedAt.toISOString(), '2026-10-29T17:00:00.000Z');
  assert.equal(extractMetadata('<title>Organizacao fiscal para pequenos negocios</title>', url, portal).publishedAt, null);
  assert.equal(extractMetadata('<title>Just a moment...</title>', url, portal), null);
});
test('Google grounding redirects can only lead to approved article URLs', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return { status: 302, headers: new Headers({ location: 'http://127.0.0.1/secrets' }), body: { cancel: async () => {} } }; };
  assert.equal(await resolveCandidate('https://vertexaisearch.cloud.google.com/grounding-api-redirect/token', [portal], fetcher), null);
  assert.equal(calls, 1);
  assert.equal(await resolveCandidate('https://evil.test/redirect', [portal], fetcher), null);
  assert.equal(calls, 1);
});
test('Gemini discovery uses real search metadata, never model-invented URLs', async () => {
  let payload;
  const result = await discoverLinks({ provider: 'gemini', apiKey: 'test-never-sent', input: { q: 'rotina fiscal' }, sources: [portal], fetchImpl: async (endpoint, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ groundingMetadata: { webSearchQueries: ['rotina fiscal'], groundingChunks: [...Array.from({ length: 7 }, (_, i) => ({ web: { uri: 'https://evil.test/unrelated-' + i } })), { web: { uri: url } }], searchEntryPoint: { renderedContent: '<div>Google</div>' } }, content: { parts: [{ text: 'https://evil.test/invented' }] } }] }) };
  } });
  assert.deepEqual(result.links, [url]); assert.ok(payload.tools[0].google_search);
  assert.equal(result.attribution, '<div>Google</div>');
});
test('quota errors are actionable and never leak provider credentials', async () => {
  await assert.rejects(discoverLinks({ provider: 'gemini', apiKey: 'test-secret-key', input: { q: 'mei' }, sources: [portal], fetchImpl: async () => ({ ok: false, status: 429 }) }), error => error.status === 429 && /cota/i.test(error.message) && !error.message.includes('test-secret-key'));
});
test('search cache keys separate offices and filters without storing the query', () => {
  assert.notEqual(searchKey('a', { q: 'mei', kind: 'NEWS' }), searchKey('b', { q: 'mei', kind: 'NEWS' }));
  assert.notEqual(searchKey('a', { q: 'mei' }), searchKey('a', { q: 'mei', source: 'portal-contabeis' }));
  assert.ok(!searchKey('a', { q: 'private-query' }).includes('private-query'));
});
