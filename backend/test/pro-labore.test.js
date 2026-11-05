const test = require('node:test');
const assert = require('node:assert/strict');
const engine = import('../../frontend/src/utils/proLabore.js');
const base = { gross: 3000, dependents: 0, pension: 0, activityId: 'training', revenue12: 120000, established: true, ordinary: true };

test('first-band activity rates and company CPP are distinct', async () => {
  const { calculateProLabore } = await engine;
  for (const [activityId, annex, rate, cpp] of [['commerce', 'I', .04, 0], ['industry', 'II', .045, 0], ['training', 'III', .06, 0], ['law', 'IV', .045, 600]]) {
    const r = calculateProLabore({ ...base, activityId });
    assert.equal(r.annex, annex); assert.equal(r.rate, rate); assert.equal(r.cpp, cpp);
    assert.equal(r.inss, 330); assert.equal(r.irrf, 0); assert.equal(r.net, 2670);
    assert.equal(r.totalTaxes, Math.round((r.inss + r.irrf + r.das + r.cpp) * 100) / 100);
    assert.ok(r.revenue - r.das - r.cpp >= 2999.999);
    assert.ok(Math.abs(r.revenue - r.net - r.totalTaxes) < .011);
  }
});
test('factor R uses historical payroll and the exact 28 percent boundary', async () => {
  const { calculateProLabore } = await engine;
  assert.equal(calculateProLabore({ ...base, activityId: 'consulting', payroll12: 33600 }).annex, 'III');
  assert.equal(calculateProLabore({ ...base, revenue12: 100000.25, activityId: 'consulting', payroll12: 28000.07 }).annex, 'III');
  assert.equal(calculateProLabore({ ...base, activityId: 'consulting', payroll12: 33599.99 }).annex, 'V');
  assert.equal(calculateProLabore({ ...base, gross: 12000, activityId: 'consulting', payroll12: 0 }).annex, 'V');
  assert.throws(() => calculateProLabore({ ...base, activityId: 'consulting' }), /folha/i);
  assert.equal(calculateProLabore({ ...base, revenue12: 0, activityId: 'consulting', payroll12: 0 }).annex, 'V');
  assert.equal(calculateProLabore({ ...base, revenue12: 0, activityId: 'consulting', payroll12: 1 }).annex, 'III');
});
test('INSS cap and uncapped patronal contribution, IRRF reduction and best deduction', async () => {
  const { calculateProLabore } = await engine;
  const high = calculateProLabore({ ...base, gross: 10000, activityId: 'law' });
  assert.equal(high.inss, 932.31); assert.equal(high.cpp, 2000); assert.equal(high.baseIR, 9067.69); assert.equal(high.irrf, 1584.88);
  const r = calculateProLabore({ ...base, gross: 6000 });
  assert.equal(r.deductionMode, 'legal'); assert.equal(r.baseIR, 5340); assert.equal(r.taxBeforeReduction, 559.77); assert.equal(r.reduction, 179.75); assert.equal(r.irrf, 380.02);
  assert.equal(calculateProLabore({ ...base, gross: 5000 }).irrf, 0);
  assert.equal(calculateProLabore({ ...base, gross: 5000.01 }).irrf, 0);
  assert.equal(calculateProLabore({ ...base }).deductionMode, 'simplified');
  const family = calculateProLabore({ ...base, gross: 6000, dependents: 2, pension: 500 });
  assert.equal(family.deduction, 1539.18); assert.equal(family.net, 6000 - family.inss - family.irrf - 500);
});
test('rejects unsafe inputs, unsupported activity, first-year and nonordinary tax regimes', async () => {
  const { calculateProLabore } = await engine;
  for (const patch of [{ gross: -1 }, { gross: NaN }, { gross: Infinity }, { gross: '' }, { dependents: 1.5 }, { pension: 4000 }, { revenue12: 180000.01 }, { revenue12: '' }, { activityId: 'other' }, { established: false }, { ordinary: false }, { activityId: '' }]) {
    assert.throws(() => calculateProLabore({ ...base, ...patch }));
  }
  assert.equal(calculateProLabore({ ...base, revenue12: 180000 }).rate, .06);
});
test('low contribution and unsustainable annual projection are warned without changing historical annex', async () => {
  const { calculateProLabore } = await engine;
  assert.ok(calculateProLabore({ ...base, gross: 1000 }).warnings.some(w => /mínimo/.test(w)));
  assert.ok(calculateProLabore({ ...base, gross: 20000 }).warnings.some(w => /180/.test(w)));
});
test('cent rounding covers costs across all annexes without counting withholding twice', async () => {
  const { calculateProLabore } = await engine;
  for (const activityId of ['commerce', 'industry', 'training', 'law', 'consulting']) {
    for (const gross of [1621, 3123.45, 5000, 7350, 8475.55, 12789.11]) {
      const r = calculateProLabore({ ...base, activityId, gross, payroll12: 0 });
      assert.ok(Math.abs(r.revenue - r.das - r.cpp - gross) < .011);
      assert.ok(r.revenue - r.das - r.cpp >= gross - .00001);
    }
  }
});
