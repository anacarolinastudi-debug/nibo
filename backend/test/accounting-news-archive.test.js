const test = require('node:test');
const assert = require('node:assert/strict');
const { searchArchive } = require('../src/services/accountingNewsArchive.service');
const { SOURCES } = require('../src/data/accountingNewsSources');
const source = SOURCES.find(value => value.id === 'portal-contabeis');
const url = 'https://www.contabeis.com.br/noticias/77801/cnpj-tecnico-tudo-sobre-a-exigencia-para-autonomos-e-pf/';
test('historical query finds older portal news from publisher sitemap and real metadata', async () => {
  const calls = [];
  const items = await searchArchive({ input: { q: 'CNPJ t\u00e9cnico' }, sources: [source], fetchText: async request => {
    calls.push(request.feedUrl);
    if (request.feedUrl.endsWith('/sitemap.xml')) return { body: '<sitemapindex><sitemap><loc>https://www.contabeis.com.br/assets/sitemap/sitemap_ctd7.xml</loc></sitemap><sitemap><loc>https://evil.test/sitemap_ctd8.xml</loc></sitemap></sitemapindex>' };
    if (request.feedUrl.endsWith('sitemap_ctd7.xml')) return { body: `<urlset><url><loc>${url}</loc></url><url><loc>https://www.contabeis.com.br/forum/12345/cnpj-tecnico/</loc></url></urlset>` };
    assert.equal(request.feedUrl, url);
    return { url, body: '<meta property="og:title" content="CNPJ T\u00e9cnico: Tudo sobre a exig\u00eancia"><meta name="description" content="Orienta\u00e7\u00f5es para aut\u00f4nomos."><meta property="article:published_time" content="2026-07-01T20:00:01-03:00">' };
  } });
  assert.equal(items.length, 1);
  assert.equal(items[0].item.url, url);
  assert.equal(items[0].item.title, 'CNPJ T\u00e9cnico: Tudo sobre a exig\u00eancia');
  assert.equal(items[0].item.publishedAt.toISOString(), '2026-07-01T23:00:01.000Z');
  assert.equal(calls.length, 3);
});
test('archive does not call unrelated sources or search blank terms', async () => {
  const fetchText = async () => { throw new Error('Must not fetch'); };
  assert.deepEqual(await searchArchive({ input: { q: 'cnpj' }, sources: [], fetchText }), []);
  assert.deepEqual(await searchArchive({ input: { q: '!!!' }, sources: [source], fetchText }), []);
});
