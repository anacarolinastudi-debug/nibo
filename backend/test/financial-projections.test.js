const { test } = require('node:test');
const assert = require('node:assert/strict');

const modulePromise = import('../../frontend/src/utils/financialProjection.mjs');
const source = { id: 'source', description: 'Honorarios', amount: '700.00', type: 'RECEITA', status: 'PAID', dueDate: '2026-09-30', recurrenceInfinite: true, projectedIds: { '2026-10': 'october', '2026-11': 'november' } };

test('pending totals distinguish receivables, payables and their net balance', async () => {
  const { summarizeTransactions } = await modulePromise;
  const summary = summarizeTransactions([
    { type: 'RECEITA', status: 'PENDING', amount: 700 },
    { type: 'DESPESA', status: 'PENDING', amount: 200 },
    { type: 'RECEITA', status: 'PAID', amount: 300 },
  ]);
  assert.equal(summary.aReceber, 700);
  assert.equal(summary.aPagar, 200);
  assert.equal(summary.saldoPendente, 500);
});

test('persisted occurrence replaces forecast without losing future recurrence', async () => {
  const { buildMonthlyTransactions } = await modulePromise;
  const saved = { ...source, id: 'october', recurrenceInfinite: false, dueDate: '2026-10-30', status: 'PAID' };
  const october = buildMonthlyTransactions([source, saved], { year: 2026, month: 10 });
  assert.equal(october.length, 1);
  assert.equal(october[0].id, 'october');
  const november = buildMonthlyTransactions([source, saved], { year: 2026, month: 11 });
  assert.equal(november.length, 1);
  assert.equal(november[0].status, 'PENDING');
  assert.equal(november[0].sourceId, source.id);
});

test('chart exposes realized and projected values and respects status and search', async () => {
  const { buildFinancialChart } = await modulePromise;
  const items = [source, { id: 'rent', description: 'Aluguel', type: 'DESPESA', amount: 200, dueDate: '2026-10-30', status: 'PENDING' }];
  const rows = buildFinancialChart(items, { year: 2026, month: 10, range: 'month' });
  assert.equal(rows.length, 31);
  assert.equal(rows[29].aReceber, 700);
  assert.equal(rows[29].aPagar, 200);
  assert.equal(rows[29].recebido, 0);
  assert.equal(buildFinancialChart(items, { year: 2026, month: 10, range: 'month', status: 'PAID' })[29].aReceber, 0);
  assert.equal(buildFinancialChart(items, { year: 2026, month: 10, range: 'month', query: 'aluguel' })[29].aReceber, 0);
});

test('12 month view carries recurrences across years and clamps February', async () => {
  const { buildFinancialChart, buildMonthlyTransactions } = await modulePromise;
  const rows = buildFinancialChart([source], { year: 2026, month: 10, range: 'year' });
  assert.equal(rows.length, 12);
  assert.equal(rows[0].key, '2026-10');
  assert.equal(rows[11].key, '2027-9');
  assert.equal(rows.reduce((sum, row) => sum + row.aReceber, 0), 8400);
  assert.equal(buildMonthlyTransactions([source], { year: 2027, month: 2 })[0].dueDate.slice(0, 10), '2027-02-28');
});
