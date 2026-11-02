const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.resolve(__dirname, '../../frontend/src/utils/contentCanvas.js'), 'utf8')).toString('base64'));
async function render(index, extra = {}, background = 'photo') {
  const { drawContent } = await modulePromise;
  const texts = [], fills = [];
  const ctx = { setTransform() {}, clearRect() {}, fillRect(...rect) { fills.push({ color: this.fillStyle, rect }); }, measureText: text => ({ width: text.length * 12 }), fillText(text, x, y) { texts.push({ text, x, y, color: this.fillStyle, font: this.font }); } };
  const slide = { eyebrow: 'ETIQUETA', headline: 'Organize seu negocio', body: 'Converse com sua contabilidade.', footer: 'Contato', highlight: '' };
  drawContent({ width: 1080, height: 1350, getContext: () => ctx }, { background, template: 'cover', fontSize: 82, accent: '#63b0ff', profileHandle: '@perfilteste', slides: [slide, slide], ...extra }, index, 'MarcaTeste');
  return { texts, fills };
}
test('cover uses the same Montserrat title weight and independent brand blue/white panel', async () => {
  for (const [photoPanel, color, ink] of [['white', '#ffffff', '#17191c'], ['blue', '#051d40', '#ffffff']]) {
    const result = await render(0, { photoPanel, photoPages: photoPanel === 'blue' ? 'white' : 'blue' });
    assert.equal(result.fills[0].color, color);
    const headline = result.texts.find(item => item.text === 'Organize');
    assert.match(headline.font, /^800 .*Montserrat/);
    assert.equal(headline.color, ink);
  }
});
test('internal photo slides have no logo/name/profile header and use the selected palette', async () => {
  for (const [photoPages, color, ink] of [['white', '#ffffff', '#17191c'], ['blue', '#051d40', '#ffffff']]) {
    const result = await render(1, { photoPages, photoPanel: photoPages === 'blue' ? 'white' : 'blue' });
    assert.equal(result.fills[0].color, color);
    assert.ok(!result.texts.some(item => item.text === 'MarcaTeste' || item.text === '@perfilteste'));
    assert.equal(result.texts.find(item => item.text === 'Organize').color, ink);
    assert.ok(result.texts.find(item => item.text === 'Organize').y < 350);
  }
});
test('the existing standalone white theme keeps its branding header', async () => {
  const result = await render(1, {}, 'white');
  assert.ok(result.texts.some(item => item.text === 'MarcaTeste'));
  assert.ok(result.texts.some(item => item.text === '@perfilteste'));
});
