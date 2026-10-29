const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const root = path.resolve(__dirname, '../../frontend/dist');
  const server = http.createServer((req, res) => {
    const file = req.url.startsWith('/assets/') ? path.join(root, req.url.split('?')[0]) : path.join(root, 'index.html');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(8000);
    let role = 'ADMIN', running = 0, reads = 0, cooldown = false, fail = false, state = 'PARTIAL';
    const queries = [], patches = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('token', 'ui-test'); localStorage.setItem('user', JSON.stringify({ id: 'u', role: 'ADMIN' })); });
    const article = { id: 'a', title: 'Informe oficial', summary: '<img src=x onerror=alert(1)> Texto de origem.', url: 'https://www.gov.br/receitafederal/pt-br', publishedAt: null, firstSeenAt: '2026-10-29T12:00:00Z', area: 'FISCAL', scope: 'FEDERAL', ufs: [], source: { id: 'rfb', name: 'Receita Federal' }, read: false, bookmarked: false };
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url());
      let data = [];
      if (url.pathname.endsWith('/auth/me')) data = { id: 'u', name: 'Equipe', role };
      if (url.pathname.endsWith('/firm')) data = { name: 'Escritorio de teste' };
      if (url.pathname.endsWith('/updates/articles')) {
        reads++; queries.push(Object.fromEntries(url.searchParams));
        if (fail) return route.fulfill({ status: 503, json: { error: 'Indisponivel' } });
        data = { items: [{ ...article, kind: url.searchParams.get('kind') }], total: 21, page: Number(url.searchParams.get('page') || 1), pageSize: 20 };
      }
      if (url.pathname.endsWith('/updates/articles/a/state')) {
        const patch = req.postDataJSON(); patches.push(patch); Object.assign(article, patch);
        data = { articleId: 'a', read: article.read, bookmarked: article.bookmarked };
      }
      if (url.pathname.endsWith('/updates/status')) data = { state: running-- > 0 ? 'RUNNING' : state, lastCompletedAt: null, nextSchedule: '07:00', timeZone: 'America/Cuiaba', sources: [{ id: 'rfb', name: 'Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br', scope: 'FEDERAL', status: 'ERROR', errorMessage: 'Fonte temporariamente indisponivel', articlesCount: 12 }, { id: 'empty', name: 'Fonte sem registros', scope: 'ESTADUAL', status: 'EMPTY', articlesCount: 0 }] };
      if (url.pathname.endsWith('/updates/refresh')) {
        if (cooldown) return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { error: 'Aguarde para atualizar novamente.' } });
        running = 1; data = { state: 'RUNNING', queued: true };
      }
      await route.fulfill({ json: data });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/atualizacoes`);
    await page.getByRole('heading', { name: 'Atualizacoes contabeis' }).waitFor();
    await page.getByText('Data de publicacao nao informada').waitFor();
    await page.getByText('Proxima coleta: Diariamente as 07:00', { exact: false }).waitFor();
    await page.getByText('Atualizacao parcial.', { exact: false }).waitFor();
    article.publishedAt = '2026-10-29T16:00:00.000Z';
    assert.equal(await page.locator('article img').count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Abrir original: Informe oficial' }).getAttribute('href'), article.url);
    await page.getByRole('button', { name: 'Marcar como lido' }).click();
    await page.getByRole('button', { name: 'Marcar como nao lido' }).waitFor();
    await page.getByText('Publicacao: 29/10/2026', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Salvar favorito' }).click();
    await page.getByRole('button', { name: 'Remover favorito' }).waitFor();
    assert.deepEqual(patches, [{ read: true }, { bookmarked: true }]);
    await page.getByRole('button', { name: 'Proxima pagina' }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Pagina 2 de 2'));
    await page.getByRole('tab', { name: 'Legislacao', exact: true }).click();
    await page.getByLabel('Busca').fill('tributo');
    for (const [label, value] of [['Area', 'REFORMA_TRIBUTARIA'], ['UF', 'MT'], ['Abrangencia', 'ESTADUAL'], ['Fonte', 'rfb'], ['Leitura', 'unread']]) await page.getByLabel(label, { exact: true }).selectOption(value);
    await page.getByLabel('De', { exact: true }).fill('2026-10-01');
    await page.getByLabel('Ate', { exact: true }).fill('2026-10-29');
    await page.getByLabel('Somente favoritos').check();
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await page.waitForTimeout(150);
    assert.deepEqual(queries.at(-1), { q: 'tributo', area: 'REFORMA_TRIBUTARIA', uf: 'MT', scope: 'ESTADUAL', source: 'rfb', from: '2026-10-01', to: '2026-10-29', read: 'unread', bookmarked: 'true', kind: 'LEGISLATION', page: '1' });
    await page.getByRole('tab', { name: 'Fontes', exact: true }).click();
    await page.getByText('Fonte temporariamente indisponivel', { exact: false }).waitFor();
    await page.getByText('Nenhum registro retornado', { exact: true }).waitFor();
    const before = reads;
    await page.getByRole('button', { name: 'Atualizar fontes' }).click();
    await page.getByText('Atualizacao em andamento').waitFor();
    await page.waitForTimeout(4500);
    assert.ok(reads > before, 'manual refresh refetches articles');
    cooldown = true;
    await page.getByRole('button', { name: 'Atualizar fontes' }).click();
    await page.getByText('Aguarde para atualizar novamente.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Atualizar fontes' }).isDisabled(), true);
    await page.waitForTimeout(2200);
    fail = true;
    await page.getByRole('tab', { name: 'Noticias', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Nao foi possivel carregar as atualizacoes.' }).waitFor();
    fail = false;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.getByText('Informe oficial', { exact: true }).waitFor();
    fs.mkdirSync(path.resolve(__dirname, '../../tmp/updates-ui'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '../../tmp/updates-ui/desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile does not overflow');
    fs.mkdirSync(path.resolve(__dirname, '../../tmp/updates-ui'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '../../tmp/updates-ui/mobile.png'), fullPage: true });
    role = 'ACCOUNTANT'; await page.reload();
    await page.getByRole('heading', { name: 'Atualizacoes contabeis' }).waitFor();
    role = 'CLIENT'; const count = reads; await page.reload();
    await page.waitForURL(`${base}/`);
    assert.equal(reads, count, 'client never fetches updates');
    assert.deepEqual(errors, []);
    console.log('updates-ui: passed (filters, states, refresh, roles, mobile)');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
