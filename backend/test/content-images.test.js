const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'image-test-only-secret';
const { searchImages, selectImage } = require('../src/services/contentImages.service');
const info = { mime: 'image/jpeg', width: 1200, height: 1800, thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Example.jpg/960px-Example.jpg', extmetadata: { Artist: { value: '<a>Photographer</a>' }, LicenseShortName: { value: 'CC BY 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' } } };
test('search returns reusable photos with office-bound selection and credits', async () => {
  const results = await searchImages('planejamento financeiro', 'office-a', { fetchImpl: async () => ({ ok: true, json: async () => ({ query: { pages: { 1: { pageid: 1234, title: 'File:Office.jpg', index: 1, imageinfo: [info] }, 2: { pageid: 2, title: 'File:Unsafe.jpg', imageinfo: [{ ...info, thumburl: 'http://127.0.0.1/secret' }] }, 3: { pageid: 3, title: 'File:Restricted.jpg', imageinfo: [{ ...info, extmetadata: { LicenseShortName: { value: 'All rights reserved' } } }] } } } }) }) });
  assert.equal(results.items.length, 1);
  assert.equal(results.items[0].creator, 'Photographer');
  assert.throws(() => require('jsonwebtoken').verify(results.items[0].token, process.env.JWT_SECRET), 'image tokens must never authenticate API requests');
  let called = false;
  await assert.rejects(selectImage(results.items[0].token, 'office-b', { fetchImpl: async () => { called = true; } }), /imagem|selecao/i);
  assert.equal(called, false);
  const bytes = Buffer.from([255, 216, 255, 224, 1, 2]);
  const selected = await selectImage(results.items[0].token, 'office-a', { fetchImpl: async () => ({ ok: true, headers: new Headers(), body: (async function* () { yield bytes; })() }) });
  assert.match(selected.dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(selected.sourceUrl, 'https://commons.wikimedia.org/?curid=1234');
});
test('manual searches preserve the requested subject; topic expansion is automatic-only', async () => {
  const queries = [];
  const fetchImpl = async url => { queries.push(new URL(url).searchParams.get('gsrsearch')); return { ok: true, json: async () => ({ query: { pages: {} } }) }; };
  await searchImages('empresa hospital', 'office', { fetchImpl });
  await searchImages('empresa restaurante', 'office', { fetchImpl });
  assert.match(queries[0], /empresa hospital/);
  assert.match(queries[1], /empresa restaurante/);
});
test('selection rejects oversized responses and non-raster images', async () => {
  const results = await searchImages('mesa', 'office', { fetchImpl: async () => ({ ok: true, json: async () => ({ query: { pages: { 1: { pageid: 1234, title: 'File:Office.jpg', imageinfo: [info] } } } }) }) });
  for (const response of [{ ok: true, headers: new Headers({ 'content-length': '99999999' }), body: { cancel: async () => {} } }, { ok: true, headers: new Headers(), body: (async function* () { yield Buffer.from('<svg onload="evil()"/>'); })() }]) {
    await assert.rejects(selectImage(results.items[0].token, 'office', { fetchImpl: async () => response }));
  }
});
