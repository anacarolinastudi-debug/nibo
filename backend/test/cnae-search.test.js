const test = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../../frontend/src/utils/cnaeSearch.js');
test('finds the reported hairdresser CNAE with or without formatting', async () => {
  const { searchActivities } = await modulePromise;
  for (const query of ['9602501', '9602-5/01', 'cabeleireiros', 'barbearia', 'MANICURE']) {
    const items = searchActivities(query);
    assert.ok(items.some(item => item.activityId === 'hairdressing'));
  }
});
test('official catalogue identifies activities without guessing unsupported tax rates', async () => {
  const { searchActivities } = await modulePromise;
  const item = searchActivities('0111301').find(item => item.cnae === '0111-3/01');
  assert.match(item.label, /ARROZ/); assert.equal(item.activityId, 'other');
  assert.deepEqual(searchActivities('9999999'), []);
  assert.ok(searchActivities('').some(item => item.activityId === 'consulting'));
  assert.equal(searchActivities('7020400')[0].activityId, 'consulting');
  assert.ok(searchActivities('DESENVOLVIMENTO DE PROGRAMAS DE COMPUTADOR SOB ENCOMENDA').some(item => item.activityId === 'software'));
  assert.ok(searchActivities('programas de computador').some(item => item.activityId === 'software'));
  const items = searchActivities('beleza'); assert.equal(new Set(items.map(item => item.key)).size, items.length);
});
test('hairdressing and beauty use Annex III without asking for factor R', async () => {
  const { calculateProLabore } = await import('../../frontend/src/utils/proLabore.js');
  for (const activityId of ['hairdressing', 'beauty']) {
    const result = calculateProLabore({ activityId, gross: 3000, revenue12: 0, established: true, ordinary: true });
    assert.equal(result.annex, 'III'); assert.equal(result.rate, .06); assert.equal(result.factorR, null); assert.equal(result.totalTaxes, 521.49);
  }
});
