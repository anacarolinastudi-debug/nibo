const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFeed, parsePage, articleUrl, classifyArea, parseDate } = require('../src/services/accountingNewsParser');
const source = { id: 'receita', name: 'Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/', allowedHosts: ['www.gov.br'], articlePrefixes: ['/receitafederal/pt-br/assuntos/noticias/'], scope: 'FEDERAL', uf: null, kind: 'NEWS', area: 'FISCAL' };
const now = new Date('2026-10-29T16:00:00Z');
test('RSS metadata is deduplicated, strips executable HTML, and preserves the actual date', () => {
  const xml = `<rss><channel><item><title>Atualizacao do Simples Nacional para empresas</title><link>${source.url}2026/outubro/simples?utm_source=email</link><description><![CDATA[<p>Orientacoes para empresas.</p><script>alert(1)</script>]]></description><pubDate>Thu, 29 Oct 2026 10:00:00 -0400</pubDate></item><item><title>Duplicada</title><link>${source.url}2026/outubro/simples</link></item><item><title>Foto</title><link>${source.url}foto.jpg</link></item></channel></rss>`;
  const articles = parseFeed(xml, source, now);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].summary, 'Orientacoes para empresas.');
  assert.equal(articles[0].area, 'SIMPLES_NACIONAL');
  assert.equal(articles[0].publishedAt.toISOString(), '2026-10-29T14:00:00.000Z');
  assert.ok(!articles[0].url.includes('utm_source'));
});
test('untrusted links, entity declarations and oversized inputs are rejected', () => {
  for (const url of ['http://www.gov.br/receitafederal/pt-br/assuntos/noticias/a', 'https://evil.test/noticias/a', 'https://www.gov.br.evil.test/noticias/a', 'https://user:pass@www.gov.br/receitafederal/pt-br/assuntos/noticias/a', 'https://www.gov.br/another-service/a', 'javascript:alert(1)']) assert.equal(articleUrl(url, source), null);
  assert.throws(() => parseFeed('<!DOCTYPE x [<!ENTITY foo "bar">]><rss/>', source), /declar/i);
  assert.throws(() => parseFeed('x'.repeat(3 * 1024 * 1024), source), /tamanho/i);
});
test('HTML uses listing metadata and never invents missing publication dates', () => {
  const html = `<main><article><h2><a href="${source.url}2026/nova-regra-empresas">Novas orientacoes para empresas sobre a reforma tributaria</a></h2><time datetime="2026-10-28T09:00:00-04:00"></time><p class="description">Confira a publicacao original.</p></article><article><h3><a href="${source.url}outra-atualizacao-importante">Orientacoes para contribuintes de todo o pais</a></h3></article></main>`;
  const items = parsePage(html, source, now);
  assert.equal(items.length, 2);
  assert.equal(items[0].area, 'REFORMA_TRIBUTARIA');
  assert.equal(items[1].publishedAt, null);
});
test('dates and subject classifications are deterministic, not legal interpretations', () => {
  assert.equal(parseDate('29/10/2026', now).toISOString(), '2026-10-29T16:00:00.000Z');
  assert.equal(parseDate('31/02/2026', now), null);
  assert.equal(parseDate('01/01/2028', now), null);
  assert.equal(classifyArea('eSocial e folha de pagamento', 'GERAL'), 'TRABALHISTA');
});
test('article headers are preserved and Portuguese listing dates are recognized', () => {
  const items = parsePage(`<main><article><header><h2><a href="${source.url}2026/titulo-publicacao-oficial">Publicacao oficial importante para os contribuintes</a></h2></header><div>28 de Outubro de 2026 as 17:01</div></article></main>`, source, now);
  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt.toISOString(), '2026-10-28T16:00:00.000Z');
});
