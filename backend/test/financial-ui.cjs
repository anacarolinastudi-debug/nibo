const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { occurrenceId } = require('../src/utils/financialRecurrence');

async function main() {
  const root = path.resolve(__dirname, '../../frontend/dist');
  const server = http.createServer((req, res) => {
    const file = req.url.startsWith('/assets/') ? path.join(root, req.url) : path.join(root, 'index.html');
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const user = { id: 'test-user', name: 'Teste', role: 'ADMIN', accountingFirmId: 'firm' };
    const client = { id: 'test-client', name: 'Cliente teste', active: true };
    const source = { id: 'test-source', clientId: client.id, client, description: 'Honorarios mensais', amount: 700, type: 'RECEITA', status: 'PAID', recurrenceInfinite: true, dueDate: '2026-09-01T00:00:00Z' };
    const occurrences = [];
    const receipts = [];
    const expense = { id: 'rent', clientId: client.id, client, description: 'Aluguel', amount: 200, type: 'DESPESA', status: 'PENDING', dueDate: '2026-10-10T00:00:00Z' };
    await page.addInitScript(({ user }) => {
      localStorage.setItem('token', 'test-only');
      localStorage.setItem('user', JSON.stringify(user));
    }, { user });
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      let data = [];
      if (url.pathname.endsWith('/auth/me')) data = user;
      else if (url.pathname.endsWith('/clients')) data = [client];
      else if (url.pathname.endsWith('/firm')) data = { name: 'Escritorio teste' };
      else if (url.pathname.endsWith('/receipts')) {
        if (request.method() === 'POST') {
          const body = request.postDataJSON();
          assert.equal(body.recurrenceSourceId, source.id);
          assert.equal(body.recurrenceMonth, 11);
          assert.equal(body.paymentDate, null);
          data = { ...body, id: 'receipt', number: 'REC-2026-0001', client };
          receipts.push(data);
          occurrences.push({ ...source, id: occurrenceId(source.id, 2026, 11), status: 'PENDING', recurrenceInfinite: false, dueDate: body.dueDate, receipt: { id: data.id, number: data.number } });
        } else data = receipts;
      }
      else if (url.pathname.endsWith('/pay')) {
        const body = request.postDataJSON();
        assert.equal(body.year, 2026);
        assert.equal(body.month, 10);
        assert.equal(body.paidAt, '2026-10-19T12:00:00.000Z');
        data = { ...source, id: occurrenceId(source.id, 2026, 10), recurrenceInfinite: false, dueDate: '2026-10-01T00:00:00Z', paidAt: body.paidAt };
        occurrences.push(data);
      } else if (url.pathname.endsWith('/transactions')) {
        const month = Number(url.searchParams.get('month'));
        const projectedIds = Object.fromEntries(Array.from({ length: 24 }, (_, index) => [ `${2026 + Math.floor(index / 12)}-${index % 12 + 1}`, occurrenceId(source.id, 2026 + Math.floor(index / 12), index % 12 + 1) ]));
        data = [{ ...source, projectedIds }, ...(!month || month === 10 ? [expense] : []), ...occurrences.filter((row) => !month || new Date(row.dueDate).getUTCMonth() + 1 === month)];
      }
      await route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/financeiro`);
    const month = page.locator('select').filter({ has: page.locator('option[value="10"]') });
    await month.selectOption('10');
    await page.getByRole('button', { name: 'Receber', exact: true }).waitFor();
    assert.match(await page.getByRole('heading', { name: /Entradas e sa/ }).innerText(), /outubro\/2026/);
    const pendingCard = page.getByText('Pendências', { exact: true }).locator('..');
    assert.match(await pendingCard.innerText(), /700,00/);
    assert.match(await pendingCard.innerText(), /200,00/);
    assert.match(await pendingCard.innerText(), /500,00/);
    await page.getByRole('button', { name: 'Próximos 12 meses', exact: true }).click();
    await page.getByRole('img', { name: /out.*A receber.*700/ }).waitFor();
    assert.equal(await page.locator('[role="img"][aria-label]').count(), 24);
    await page.getByRole('button', { name: 'Mês selecionado', exact: true }).click();
    await page.getByRole('button', { name: 'Receber', exact: true }).click();
    await page.locator('input[type="date"]').fill('2026-10-19');
    await page.getByRole('button', { name: 'Confirmar baixa', exact: true }).click();
    await page.locator('tbody').getByText('Recebido', { exact: false }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 2);
    await month.selectOption('11');
    await page.getByRole('button', { name: 'Receber', exact: true }).waitFor();
    assert.match(await page.getByRole('heading', { name: /Entradas e sa/ }).innerText(), /novembro\/2026/);
    await page.getByRole('button', { name: 'Gerar recibo', exact: true }).click();
    await page.getByRole('heading', { name: 'Novo recibo', exact: true }).waitFor();
    assert.match(await page.locator('textarea').inputValue(), /^Obrigado por fazer negócios conosco\.\n\nTermos & Condições/);
    await page.getByRole('button', { name: 'Salvar recibo', exact: true }).click();
    await page.locator('tbody').getByText('REC-2026-0001', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Movimentações', exact: true }).click();
    await page.getByRole('button', { name: 'Ver recibo', exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Receber', exact: true }).count(), 1);
    await month.selectOption('10');
    await page.locator('tbody').getByText('Recebido', { exact: false }).waitFor();
    const output = path.resolve(__dirname, '../../tmp/financial-monthly.png');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await page.screenshot({ path: output, fullPage: true });
    await page.getByRole('button', { name: 'Próximos 12 meses', exact: true }).click();
    await page.getByRole('img', { name: /out.*Recebido.*700/ }).waitFor();
    await page.screenshot({ path: output.replace('.png', '-projection.png'), fullPage: true });
    console.log('PASS: monthly filters, signed pending totals, 12 month projections, independent settlement and projected receipt in Receipts tab; screenshot: ' + output);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
