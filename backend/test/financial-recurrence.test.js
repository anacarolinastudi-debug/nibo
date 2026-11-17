const test = require('node:test');
const assert = require('node:assert/strict');
const { occurrenceId } = require('../src/utils/financialRecurrence');

function loadController(db) {
  const prismaPath = require.resolve('../src/lib/prisma');
  const ctrlPath = require.resolve('../src/controllers/financial.controller');
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: db };
  delete require.cache[ctrlPath];
  const ctrl = require(ctrlPath);
  return { ctrl, cleanup: () => { delete require.cache[prismaPath]; delete require.cache[ctrlPath]; } };
}
const res = () => { const r = { statusCode: 200, body: null, status(c) { r.statusCode = c; return r; }, json(b) { r.body = b; return r; }, send() { return r; } }; return r; };
const source = { id: 'src', description: 'HONORÁRIOS', amount: 700, type: 'RECEITA', status: 'PAID', notes: null, dueDate: new Date('2026-11-01T00:00:00Z'), recurrenceInfinite: true, recurrenceUntil: null, clientId: 'c', accountId: 'a', categoryId: 'k' };

test('pula só um mês da recorrência e cria o mês para editar', async () => {
  const rows = new Map();
  const db = {
    financialTransaction: {
      findFirst: async () => source,
      upsert: async ({ where, create }) => { if (!rows.has(where.id)) rows.set(where.id, { ...create, skipped: false }); return rows.get(where.id); },
      update: async ({ where, data }) => Object.assign(rows.get(where.id), data),
    },
    financialReceipt: { deleteMany: async () => ({}) },
    $transaction: async (fn) => fn(db),
  };
  const { ctrl, cleanup } = loadController(db);
  const req = (body) => ({ user: { role: 'ADMIN', accountingFirmId: 'f' }, params: { id: 'src' }, body });
  try {
    const edit = res();
    await ctrl.createOccurrence(req({ year: 2026, month: 12 }), edit);
    assert.equal(edit.statusCode, 201);
    assert.equal(edit.body.id, occurrenceId('src', 2026, 12));
    assert.equal(edit.body.dueDate.toISOString().slice(0, 10), '2026-12-01');
    assert.equal(edit.body.skipped, false);

    const skip = res();
    await ctrl.createOccurrence(req({ year: 2027, month: 1, skip: true }), skip);
    assert.equal(skip.body.skipped, true);

    const invalid = res();
    await ctrl.createOccurrence(req({ year: 2026, month: 10 }), invalid);
    assert.equal(invalid.statusCode, 400, 'mês antes do original não é da recorrência');
  } finally { cleanup(); }
});

test('encerra a recorrência a partir de um mês e remove só os pendentes gravados', async () => {
  const deleted = [];
  let until = null;
  const dec = occurrenceId('src', 2026, 12);
  const db = {
    financialTransaction: {
      findFirst: async () => source,
      findMany: async ({ where }) => (where.id.in.includes(dec) ? [{ id: dec }] : []),
      deleteMany: async ({ where }) => { deleted.push(...where.id.in); return {}; },
      update: async ({ data }) => { until = data.recurrenceUntil; return {}; },
    },
    financialReceipt: { deleteMany: async () => ({}) },
    $transaction: async (fn) => fn(db),
  };
  const { ctrl, cleanup } = loadController(db);
  try {
    const out = res();
    await ctrl.endRecurrence({ user: { role: 'ADMIN', accountingFirmId: 'f' }, params: { id: 'src' }, body: { year: 2026, month: 12 } }, out);
    assert.equal(out.statusCode, 200);
    assert.equal(until.toISOString().slice(0, 10), '2026-11-30');
    assert.deepEqual(deleted, [dec]);
  } finally { cleanup(); }
});
