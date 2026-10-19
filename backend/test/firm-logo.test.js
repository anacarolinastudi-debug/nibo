const { test } = require('node:test');
const assert = require('node:assert/strict');
const { logoDataUrl, resolveLogoSource, preserveFirmLogo } = require('../src/utils/firmLogo');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64');
test('uploaded logo remains a standalone image without server filesystem dependency', () => {
  const embedded = logoDataUrl(png);
  assert.ok(embedded.startsWith('data:image/png;base64,'));
  assert.equal(resolveLogoSource(embedded), embedded);
  assert.equal(resolveLogoSource('/uploads/missing-logo.jpeg'), '');
});
test('rejects non-image uploads and unsafe inline image sources', () => {
  assert.throws(() => logoDataUrl(Buffer.from('<html>not an image</html>')), /imagem/i);
  assert.equal(resolveLogoSource('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.equal(resolveLogoSource('data:image/png;base64,abc" onerror="alert(1)'), '');
});
test('existing embedded logo is preserved without a database rewrite', async () => {
  const firm = { id: 'firm', logoUrl: logoDataUrl(png) };
  assert.deepEqual(await preserveFirmLogo(firm, {}), firm);
});
