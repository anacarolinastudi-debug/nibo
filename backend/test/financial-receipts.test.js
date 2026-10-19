const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { occurrenceId } = require('../src/utils/financialRecurrence');
const clientId = '00000000-0000-4000-a000-000000000001';
const sourceId = '00000000-0000-4000-a000-000000000002';
const records = new Map();
let balanceDelta;
let savedReceipt;
const tx = {
  financialTransaction: {
    findFirst: async ({ where }) => {
      const item = records.get(where.id);
      return item && item.clientId === where.clientId && !item.receipt ? item : null;
    },
    upsert: async ({ where, create }) => { if (!records.has(where.id)) records.set(where.id, { ...create }); return records.get(where.id); },
    update: async ({ where, data }) => { const item = records.get(where.id); Object.assign(item, data); return item; },
    create: async ({ data }) => { const item = { ...data, id: 'new' }; records.set(item.id, item); return item; },
    delete: async ({ where }) => records.delete(where.id),
  },
  financialAccount: { update: async ({ data }) => { balanceDelta += data.balance.increment; } },
  financialReceipt: {
    create: async ({ data }) => { records.get(data.transactionId).receipt = { id: 'receipt' }; savedReceipt = { ...data, id: 'receipt' }; return savedReceipt; },
    update: async ({ data }) => { Object.assign(savedReceipt, data); return savedReceipt; },
    delete: async () => { savedReceipt = null; },
  },
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {
  client: { findFirst: async () => ({ id: clientId }) },
  financialAccount: { findFirst: async () => ({ id: 'account' }) },
  financialCategory: { findFirst: async () => ({ id: 'category' }) },
  financialReceipt: { count: async () => 0, findFirst: async () => savedReceipt ? { ...savedReceipt, transaction: { ...records.get(savedReceipt.transactionId) } } : null },
  $transaction: async (callback) => callback(tx),
} };
const { createReceipt, updateReceipt, removeReceipt } = require('../src/controllers/financial.controller');
beforeEach(() => {
  balanceDelta = 0;
  savedReceipt = null;
  records.clear();
  records.set(sourceId, { id: sourceId, clientId, description: 'Honorarios', type: 'RECEITA', amount: 700, status: 'PAID', dueDate: new Date('2026-09-30'), paidAt: new Date('2026-09-30'), recurrenceInfinite: true, accountId: 'account', categoryId: 'category' });
});
async function create(body) {
  let response;
  await createReceipt({ body: { clientId, description: 'Honorarios', amount: 700, ...body }, user: { role: 'ADMIN', accountingFirmId: 'firm' } }, { status() { return this; }, json(data) { response = data; } });
  return response;
}
test('receipt for an already settled income does not count the balance again', async () => {
  const receipt = await create({ transactionId: sourceId, paymentDate: '2026-09-30T00:00:00.000Z' });
  assert.equal(balanceDelta, 0);
  assert.equal(receipt.transactionId, sourceId);
  assert.match(receipt.notes, /^Obrigado por fazer negócios conosco\.\n\nTermos & Condições/);
  assert.match(receipt.notes, /Agradecemos pela compreensão e colaboração\.$/);
});

test('receipt notes remain editable, including an explicitly empty value', async () => {
  assert.equal((await create({ notes: 'Texto personalizado' })).notes, 'Texto personalizado');
  assert.equal((await create({ notes: '' })).notes, '');
});
test('receipt for a recurring projection saves only that occurrence without settling it', async () => {
  const receipt = await create({ recurrenceSourceId: sourceId, recurrenceYear: 2026, recurrenceMonth: 10, dueDate: '2026-10-30T00:00:00.000Z' });
  assert.equal(receipt.transactionId, occurrenceId(sourceId, 2026, 10));
  assert.equal(records.get(receipt.transactionId).status, 'PENDING');
  assert.equal(records.get(receipt.transactionId).recurrenceInfinite, false);
  assert.equal(records.get(sourceId).receipt, undefined);
  assert.equal(balanceDelta, 0);
});
test('expense receipt preserves expense type and subtracts only once on settlement', async () => {
  const source = records.get(sourceId);
  Object.assign(source, { type: 'DESPESA', status: 'PENDING', paidAt: null, recurrenceInfinite: false });
  await create({ transactionId: sourceId, paymentDate: '2026-10-19T00:00:00.000Z' });
  assert.equal(source.type, 'DESPESA');
  assert.equal(source.status, 'PAID');
  assert.equal(balanceDelta, -700);
});
test('rejects duplicate receipts and dates outside recurrence rules', async () => {
  await create({ transactionId: sourceId });
  await assert.rejects(() => create({ transactionId: sourceId }));
  await assert.rejects(() => create({ recurrenceSourceId: sourceId, recurrenceYear: 2026, recurrenceMonth: 8 }));
});

test('editing and deleting an expense receipt keep signed balances consistent', async () => {
  Object.assign(records.get(sourceId), { type: 'DESPESA', recurrenceInfinite: false });
  await create({ transactionId: sourceId, paymentDate: '2026-10-19T00:00:00.000Z' });
  assert.equal(balanceDelta, 0);
  const req = { body: { amount: 600 }, params: { id: 'receipt' }, user: { role: 'ADMIN', accountingFirmId: 'firm' } };
  await updateReceipt(req, { json() {} });
  assert.equal(balanceDelta, 100);
  assert.equal(records.get(sourceId).type, 'DESPESA');
  await removeReceipt(req, { status() { return this; }, send() {} });
  assert.equal(balanceDelta, 700);
});
