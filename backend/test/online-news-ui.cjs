const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const root = path.resolve(__dirname, '../../frontend/dist');
  const server = http.createServer((req, res) => { const file = req.url.startsWith('/assets/') ? path.join(root, req.url.split('?')[0]) : path.join(root, 'index.html'); res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000);
    const searches = [], gets = [], found = new Set(), errors = [];
    const article = { id: 'a4444444-4444-4444-8444-444444444444', title: 'Materia verificada na fonte', summary: 'Resumo publicado pelo portal.', url: 'https://www.contabeis.com.br/noticias/12345/materia-fiscal/', source: { id: 'portal-contabeis', name: 'Portal Contabeis' }, kind: 'NEWS', scope: 'NACIONAL', area: 'CONTABIL', ufs: [], publishedAt: null };
    const online = { status: 'COMPLETED', provider: 'DIRECT', discovered: 1, attribution: '<div>Pesquisa Google</div><script>parent.window.injectedSearch=true</script>' };
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { if (window !== window.top) return; localStorage.setItem('token', 'test'); localStorage.setItem('user', JSON.stringify({ id: 'u', role: 'ADMIN' })); });
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()); let data = [];
      if (url.pathname.endsWith('/auth/me')) data = { id: 'u', role: 'ADMIN' };
      if (url.pathname.endsWith('/firm')) data = { name: 'Young Contabil' };
      if (url.pathname.endsWith('/updates/status')) data = { state: 'COMPLETED', nextSchedule: '07:00', sources: [{ id: 'portal-contabeis', name: 'Portal Contabeis', url: 'https://www.contabeis.com.br/noticias/', searchPrefixes: ['https://www.contabeis.com.br/noticias/'], kind: 'NEWS', scope: 'NACIONAL' }] };
      if (url.pathname.endsWith('/updates/articles')) {
        const params = Object.fromEntries(url.searchParams); gets.push(params); const q = params.q || '';
        const matches = q === '' || q === 'salva' || found.has(q);
        data = { items: matches ? [{ ...article, title: found.has(q) ? article.title : 'Materia salva' }] : [], total: matches ? 1 : 0, page: 1, pageSize: 25, online: found.has(q) ? { ...online, cached: true } : null };
      }
      if (url.pathname.endsWith('/updates/search')) {
        const brief = req.postDataJSON(); searches.push(brief);
        if (brief.q === 'erro') return route.fulfill({ status: 503, json: { error: 'As fontes estao indisponiveis no momento.' } });
        await new Promise(resolve => setTimeout(resolve, brief.q === 'lento' ? 800 : 150));
        if (brief.q === 'vazio') data = { status: 'EMPTY', discovered: 0, attribution: null };
        else { found.add(brief.q); data = online; }
      }
      await route.fulfill({ json: data }).catch(() => {});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/atualizacoes`);
    await page.getByText('Materia salva', { exact: true }).waitFor(); assert.equal(searches.length, 0);
    const submit = async q => { await page.getByLabel('Busca', { exact: true }).fill(q); await page.getByRole('button', { name: 'Aplicar filtros' }).click(); };
    await submit('salva'); await page.getByText('Materia salva', { exact: true }).waitFor(); assert.equal(searches.length, 0);
    await page.getByLabel('Fonte', { exact: true }).selectOption('portal-contabeis');
    await submit('remota'); await page.getByText('Materia verificada na fonte', { exact: true }).waitFor();
    assert.equal(searches.length, 1); assert.equal(searches[0].source, 'portal-contabeis');
    assert.equal(gets.at(-1).q, 'remota'); assert.equal(gets.at(-1).source, 'portal-contabeis');
    assert.equal(await page.getByRole('link', { name: 'Criar conteudo com IA: ' + article.title }).getAttribute('href'), '/conteudos?noticia=' + article.id);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Pesquisar nas fontes pela web' }).count(), 0);
    assert.equal(await page.evaluate(() => window.injectedSearch), undefined);
    await submit('salva'); await page.getByText('Materia salva', { exact: true }).waitFor();
    await submit('remota'); await page.getByText('Consulta recente ao acervo:', { exact: false }).waitFor(); assert.equal(searches.length, 1);
    await submit('vazio'); await page.getByText('0 materia(s) correspondente(s).', { exact: false }).waitFor();
    await submit('erro'); await page.getByRole('alert').filter({ hasText: 'As fontes estao indisponiveis no momento.' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Pesquisar nas fontes pela web' }).count(), 0);
    const count = searches.length;
    await page.getByLabel('Somente favoritos').check(); await submit('favoritos');
    await page.getByText('Nenhuma atualizacao encontrada para estes filtros.').waitFor(); assert.equal(searches.length, count);
    await page.getByLabel('Somente favoritos').uncheck(); await submit('a');
    await page.getByText('Nenhuma atualizacao encontrada para estes filtros.').waitFor(); assert.equal(searches.length, count);
    await submit('lento'); await page.getByText('Consultando diretamente as fontes cadastradas...').waitFor();
    await submit('salva'); await page.getByText('Materia salva', { exact: true }).waitFor(); await page.waitForTimeout(900);
    assert.equal(await page.getByText(article.title, { exact: true }).count(), 0, 'stale search cannot replace a newer query');
    await page.setViewportSize({ width: 390, height: 844 }); await submit('remota-mobile');
    await page.getByText(article.title, { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    fs.mkdirSync(path.resolve(__dirname, '../../tmp/online-search'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '../../tmp/online-search/mobile.png'), fullPage: true });
    assert.deepEqual(errors, []); console.log('online-news-ui: PASS (fallback, cache, filters, empty/unavailable, stale requests, no external search, content link, mobile)');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
