const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryTerms, searchKey, cachedSearch } = require('../src/services/accountingNewsOnline.service');
test('query normalization ignores accents, case, punctuation and duplicate terms', () => {
  assert.deepEqual(queryTerms('TÉCNICO, CNPJ técnico'), ['tecnico', 'cnpj']);
});
test('search cache keys separate offices and filters without storing the query', () => {
  assert.notEqual(searchKey('a', { q: 'mei' }), searchKey('b', { q: 'mei' }));
  assert.notEqual(searchKey('a', { q: 'mei' }), searchKey('a', { q: 'mei', source: 'portal-contabeis' }));
  assert.ok(!searchKey('a', { q: 'private-query' }).includes('private-query'));
});
test('old AI cache is not used by direct search', async () => {
  let where;
  await cachedSearch('a', { q: 'mei' }, { newsOnlineSearch: { findFirst: async input => { where = input.where; return null; } } });
  assert.equal(where.provider, 'DIRECT');
  assert.equal(where.accountingFirmId, 'a');
});
