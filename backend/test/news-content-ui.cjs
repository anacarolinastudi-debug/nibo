const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const root = path.resolve(__dirname, '../../frontend/dist');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://local').pathname;
    const file = pathname.startsWith('/assets/') || pathname.startsWith('/content/') ? path.join(root, pathname) : path.join(root, 'index.html');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' }[path.extname(file)] || 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000);
    const id = 'a4444444-4444-4444-8444-444444444444';
    const article = { id, title: 'Organize os registros da sua empresa', summary: 'Planejamento e organizacao para pequenos negocios.', url: 'https://www.contabeis.com.br/noticias/12345/organize-sua-empresa/', source: { id: 'portal-contabeis', name: 'Portal Contabeis' }, kind: 'NEWS', publishedAt: null, area: 'CONTABIL', scope: 'NACIONAL', ufs: [] };
    const calls = [], saves = [], errors = []; let missing = false, configured = true, provider = 'gemini';
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.addInitScript(() => { localStorage.setItem('token', 'test'); localStorage.setItem('user', JSON.stringify({ id: 'u', role: 'ADMIN' })); });
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()); let data = [];
      if (url.pathname.endsWith('/auth/me')) data = { id: 'u', role: 'ADMIN' };
      if (url.pathname.endsWith('/firm')) data = { name: 'Young Contabil' };
      if (url.pathname.endsWith('/updates/articles')) data = { items: [article], total: 1, page: 1, pageSize: 25 };
      if (url.pathname.endsWith('/updates/articles/' + id)) { if (missing) return route.fulfill({ status: 404, json: { error: 'Publicacao nao encontrada.' } }); data = article; }
      if (url.pathname.endsWith('/updates/status')) data = { state: 'COMPLETED', nextSchedule: '07:00', sources: [] };
      if (url.pathname.endsWith('/content/settings')) data = { configured, provider };
      if (url.pathname.endsWith('/content/settings/ai')) { configured = true; provider = req.postDataJSON().provider; data = { configured, provider }; }
      if (url.pathname.endsWith('/content/generate')) {
        const brief = req.postDataJSON(); calls.push(brief);
        data = { title: 'Texto adaptado para MEIs', caption: 'Converse com a Young Contabil.', reviewNotes: 'Revise antes de publicar.', sources: [{ title: article.title, url: article.url }], slides: Array.from({ length: brief.count }, () => ({ eyebrow: 'PARA SEU NEGOCIO', headline: 'Mais clareza na sua rotina', body: 'Separe os registros e converse com sua contabilidade.', highlight: 'clareza', footer: '@youngcontabil' })) };
      }
      if (url.pathname.endsWith('/content') && req.method() === 'POST') { saves.push(req.postDataJSON()); data = { ...saves.at(-1), id: 'saved', updatedAt: new Date().toISOString() }; }
      await route.fulfill({ json: data });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/atualizacoes');
    await page.getByRole('link', { name: 'Criar conteudo com IA: ' + article.title }).click();
    await page.waitForURL('**/conteudos?noticia=' + id);
    const dialog = page.getByRole('dialog', { name: 'Gerar conteúdo com IA' }); await dialog.waitFor();
    assert.equal(await dialog.getByLabel('Tema', { exact: true }).inputValue(), article.title);
    assert.ok((await dialog.getByLabel('Contexto ou texto de referência').inputValue()).includes(article.url));
    assert.equal(await dialog.getByLabel('Público', { exact: true }).inputValue(), 'Pequenos empresários, MEIs e autônomos');
    assert.equal(calls.length, 0, 'navigation never automatically spends AI credits');
    fs.mkdirSync(path.resolve(__dirname, '../../tmp/news-content'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '../../tmp/news-content/desktop.png'), fullPage: true });
    await dialog.getByLabel('Público', { exact: true }).fill('MEIs prestadores de servicos');
    await dialog.getByRole('button', { name: 'Gerar conteúdo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Usar no editor' }).waitFor();
    assert.equal(calls[0].articleId, id); assert.equal(calls[0].audience, 'MEIs prestadores de servicos');
    assert.equal(calls[0].research, false, 'existing Gemini research preference is preserved');
    await dialog.getByRole('button', { name: 'Usar no editor' }).click();
    assert.equal(await page.getByLabel(/^Nome do conteúdo/).inputValue(), 'Texto adaptado para MEIs');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Salvo no sistema', { exact: true }).waitFor();
    assert.equal(saves[0].settings.sources[0].url, article.url);
    await page.getByRole('button', { name: 'Novo conteúdo', exact: true }).click();
    await page.getByRole('button', { name: 'Gerar com IA', exact: true }).click();
    assert.equal(await page.getByLabel('Tema', { exact: true }).inputValue(), '', 'new content does not inherit a previous news item');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    missing = true; await page.goto(base + '/conteudos?noticia=' + id);
    await page.getByRole('alert').filter({ hasText: 'Publicacao nao encontrada.' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    missing = false; await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/conteudos?noticia=' + id);
    await page.getByRole('dialog').waitFor(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    fs.mkdirSync(path.resolve(__dirname, '../../tmp/news-content'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '../../tmp/news-content/mobile.png'), fullPage: true });
    configured = false; provider = 'openai'; await page.goto(base + '/conteudos?noticia=' + id);
    const initial = page.getByRole('dialog', { name: 'Gerar conteúdo com IA' }); await initial.waitFor();
    await initial.getByLabel('Público', { exact: true }).fill('Empresas locais');
    await initial.getByRole('button', { name: 'Conectar IA', exact: true }).click();
    const connection = page.getByRole('dialog', { name: 'Configurar IA' }); await connection.waitFor();
    await connection.getByLabel('Provedor').selectOption('gemini');
    await connection.getByLabel(/^Chave da API/).fill('test-only-not-a-real-provider-key');
    await connection.getByRole('button', { name: 'Salvar conexão' }).click();
    await initial.waitFor();
    assert.equal(await initial.getByLabel('Público', { exact: true }).inputValue(), 'Empresas locais');
    assert.ok((await initial.getByLabel('Contexto ou texto de referência').inputValue()).includes(article.url));
    assert.equal(await initial.getByLabel('Pesquisar fontes oficiais quando necessário').isChecked(), false, 'switching to Gemini uses its own research default');
    assert.equal(calls.length, 1, 'connecting IA never generates content automatically');
    assert.deepEqual(errors, []); console.log('news-content-ui: passed (handoff, editable audience, explicit generation, source/save, missing article, mobile)');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
