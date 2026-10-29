const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { writeArchive, verifyArchive, extractArchive, uploadPath, retentionCandidates, acquireLock, downloadUpload } = require('../backup.cjs');
const key = crypto.randomBytes(32);
test('encrypted archive round trips, checks hashes and rejects wrong keys and tampering', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'young-backup-test-'));
  try {
    const file = path.join(dir, 'test.youngbackup');
    await writeArchive(file, key, [{ name: 'database.dump', data: Buffer.from('PGDMP-test') }, { name: 'uploads/a.pdf', data: Buffer.from('document') }], { complete: true });
    assert.ok(!(await fs.readFile(file)).includes(Buffer.from('document')));
    assert.equal((await verifyArchive(file, key)).entries, 2);
    await assert.rejects(() => verifyArchive(file, crypto.randomBytes(32)));
    await extractArchive(file, key, path.join(dir, 'restored'));
    assert.equal(await fs.readFile(path.join(dir, 'restored/uploads/a.pdf'), 'utf8'), 'document');
    await assert.rejects(() => extractArchive(file, key, path.join(dir, 'restored')));
    const bytes = await fs.readFile(file); bytes[35] ^= 1; await fs.writeFile(file, bytes);
    await assert.rejects(() => verifyArchive(file, key));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('archive paths and upload downloads reject traversal, redirects and external origins', async () => {
  assert.equal(uploadPath('/uploads/a.pdf', 'https://example.com'), '/uploads/a.pdf');
  for (const value of ['/uploads/../secret', '/uploads/%2e%2e/secret', '/uploads/a%2fb', 'https://evil.test/uploads/a', '/uploads/a?token=x']) assert.throws(() => uploadPath(value, 'https://example.com'));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'young-backup-test-'));
  try { await assert.rejects(() => writeArchive(path.join(dir, 'unsafe'), key, [{ name: '../secret', data: Buffer.from('x') }], { complete: true })); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('retention only selects matching regular backup files older than 30 days', () => {
  const old = new Date('2026-01-01'), now = new Date('2026-03-01');
  const files = [{ name: 'young-20260101T000000000Z.youngbackup', mtime: old, regular: true }, { name: 'notes.txt', mtime: old, regular: true }, { name: 'young-20260101T000000001Z.youngbackup', mtime: old, regular: false }, { name: 'young-20260301T000000000Z.youngbackup', mtime: now, regular: true }];
  assert.deepEqual(retentionCandidates(files, now, 30), ['young-20260101T000000000Z.youngbackup']);
});
test('atomic lock acquisition never unlinks another owner, even for old locks', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'young-backup-test-'));
  try {
    const file = path.join(dir, '.running');
    const handle = await acquireLock(file);
    const yesterday = new Date(Date.now() - 86400000);
    await fs.utimes(file, yesterday, yesterday);
    await assert.rejects(() => acquireLock(file), { code: 'EEXIST' });
    await handle.close();
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('partial-run cleanup expires failed artifacts but preserves old complete backups', () => {
  const old = new Date('2026-01-01'), now = new Date('2026-03-01');
  const files = ['young-20260101T000000000Z.youngbackup', 'young-20260101T000000000Z.youngbackup.partial', 'young-20260101T000000000Z.youngbackup.pending.failed'].map((name) => ({ name, regular: true, mtime: old }));
  assert.deepEqual(retentionCandidates(files, now, 30, false), files.slice(1).map((f) => f.name));
});
test('missing uploads fail explicitly and download refuses automatic redirects', async () => {
  await assert.rejects(() => downloadUpload('/uploads/missing.pdf', 'https://example.com', async (url, options) => { assert.equal(options.redirect, 'error'); return { ok: false, status: 404 }; }), /404/);
});
