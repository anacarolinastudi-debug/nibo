const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const JSZip = require('../../frontend/node_modules/jszip');
async function main() {
  const root = path.resolve(__dirname, '../../frontend/dist'), output = path.resolve(__dirname, '../../tmp/photo-editorial');
  const photo = fs.readFileSync(path.join(output, 'real-cover.jpg'));
  const embedded = 'data:image/jpeg;base64,' + photo.toString('base64');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname.startsWith('/assets/') || pathname.startsWith('/content/') ? path.join(root, pathname) : path.join(root, 'index.html');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' }[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1050 }, acceptDownloads: true }); page.setDefaultTimeout(12000);
    const errors = [], searches = [], automaticFlags = []; let saved, saveDelay = 0, selectDelay = 0;
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.addInitScript(() => { localStorage.setItem('token', 'test'); localStorage.setItem('user', JSON.stringify({ id: 'u', role: 'ADMIN' })); });
    const options = [1, 2].map(id => ({ id: String(id), title: 'Foto editorial ' + id, url: 'https://upload.wikimedia.org/test-' + id + '.jpg', token: 'token-' + id, creator: 'Kecko', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', sourceUrl: 'https://commons.wikimedia.org/?curid=' + id }));
    await page.route('https://upload.wikimedia.org/**', route => route.fulfill({ body: photo, contentType: 'image/jpeg' }));
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()); let data = [];
      if (url.pathname.endsWith('/auth/me')) data = { id: 'u', role: 'ADMIN' };
      if (url.pathname.endsWith('/firm')) data = { name: 'Young Contábil' };
      if (url.pathname.endsWith('/content/settings')) data = { configured: true };
      if (url.pathname.endsWith('/content/settings/logo')) { await new Promise(resolve => setTimeout(resolve, 1400)); data = { logoUrl: embedded }; }
      if (url.pathname.endsWith('/content/images/search')) { searches.push(url.searchParams.get('q')); automaticFlags.push(url.searchParams.get('automatic')); data = { items: options }; }
      if (url.pathname.endsWith('/content/images/select')) { if (selectDelay) await new Promise(resolve => setTimeout(resolve, selectDelay)); const id = req.postDataJSON().token.endsWith('2') ? 1 : 0; const { token, id: unused, url: unusedUrl, ...meta } = options[id]; data = { ...meta, dataUrl: embedded }; }
      if (url.pathname.endsWith('/content') || url.pathname.endsWith('/content/photo-saved')) {
        if (req.method() === 'POST' || req.method() === 'PUT') { saved = { ...req.postDataJSON(), id: 'photo-saved', updatedAt: new Date().toISOString() }; data = saved; if (saveDelay) await new Promise(resolve => setTimeout(resolve, saveDelay)); }
        else data = saved ? [saved] : [];
      }
      await route.fulfill({ json: data });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/conteudos`);
    await page.getByRole('button', { name: 'Carrossel', exact: true }).click();
    await page.getByLabel(/^Título do slide/).fill('Planejamento financeiro para crescer com segurança');
    await page.getByLabel(/^Texto de apoio/).fill('');
    await page.getByLabel(/^Fundo/).selectOption('photo');
    await page.getByRole('button', { name: 'Outra imagem', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Salvar', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Salvar')?.disabled);
    const canvas = page.locator('canvas').first();
    await page.waitForFunction(() => document.querySelector('canvas').getContext('2d').getImageData(1000, 300, 1, 1).data[0] === 206);
    const pixels = await canvas.evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, 540, 1150).data, colors = new Set();
      for (let i = 0; i < d.length; i += 127 * 4) colors.add(`${d[i]},${d[i+1]},${d[i+2]}`);
      return { colors: colors.size, font: c.getContext('2d').font };
    });
    assert.ok(pixels.colors > 30, 'real photo must render on cover'); assert.match(pixels.font, /Montserrat/);
    fs.writeFileSync(path.join(output, 'cover.png'), Buffer.from((await canvas.evaluate(c => c.toDataURL())).split(',')[1], 'base64'));
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    assert.equal(automaticFlags[0], 'true');
    await page.getByRole('textbox', { name: 'Buscar imagem', exact: true }).fill('empresa hospital');
    await page.getByRole('button', { name: 'Buscar imagem', exact: true }).click();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Salvar')?.disabled);
    assert.equal(searches.at(-1), 'empresa hospital'); assert.equal(automaticFlags.at(-1), 'false');
    await page.getByRole('button', { name: 'Outra imagem', exact: true }).click();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Salvar')?.disabled);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    assert.equal(saved.settings.coverPhoto.sourceUrl, options[1].sourceUrl);
    assert.ok(saved.settings.coverPhoto.dataUrl.startsWith('data:image/jpeg;base64,'));
    selectDelay = 600;
    await page.getByRole('button', { name: 'Outra imagem', exact: true }).click();
    await page.locator('input[type=file][accept*="bmp"]').setInputFiles({ name: 'logo.jpg', mimeType: 'image/jpeg', buffer: photo });
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Salvar')?.disabled);
    selectDelay = 0;
    await page.getByRole('button', { name: 'Selecionar slide 2', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('canvas').getContext('2d').getImageData(20, 700, 1, 1).data[0] === 255);
    fs.writeFileSync(path.join(output, 'text-slide.png'), Buffer.from((await canvas.evaluate(c => c.toDataURL())).split(',')[1], 'base64'));
    const zipPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar carrossel ZIP', exact: true }).click();
    const zip = await JSZip.loadAsync(fs.readFileSync(await (await zipPromise).path()));
    assert.equal(Object.keys(zip.files).filter(name => name.endsWith('.png')).length, 5);
    assert.match(await zip.file('creditos-da-imagem.txt').async('string'), /CC BY 2.0/);
    await page.reload(); await page.getByRole('button', { name: 'Biblioteca', exact: true }).click(); await page.getByRole('button', { name: 'Abrir Novo conteúdo', exact: true }).click();
    assert.equal(await page.getByLabel(/^Fundo/).inputValue(), 'photo');
    const count = searches.length;
    const red = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 1400; const x = c.getContext('2d'); x.fillStyle = '#d32f2f'; x.fillRect(0, 0, 600, 1400); return c.toDataURL().split(',')[1]; });
    await page.getByLabel('Enviar foto da capa', { exact: true }).setInputFiles({ name: 'minha-foto.png', mimeType: 'image/png', buffer: Buffer.from(red, 'base64') });
    await page.getByLabel('Crédito da foto', { exact: true }).waitFor();
    await page.getByLabel('Preto e branco', { exact: true }).uncheck();
    await page.getByLabel(/^Título do slide/).fill('Um título muito longo para verificar o ajuste de tamanho e a permanência da foto enviada manualmente na capa do conteúdo editorial');
    await page.waitForTimeout(1400); assert.equal(searches.length, count, 'manual replacement cannot be overwritten by automatic search');
    await page.waitForFunction(() => { const p = document.querySelector('canvas').getContext('2d').getImageData(80, 600, 1, 1).data; return p[0] > 150 && p[1] < 80; });
    await page.getByLabel('Crédito da foto', { exact: true }).fill('Acervo Young');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    const pngPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click();
    const png = fs.readFileSync(await (await pngPromise).path()); assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1350);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Novo conteúdo', exact: true }).click();
    await page.getByLabel(/^Título do slide/).fill('Novo planejamento financeiro');
    const beforeSave = searches.length; saveDelay = 2200;
    await page.getByLabel(/^Fundo/).selectOption('photo');
    const saving = page.waitForResponse(response => response.url().endsWith('/api/content') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Buscar imagem', exact: true }).isDisabled(), true);
    await page.waitForTimeout(1300); assert.equal(searches.length, beforeSave, 'automatic image search must pause during saving');
    await saving; saveDelay = 0;
    await page.getByText('Alterações não salvas', { exact: true }).waitFor();
    assert.equal(saved.settings.coverPhoto, undefined, 'late auto image must not be incorrectly marked saved');
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Salvar')?.disabled);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click(); await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    assert.ok(saved.settings.coverPhoto.dataUrl);
    assert.deepEqual(errors, []);
    console.log('PASS: auto photo, alternative, manual upload, durable save/reopen, first-slide only, white typography, PNG/ZIP credits, long title, mobile');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
