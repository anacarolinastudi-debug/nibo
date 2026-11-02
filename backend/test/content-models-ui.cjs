const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const JSZip = require('../../frontend/node_modules/jszip');
async function main() {
  const root = path.resolve(__dirname, '../../frontend/dist'), output = path.resolve(__dirname, '../../tmp/content-models');
  fs.mkdirSync(output, { recursive: true });
  const photoPath = path.resolve(__dirname, '../../tmp/photo-editorial/real-cover.jpg');
  const photo = fs.readFileSync(fs.existsSync(photoPath) ? photoPath : path.join(root, 'content/organic-navy-v1.png'));
  const photoData = `data:image/${fs.existsSync(photoPath) ? 'jpeg' : 'png'};base64,${photo.toString('base64')}`;
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname.startsWith('/assets/') || pathname.startsWith('/content/') ? path.join(root, pathname) : path.join(root, 'index.html');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' }[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1050 }, acceptDownloads: true }); page.setDefaultTimeout(12000);
    const errors = [], frames = []; let saved;
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      localStorage.setItem('token', 'test'); localStorage.setItem('user', JSON.stringify({ id: 'u', role: 'ADMIN' }));
      const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, text = proto.fillText, image = proto.drawImage;
      proto.clearRect = function(...args) { if (this.canvas.width === 1080) { window.mainTexts = []; window.mainImages = []; } return clear.apply(this, args); };
      proto.fillText = function(value, x, y, ...args) { if (this.canvas.width === 1080) (window.mainTexts ||= []).push({ text: value, x, y, width: this.measureText(value).width, font: this.font }); return text.call(this, value, x, y, ...args); };
      proto.drawImage = function(value, ...args) { if (this.canvas.width === 1080) (window.mainImages ||= []).push(value.src || ''); return image.call(this, value, ...args); };
    });
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()); let data = [];
      if (url.pathname.endsWith('/auth/me')) data = { id: 'u', role: 'ADMIN' };
      if (url.pathname.endsWith('/firm')) data = { name: 'Young Contábil' };
      if (url.pathname.endsWith('/content/settings')) data = { configured: true };
      if (url.pathname.endsWith('/content/images/search')) data = { items: [{ id: '1', title: 'Foto editorial', url: 'https://upload.wikimedia.org/test.jpg', sourceUrl: 'https://commons.wikimedia.org/?curid=1', token: 'test' }] };
      if (url.pathname.endsWith('/content/images/select')) data = { dataUrl: photoData, title: 'Foto editorial', creator: 'Kecko', license: 'CC BY 2.0', sourceUrl: 'https://commons.wikimedia.org/?curid=1', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' };
      if (url.pathname.endsWith('/content') || url.pathname.endsWith('/content/matrix')) {
        if (['POST', 'PUT'].includes(req.method())) data = saved = { ...req.postDataJSON(), id: 'matrix', updatedAt: new Date().toISOString() };
        else data = saved ? [saved] : [];
      }
      await route.fulfill({ json: data });
    });
    await page.route('https://upload.wikimedia.org/**', route => route.fulfill({ body: photo, contentType: 'image/jpeg' }));
    await page.goto(`http://127.0.0.1:${server.address().port}/conteudos`);
    await page.getByRole('button', { name: 'Carrossel', exact: true }).click();
    await page.getByLabel(/^Nome do conteúdo/).fill('Matriz de modelos');
    const prepare = async () => {
      await page.getByLabel(/^Título do slide/).fill('Planejamento financeiro para crescer com segurança');
      await page.getByLabel(/^Texto de apoio/).fill('Separe as finanças pessoais e da empresa. Acompanhe receitas e despesas e converse com sua contabilidade para tomar decisões com mais clareza.');
      await page.getByLabel(/^Rodapé/).fill('Converse com nossa equipe');
    };
    await prepare();
    const capture = async (background, template, internal = false) => {
      await page.getByLabel(/^Modelo visual/).selectOption(template);
      try { await page.waitForFunction(({ background, template, internal }) => {
        const c = document.querySelector('canvas'); if (!c || !window.mainTexts) return false;
        const heading = window.mainTexts.find(item => item.text === (template === 'tip' ? 'PLANEJAMENTO' : 'Planejamento'));
        const weight = template === 'quote' ? '400 ' : template === 'cover' && ['organic', 'plain'].includes(background) ? '700 ' : '800 ';
        if (!heading) return false;
        const actualWeight = /^(\d+|bold) /.exec(heading.font)?.[1] || '400';
        if ((actualWeight === 'bold' ? '700' : actualWeight) !== weight.trim()) return false;
        if (background === 'plain' && window.mainImages?.length) return false;
        if (background === 'photo' && !internal && !window.mainImages?.some(url => url.startsWith('data:image/jpeg'))) return false;
        const red = c.getContext('2d').getImageData(1070, 700, 1, 1).data[0];
        return background === 'white' ? red === 255 : red < 70;
      }, { background, template, internal }); } catch (error) { console.error(JSON.stringify({ background, template, internal, state: await page.evaluate(() => ({ texts: window.mainTexts, images: window.mainImages?.map(value => value.slice(0, 80)), pixel: Array.from(document.querySelector('canvas').getContext('2d').getImageData(1070, 700, 1, 1).data) })) })); throw error; }
      const state = await page.locator('canvas').first().evaluate(c => ({ data: c.toDataURL(), texts: window.mainTexts, images: window.mainImages }));
      for (const text of state.texts) {
        assert.ok(text.x >= -1 && text.x + text.width <= 1081, `${background}/${template}: horizontal overflow`);
        const size = Number(text.font.match(/([\d.]+)px/)[1]);
        assert.ok(text.y >= 0 && text.y + size <= 1350, `${background}/${template}: vertical overflow`);
      }
      const label = `${background}${internal ? '-internal' : ''}-${template}`;
      fs.writeFileSync(path.join(output, label + '.png'), Buffer.from(state.data.split(',')[1], 'base64'));
      frames.push({ label, data: state.data });
    };
    for (const background of ['organic', 'plain', 'white', 'photo']) {
      await page.getByLabel(/^Fundo/).selectOption(background);
      if (background === 'photo') await page.getByRole('radio', { name: 'Lateral da capa: Azul', exact: true }).check();
      for (const template of ['cover', 'tip', 'quote']) await capture(background, template);
    }
    assert.equal(new Set(frames.map(frame => frame.data)).size, 12);
    await page.getByRole('radio', { name: 'Demais páginas: Azul', exact: true }).check();
    await page.getByRole('button', { name: 'Selecionar slide 2', exact: true }).click(); await prepare();
    for (const template of ['cover', 'tip', 'quote']) await capture('photo', template, true);
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Salvar')?.disabled);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    assert.equal(saved.settings.template, 'quote'); assert.equal(saved.settings.background, 'photo');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar carrossel ZIP', exact: true }).click();
    const zip = await JSZip.loadAsync(fs.readFileSync(await (await download).path()));
    assert.equal(Object.keys(zip.files).filter(name => name.endsWith('.png')).length, 5);
    await page.reload(); await page.getByRole('button', { name: 'Biblioteca', exact: true }).click(); await page.getByRole('button', { name: 'Abrir Matriz de modelos', exact: true }).click();
    assert.equal(await page.getByLabel(/^Modelo visual/).inputValue(), 'quote');
    await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1200, height: 1100 });
    await page.evaluate(frames => {
      document.body.replaceChildren(); const gallery = document.createElement('main'); gallery.style.cssText = 'display:grid;grid-template-columns:repeat(3,340px);gap:24px;padding:24px;background:#edf1f4;font:16px Arial';
      for (const frame of frames) { const figure = document.createElement('figure'); figure.style.margin = '0'; const image = document.createElement('img'); image.src = frame.data; image.style.cssText = 'width:340px;height:425px;display:block'; const caption = document.createElement('figcaption'); caption.textContent = frame.label; figure.append(image, caption); gallery.append(figure); } document.body.append(gallery);
    }, frames);
    await page.screenshot({ path: path.join(output, 'all-models.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: 12 distinct style/model combinations, 3 photo internal variants, real-font bounds, durable selection, ZIP and mobile');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
