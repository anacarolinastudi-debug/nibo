const test = require('node:test');
const assert = require('node:assert/strict');
const { researchOfficialSources } = require('../src/services/contentOfficialResearch.service');
test('research returns only matching official metadata without AI calls or private context', async () => {
  const item = { title: 'CNPJ tecnico e cadastro fiscal', summary: 'Orientacoes cadastrais.', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/cnpj-tecnico', publishedAt: null };
  const result = await researchOfficialSources({ topic: 'CNPJ Tecnico: Tudo sobre a exigencia', db: { newsArticle: { findMany: async () => [item, { ...item, url: 'https://evil.test/noticia' }] } }, fetcher: async () => [] });
  assert.equal(result.references.length, 1);
  assert.equal(result.references[0].url, item.url);
  assert.equal(result.status, 'FOUND');
});
test('missing evidence and unavailable sources are explicit, not a generation error', async () => {
  const result = await researchOfficialSources({ topic: 'Tema inexistente', db: { newsArticle: { findMany: async () => [] } }, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.references.length, 0);
});
