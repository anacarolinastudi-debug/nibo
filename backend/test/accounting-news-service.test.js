const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const registry = path.resolve(__dirname, '../src/data/accountingNewsSources.js');
require.cache[registry] = { id: registry, filename: registry, loaded: true, exports: { SOURCES: [] } };
const { acquire, requestSync, localDay } = require('../src/services/accountingNews.service');
function fakeDb() {
  let record;
  return { newsSyncState: {
    async upsert() { record ||= { key: 'national', state: 'IDLE' }; },
    async findUnique() { return { ...record }; },
    async updateMany({ where, data }) {
      if (where.leaseOwner && where.leaseOwner !== record.leaseOwner) return { count: 0 };
      if (where.AND && ((record.leaseUntil && record.leaseUntil > where.AND[0].OR[1].leaseUntil.lte) || (where.AND[1] && record.nextAllowedAt && record.nextAllowedAt > where.AND[1].OR[1].nextAllowedAt.lte))) return { count: 0 };
      Object.assign(record, data); return { count: 1 };
    },
  } };
}
test('lease allows one refresh across concurrent requests and enforces cooldown', async () => {
  const db = fakeDb(), now = new Date('2026-10-29T11:00:00Z');
  const owners = await Promise.all([acquire(db, now, false), acquire(db, now, false)]);
  assert.equal(owners.filter(Boolean).length, 1);
  assert.equal(await acquire(db, new Date(now.getTime() + 15 * 60000), false), null);
  assert.ok(await acquire(db, new Date(now.getTime() + 31 * 60000), false));
});
test('manual 06:50 refresh does not block 07:00 daily collection through cooldown', async () => {
  const db = fakeDb(); await db.newsSyncState.upsert();
  await db.newsSyncState.updateMany({ where: {}, data: { state: 'COMPLETED', lastAttemptAt: new Date('2026-10-29T10:50:00Z'), lastCompletedAt: new Date('2026-10-29T10:55:00Z'), nextAllowedAt: new Date('2026-10-29T11:20:00Z') } });
  assert.ok(await acquire(db, new Date('2026-10-29T11:00:00Z'), true));
});
test('daily completed collection is not repeated on the same Cuiaba date', async () => {
  const db = fakeDb(); await db.newsSyncState.upsert();
  await db.newsSyncState.updateMany({ where: {}, data: { state: 'COMPLETED', lastCompletedAt: new Date('2026-10-29T11:00:00Z') } });
  assert.equal(await acquire(db, new Date('2026-10-30T02:00:00Z'), true), null);
  assert.ok(await acquire(db, new Date('2026-10-30T11:00:00Z'), true));
  assert.equal(localDay(new Date('2026-10-30T02:00:00Z')), '2026-10-29');
});
test('early refresh and partial collection do not suppress the 07:00 scheduled collection', async () => {
  for (const data of [{ state: 'COMPLETED', lastCompletedAt: new Date('2026-10-29T08:00:00Z') }, { state: 'PARTIAL', lastCompletedAt: new Date('2026-10-29T11:00:00Z') }]) {
    const db = fakeDb(); await db.newsSyncState.upsert(); await db.newsSyncState.updateMany({ where: {}, data });
    assert.ok(await acquire(db, new Date('2026-10-29T12:00:00Z'), true));
  }
});
test('empty or failed run does not claim a successful collection', async () => {
  const db = fakeDb();
  const result = await requestSync({ db, wait: true });
  assert.equal(result.state, 'FAILED');
  assert.equal((await db.newsSyncState.findUnique()).lastCompletedAt, undefined);
});
