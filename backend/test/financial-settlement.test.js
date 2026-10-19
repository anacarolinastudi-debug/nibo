const { test } = require('node:test');
const assert = require('node:assert/strict');
const { occurrenceId, occurrenceDate } = require('../src/utils/financialRecurrence');
const prismaPath = require.resolve('../src/lib/prisma');
const source = {
  id: '00000000-0000-4000-a000-000000000001', description: 'Honorarios',
  amount: 700, type: 'RECEITA', status: 'PAID', dueDate: new Date('2026-09-30T00:00:00Z'),
  recurrenceInfinite: true, clientId: 'client', accountId: 'account', categoryId: 'category', notes: null,
};
const records = new Map([[source.id, source]]);
let balance = 0;
let receiptSyncs = 0;
const tx = {
  financialTransaction: {
    upsert: async ({ where, create }) => {
      if (!records.has(where.id)) records.set(where.id, { ...create });
      return records.get(where.id);
    },
    updateMany: async ({ where, data }) => {
      const item = records.get(where.id);
      if (item.status === 'PAID') return { count: 0 };
      Object.assign(item, data);
      return { count: 1 };
    },
    findUnique: async ({ where }) => records.get(where.id),
  },
  financialAccount: { update: async ({ data }) => { balance += data.balance.increment; } },
  financialReceipt: { updateMany: async () => { receiptSyncs += 1; } },
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {
  financialTransaction: { findFirst: async ({ where }) => where.client.accountingFirmId === 'firm' ? records.get(where.id) : null },
  $transaction: async (callback) => callback(tx),
} };
const { markPaid } = require('../src/controllers/financial.controller');

async function settle(body, firm = 'firm', id = source.id) {
  const result = { code: 200 };
  const res = { status(code) { result.code = code; return this; }, json(value) { result.value = value; return this; } };
  await markPaid({ body, params: { id }, user: { role: 'ADMIN', accountingFirmId: firm } }, res);
  return result;
}

test('settles only one recurring month, persists its date and ignores retries', async () => {
  const body = { year: 2026, month: 10, paidAt: '2026-10-19T12:00:00.000Z' };
  const first = await settle(body);
  assert.equal(first.value.id, occurrenceId(source.id, 2026, 10));
  assert.equal(first.value.status, 'PAID');
  assert.equal(first.value.paidAt.toISOString(), body.paidAt);
  assert.equal(first.value.recurrenceInfinite, false);
  await settle(body);
  assert.equal(balance, 700);
  assert.equal(receiptSyncs, 1);
  assert.equal(records.has(occurrenceId(source.id, 2026, 11)), false);
  assert.equal(source.dueDate.toISOString(), '2026-09-30T00:00:00.000Z');
});

test('rejects another firm and occurrences before the recurrence starts', async () => {
  assert.equal((await settle({ year: 2026, month: 10 }, 'other')).code, 404);
  assert.equal((await settle({ year: 2026, month: 8 })).code, 400);
  await assert.rejects(() => settle({ year: 2026 }), { name: 'ZodError' });
});

test('expense settlement decreases balance exactly once and syncs receipts', async () => {
  const expense = { ...source, id: 'expense', type: 'DESPESA', status: 'PENDING', recurrenceInfinite: false, amount: 200 };
  records.set(expense.id, expense);
  await settle({}, 'firm', expense.id);
  await settle({}, 'firm', expense.id);
  assert.equal(balance, 500);
  assert.equal(expense.status, 'PAID');
});

test('recurrence handles leap years, short months and year boundaries', () => {
  assert.equal(occurrenceDate('2024-01-31', 2024, 2).toISOString().slice(0, 10), '2024-02-29');
  assert.equal(occurrenceDate('2026-01-31', 2026, 2).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(occurrenceDate('2026-12-31', 2027, 1).toISOString().slice(0, 10), '2027-01-31');
  assert.notEqual(occurrenceId(source.id, 2026, 10), occurrenceId(source.id, 2027, 10));
});
