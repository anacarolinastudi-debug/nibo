const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.resolve(__dirname, '../../frontend/src/utils/contentCanvas.js'), 'utf8')).toString('base64'));
async function render(background, template, index = 0, body = 'Uma rotina financeira mais clara.') {
  const { drawContent } = await modulePromise;
  const texts = [], fills = [];
  const ctx = { setTransform() {}, clearRect() {}, fillRect(...rect) { fills.push({ color: this.fillStyle, rect }); }, measureText: text => ({ width: text.length * 12 }), fillText(text, x, y) { texts.push({ text, x, y, color: this.fillStyle, font: this.font }); } };
  const slide = { eyebrow: 'GUIA', headline: 'Organize seu negocio', body, footer: 'Converse com a equipe', highlight: '' };
  drawContent({ width: 1080, height: 1350, getContext: () => ctx }, { background, template, fontSize: 82, accent: '#63b0ff', photoPanel: 'blue', photoPages: 'blue', slides: [slide, slide] }, index, 'Marca');
  return { texts, fills };
}
test('newline-heavy quotes stay inside their allocated reading area without losing words', async () => {
  for (const [background, index, top, bottom] of [['plain', 0, 335, 1015], ['white', 0, 410, 1100], ['photo', 0, 385, 1125], ['photo', 1, 245, 1095]]) {
    const result = await render(background, 'quote', index, 'Linha\n'.repeat(60));
    const content = result.texts.filter(item => ['Organize', 'Linha'].includes(item.text));
    assert.equal(content.filter(item => item.text === 'Linha').length, 60);
    assert.ok(content.every(item => item.y >= top && item.y + Number(item.font.match(/([\d.]+)px/)[1]) <= bottom), `${background}: quote escaped its text region`);
  }
});
for (const [background, index] of [['organic', 0], ['plain', 0], ['white', 0], ['photo', 0], ['photo', 1]]) {
  test(`${background} slide ${index + 1}: all three visual models are distinct and preserve text`, async () => {
    const models = await Promise.all(['cover', 'tip', 'quote'].map(template => render(background, template, index)));
    assert.equal(new Set(models.map(model => JSON.stringify(model))).size, 3);
    for (const model of models) {
      const text = model.texts.map(item => item.text).join('').toLowerCase();
      assert.ok(text.includes('organize seu negocio'));
      assert.ok(text.includes('uma rotina financeira mais clara.'));
    }
    assert.ok(models[1].texts.some(item => item.text === 'ORGANIZE'));
    assert.ok(models[2].texts.filter(item => item.text === 'Organize').every(item => item.font.startsWith('400 ')));
  });
}
