const test = require('node:test');
const assert = require('node:assert/strict');
const { discoverLinks } = require('../src/services/accountingNewsOnline.service');

test('search collects registered feeds directly without an AI account', async () => {
  const source = { id: 'fixture', url: 'https://example.org/', kind: 'NEWS' };
  const item = { url: 'https://example.org/news/1', title: 'Noticia de teste contabilidade' };
  const result = await discoverLinks({ sources: [source], fetcher: async value => {
    assert.equal(value.id, source.id);
    return [item];
  } });
  assert.deepEqual(result.items, [{ source, item }]);
  assert.equal(result.attribution, null);
});

test('source failures preserve successful direct results', async () => {
  const result = await discoverLinks({ sources: [{ id: 'bad' }, { id: 'good' }], fetcher: async source => {
    if (source.id === 'bad') throw new Error('Unavailable');
    return [{ url: 'https://example.org/news/2', title: 'Noticia' }];
  } });
  assert.equal(result.failed, 1);
  assert.equal(result.items.length, 1);
});
