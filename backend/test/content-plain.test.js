const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('plain blue omits branding and page counts and centers the Instagram footer', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/utils/contentCanvas.js'), 'utf8');
  const { drawContent } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const texts = [], images = [];
  const ctx = { setTransform() {}, clearRect() {}, fillRect() {}, measureText: (text) => ({ width: text.length * 12 }), fillText: (text, x, y) => texts.push({ text, x, y }), drawImage: (...args) => images.push(args) };
  const slide = { eyebrow: '', headline: 'Uma frase para sua empresa', body: '', footer: 'RODAPE ANTIGO' };
  drawContent({ width: 1080, height: 1350, getContext: () => ctx }, { background: 'plain', template: 'quote', accent: '#63b0ff', fontSize: 82, slides: [slide, slide] }, 1, 'Young Contabil', { naturalWidth: 100 }, null);
  assert.equal(images.length, 0);
  assert.ok(!texts.some(({ text }) => text.includes('ANTIGO') || text.includes('/') || text.includes('Young')));
  const footer = texts.find(({ text }) => text === '@youngcontabil');
  assert.ok(footer);
  assert.equal(footer.x + '@youngcontabil'.length * 12 / 2, 540);
  assert.equal(footer.y, 1250);
});
