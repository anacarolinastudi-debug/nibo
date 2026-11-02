const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prismaPath = require.resolve('../src/lib/prisma');
let record, writes;
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { client: {
  findFirst: async ({ where }) => where.id === record.id && where.accountingFirmId === record.accountingFirmId ? { ...record } : null,
  update: async ({ where, data }) => { assert.equal(where.id, record.id); writes.push(data); Object.assign(record, data); return { ...record }; },
} } };
const { update } = require('../src/controllers/clients.controller');
beforeEach(() => {
  writes = [];
  record = { id: 'client-test', accountingFirmId: 'firm', name: 'Cliente de teste', personType: 'JURIDICA', cnpj: '12.345.678/0001-90', taxRegime: 'SIMPLES_NACIONAL', email: null, phone: 'telefone existente', govbrLoginEncrypted: 'unchanged-login', govbrPasswordEncrypted: 'unchanged-password' };
});
async function call(body, firm = 'firm') {
  const result = { status: 200 };
  const res = { status(value) { result.status = value; return this; }, json(value) { result.body = value; return this; } };
  await update({ body, params: { id: record.id }, user: { accountingFirmId: firm } }, res);
  return result;
}
test('client edit saves only the submitted fields and preserves existing details and secrets', async () => {
  const result = await call({ taxRegime: 'LUCRO_PRESUMIDO', code: '2' });
  assert.equal(result.status, 200);
  assert.equal(record.taxRegime, 'LUCRO_PRESUMIDO');
  assert.equal(record.phone, 'telefone existente');
  assert.deepEqual(writes, [{ taxRegime: 'LUCRO_PRESUMIDO', code: '2' }]);
  assert.equal(record.govbrPasswordEncrypted, 'unchanged-password');
  assert.equal(result.body.govbrPasswordEncrypted, undefined);
});
test('editing PF without CPF still works', async () => {
  Object.assign(record, { personType: 'FISICA', cnpj: '', taxRegime: 'PESSOA_FISICA' });
  await call({ name: 'Nome atualizado' });
  assert.equal(record.name, 'Nome atualizado');
});
test('validation rejects invalid edits before writing', async () => {
  await assert.rejects(call({ cnpj: '' }), { name: 'ZodError' });
  await assert.rejects(call({ name: 'A' }), { name: 'ZodError' });
  assert.equal(writes.length, 0);
});
test('client from another office cannot be edited', async () => {
  assert.equal((await call({ name: 'Outro nome' }, 'other-firm')).status, 404);
  assert.equal(writes.length, 0);
});
