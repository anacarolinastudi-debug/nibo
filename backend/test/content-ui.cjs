const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const JSZip = require('../../frontend/node_modules/jszip');

async function main() {
  const root = path.resolve(__dirname, '../../frontend/dist');
  const output = path.resolve(__dirname, '../../tmp/content-studio'); fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = req.url.startsWith('/assets/') || req.url.startsWith('/content/') ? path.join(root, req.url) : path.join(root, 'index.html');
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    const user = { id: 'content-user', name: 'Teste', role: 'ADMIN', accountingFirmId: 'firm' };
    const projects = [];
    const logoPath = path.resolve(__dirname, '../../frontend/public/content/young-logo-dark-v3.png');
    const logoUrl = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}` : null;
    await page.addInitScript(({ user }) => { localStorage.setItem('token', 'content-test'); localStorage.setItem('user', JSON.stringify(user)); }, { user });
    await page.route('**/api/**', async (route) => {
      const request = route.request(), url = new URL(request.url()); let data = [];
      if (url.pathname.endsWith('/auth/me')) data = user;
      if (url.pathname.endsWith('/firm')) data = { id: 'firm', name: 'Young Contábil', logoUrl };
      if (url.pathname.endsWith('/content/settings')) data = { configured: true, customKey: true, logoUrl };
      if (url.pathname.endsWith('/content/generate')) {
        const brief = request.postDataJSON();
        assert.equal(brief.topic, 'Organização financeira');
        assert.equal(brief.context, 'Contabilidade próxima para pequenos empresários');
        data = { title: 'Conteúdo com IA', caption: 'Uma rotina organizada ajuda a cuidar da empresa.', reviewNotes: '', sources: [], slides: Array.from({ length: brief.count }, (_, index) => ({ eyebrow: index ? `PASSO ${index}` : 'PARA SUA EMPRESA', headline: index ? `Organize a rotina ${index}` : 'Clareza para cuidar da sua empresa', highlight: 'empresa', body: index ? 'Separe as informações, acompanhe os registros e converse com a sua contabilidade.' : 'Uma contabilidade próxima para transformar informação em decisões mais seguras.', footer: '@youngcontabil' })) };
      }
      if (url.pathname.endsWith('/content')) {
        if (request.method() === 'POST') { data = { ...request.postDataJSON(), id: 'content-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; projects.push(data); }
        else data = projects;
      }
      if (url.pathname.endsWith('/content/content-1') && request.method() === 'PUT') { data = { ...projects[0], ...request.postDataJSON(), updatedAt: new Date().toISOString() }; projects[0] = data; }
      await route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/conteudos`);
    await page.getByRole('button', { name: 'Salvar', exact: true }).waitFor();
    await page.waitForFunction(() => document.fonts.check('700 82px "Libre Baskerville"') && document.fonts.check('800 82px "Montserrat"'));
    await page.getByRole('button', { name: 'Baixar PNG', exact: true }).isEnabled();
    await page.getByRole('button', { name: 'Carrossel', exact: true }).click();
    await page.getByLabel(/^Nome do conteúdo/).fill('Carrossel de teste');
    await page.getByLabel(/^Título do slide/).fill('Organize o financeiro');
    await page.getByRole('button', { name: 'Selecionar slide 2', exact: true }).click();
    await page.getByLabel(/^Título do slide/).fill('Segundo slide com outro texto');
    const thumbs = await page.locator('button[aria-label^="Selecionar slide"] canvas').evaluateAll((canvases) => canvases.map((canvas) => canvas.toDataURL()));
    assert.equal(thumbs.length, 5); assert.notEqual(thumbs[0], thumbs[1]);
    const pixels = await page.locator('canvas').first().evaluate((canvas) => { const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; const colors = new Set(); for (let i = 0; i < data.length; i += 101 * 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); return colors.size; });
    assert.ok(pixels > 20, 'preview must have rendered text and logo pixels');
    const models = [];
    for (const template of ['cover', 'tip', 'quote']) { await page.getByLabel(/^Modelo visual/).selectOption(template); models.push(await page.locator('canvas').first().evaluate((canvas) => canvas.toDataURL())); }
    assert.equal(new Set(models).size, 3);
    await page.getByLabel(/^Modelo visual/).selectOption('cover');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    const zipDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar carrossel ZIP', exact: true }).click();
    const zipFile = await (await zipDownload).path();
    const zip = await JSZip.loadAsync(fs.readFileSync(zipFile));
    const files = Object.keys(zip.files); assert.equal(files.length, 5);
    const first = await zip.file(files[0]).async('nodebuffer'), second = await zip.file(files[1]).async('nodebuffer');
    assert.equal(first.readUInt32BE(16), 1080); assert.equal(first.readUInt32BE(20), 1350); assert.notDeepEqual(first, second);
    const pngDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click();
    assert.ok((await pngDownload).suggestedFilename().endsWith('.png'));
    await page.reload();
    await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Carrossel de teste', exact: true }).click();
    assert.equal(await page.getByLabel(/^Nome do conteúdo/).inputValue(), 'Carrossel de teste');
    await page.getByRole('button', { name: 'Selecionar slide 2', exact: true }).click();
    assert.equal(await page.getByLabel(/^Título do slide/).inputValue(), 'Segundo slide com outro texto');
    await page.getByRole('button', { name: 'Gerar com IA', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Gerar conteúdo com IA', exact: true });
    await dialog.getByLabel('Tema', { exact: true }).fill('Organização financeira');
    await dialog.getByLabel('Contexto ou texto de referência', { exact: true }).fill('Contabilidade próxima para pequenos empresários');
    await dialog.getByRole('button', { name: 'Gerar conteúdo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Usar no editor', exact: true }).click();
    assert.equal(await page.getByLabel(/^Título do slide/).inputValue(), 'Clareza para cuidar da sua empresa');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    const artData = await page.locator('canvas').first().evaluate((canvas) => canvas.toDataURL().split(',')[1]);
    fs.writeFileSync(path.join(output, 'refined-art.png'), Buffer.from(artData, 'base64'));
    const readingArea = await page.locator('canvas').first().evaluate((canvas) => {
      const ctx = canvas.getContext('2d');
      const pixel = (x, y) => Array.from(ctx.getImageData(Math.round(x * canvas.width / 1080), Math.round(y * canvas.height / 1350), 1, 1).data);
      return { header: pixel(65, 75), body: pixel(40, 850) };
    });
    assert.ok(Math.max(...readingArea.header.slice(0, 3)) < 100, 'transparent logo must not have a white plaque');
    assert.ok(Math.max(...readingArea.body.slice(0, 3)) < 65, 'waves must remain subdued behind body text');
    await page.getByLabel(/^Fundo/).selectOption('white');
    await page.getByLabel('Perfil da empresa', { exact: true }).fill('@youngcontabil');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    assert.equal(projects[0].settings.background, 'white');
    const whiteCanvas = page.locator('canvas').first();
    await page.waitForFunction(() => { const c = document.querySelector('canvas'); return c.getContext('2d').getImageData(0, 0, 1, 1).data[0] === 255; });
    const whiteData = await whiteCanvas.evaluate((canvas) => canvas.toDataURL().split(',')[1]);
    fs.writeFileSync(path.join(output, 'white-editorial.png'), Buffer.from(whiteData, 'base64'));
    await page.reload();
    await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir Conteúdo com IA', exact: true }).click();
    assert.equal(await page.getByLabel(/^Fundo/).inputValue(), 'white');
    assert.equal(await page.getByLabel('Perfil da empresa', { exact: true }).inputValue(), '@youngcontabil');
    const whiteDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click();
    assert.ok((await whiteDownload).suggestedFilename().endsWith('.png'));
    await page.getByLabel(/^Fundo/).selectOption('plain');
    await page.getByLabel(/^Modelo visual/).selectOption('quote');
    await page.getByLabel(/^Título do slide/).fill('Contabilidade com clareza, estratégia e organização para quem quer crescer com segurança.');
    await page.getByLabel(/^Texto de apoio/).fill('');
    await page.waitForFunction(() => { const c = document.querySelector('canvas'); return c.getContext('2d').getImageData(0, 0, 1, 1).data[0] === 5; });
    const plainData = await page.locator('canvas').first().evaluate((canvas) => canvas.toDataURL().split(',')[1]);
    fs.writeFileSync(path.join(output, 'plain-blue.png'), Buffer.from(plainData, 'base64'));
    const center = await page.locator('canvas').first().evaluate((canvas) => {
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let top = canvas.height, bottom = 0, left = canvas.width, right = 0;
      for (let y = 300; y < 1100; y++) for (let x = 80; x < 1000; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] > 180 && data[i + 1] > 180 && data[i + 2] > 180) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
      }
      return { x: (left + right) / 2, y: (top + bottom) / 2 };
    });
    assert.ok(Math.abs(center.x - 540) < 12 && Math.abs(center.y - 675) < 30, 'plain-blue text must be centered on both axes');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: fonts loaded, original logo, organic background, AI theme/context/review/apply, editor save/reopen, valid PNG/ZIP and mobile layout.');
  } finally { if (browser) await browser.close(); await new Promise((resolve) => server.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
