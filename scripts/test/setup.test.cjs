const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertLocalDatabase } = require('../setup.cjs');
test('setup cannot migrate or start API against production or other databases', () => {
  assertLocalDatabase('postgresql://young_dev:local@127.0.0.1:55432/young_dev');
  for (const value of ['postgresql://user:secret@aws-1-us-east-2.pooler.supabase.com:5432/postgres', 'postgresql://user:secret@localhost:5432/postgres', 'postgresql://user:secret@127.0.0.1:55432/production']) assert.throws(() => assertLocalDatabase(value));
});
