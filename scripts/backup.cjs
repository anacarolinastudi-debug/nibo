const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn, spawnSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const MAGIC = Buffer.from('YOUNGBK1');
const MAX_BYTES = 256 * 1024 * 1024;
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');
function safeName(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes(':') || name.startsWith('/') || name.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Unsafe archive path');
  return name;
}
function uploadPath(value, origin) {
  if (typeof value !== 'string') throw new Error('Invalid upload');
  const raw = value.startsWith(origin + '/uploads/') ? value.slice(origin.length) : value;
  if (!raw.startsWith('/uploads/') || /[?#\x00-\x20\\]/.test(raw)) throw new Error('Unsafe upload URL');
  for (const segment of raw.slice(1).split('/')) {
    const decoded = decodeURIComponent(segment);
    if (!decoded || ['.', '..'].includes(decoded) || /[/%\\:\x00-\x1f]/.test(decoded)) throw new Error('Unsafe upload path');
  }
  return raw;
}
async function writeArchive(file, key, records, metadata) {
  if (key.length !== 32) throw new Error('Invalid backup key');
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const output = fs.createWriteStream(file, { flags: 'wx', mode: 0o600 });
  output.write(Buffer.concat([MAGIC, iv]));
  async function* lines() {
    yield JSON.stringify({ kind: 'header', format: 1, createdAt: new Date().toISOString() }) + '\n';
    let count = 0;
    for await (const record of records) {
      safeName(record.name);
      if (record.data.length > MAX_BYTES) throw new Error('Backup entry exceeds safety limit');
      yield JSON.stringify({ kind: 'entry', name: record.name, bytes: record.data.length, sha256: digest(record.data), data: record.data.toString('base64') }) + '\n';
      count++;
    }
    yield JSON.stringify({ kind: 'manifest', ...metadata, entries: count }) + '\n';
  }
  await pipeline(Readable.from(lines()), zlib.createGzip(), cipher, output);
  await fsp.appendFile(file, cipher.getAuthTag());
}
async function readArchive(file, key, onEntry = async () => {}) {
  const handle = await fsp.open(file, 'r');
  let stat, header, tag;
  try {
    stat = await handle.stat();
    if (stat.size < 37) throw new Error('Invalid backup file');
    header = Buffer.alloc(20); tag = Buffer.alloc(16);
    await handle.read(header, 0, 20, 0); await handle.read(tag, 0, 16, stat.size - 16);
  } finally { await handle.close(); }
  if (!header.subarray(0, 8).equals(MAGIC) || key.length !== 32) throw new Error('Invalid backup header or key');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(8)); decipher.setAuthTag(tag);
  let count = 0, manifest, sawHeader = false;
  const names = new Set();
  async function line(text) {
    const record = JSON.parse(text);
    if (!sawHeader) { if (record.kind !== 'header' || record.format !== 1) throw new Error('Invalid archive format'); sawHeader = true; return; }
    if (manifest) throw new Error('Unexpected archive data');
    if (record.kind === 'manifest') { manifest = record; return; }
    if (record.kind !== 'entry' || names.has(record.name)) throw new Error('Invalid archive entry');
    safeName(record.name); names.add(record.name);
    const data = Buffer.from(record.data, 'base64');
    if (data.length !== record.bytes || data.length > MAX_BYTES || digest(data) !== record.sha256) throw new Error('Backup integrity check failed');
    await onEntry(record.name, data); count++;
  }
  await pipeline(fs.createReadStream(file, { start: 20, end: stat.size - 17 }), decipher, zlib.createGunzip(), async (source) => {
    let pending = ''; const decoder = new StringDecoder('utf8');
    for await (const chunk of source) {
      pending += decoder.write(chunk);
      if (pending.length > MAX_BYTES * 1.5) throw new Error('Archive record exceeds safety limit');
      let at;
      while ((at = pending.indexOf('\n')) !== -1) { const text = pending.slice(0, at); pending = pending.slice(at + 1); await line(text); }
    }
    pending += decoder.end();
    if (pending) throw new Error('Truncated backup');
  });
  if (!manifest || manifest.entries !== count || !names.has('database.dump')) throw new Error('Incomplete archive structure');
  return manifest;
}
async function verifyArchive(file, key) { return readArchive(file, key); }
async function extractArchive(file, key, destination) {
  await verifyArchive(file, key);
  const root = path.resolve(destination);
  if (root === path.parse(root).root) throw new Error('Invalid restore directory');
  await fsp.mkdir(root, { recursive: false, mode: 0o700 });
  if (process.platform === 'win32') {
    const script = "$ErrorActionPreference='Stop'; $p=$env:YOUNG_RESTORE_DIR; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=[Security.AccessControl.DirectorySecurity]::new(); $acl.SetAccessRuleProtection($true,$false); $i=[Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'; $n=[Security.AccessControl.PropagationFlags]::None; $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl',$i,$n,'Allow')); $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-18'),'FullControl',$i,$n,'Allow')); [IO.Directory]::SetAccessControl($p,$acl)";
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, YOUNG_RESTORE_DIR: root }, windowsHide: true, stdio: 'ignore' });
    if (result.error || result.status !== 0) throw new Error('Cannot protect the extraction directory; no plaintext was written');
  }
  const manifest = await readArchive(file, key, async (name, data) => {
    const target = path.resolve(root, safeName(name));
    if (!target.startsWith(root + path.sep)) throw new Error('Unsafe extraction path');
    await fsp.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await fsp.writeFile(target, data, { flag: 'wx', mode: 0o600 });
  });
  await fsp.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
}
function retentionCandidates(files, now, days, includeComplete = true) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('Invalid retention');
  const cutoff = now.getTime() - days * 86400000;
  return files.filter((file) => file.regular && /^young-\d{8}T\d{9}Z\.youngbackup(?:\.partial|\.pending(?:\.failed)?|\.failed)?$/.test(file.name) && (includeComplete || !file.name.endsWith('.youngbackup')) && file.mtime.getTime() < cutoff).map((file) => file.name);
}
async function acquireLock(file) {
  const handle = await fsp.open(file, 'wx'); handle.backupToken = crypto.randomBytes(16).toString('hex');
  await handle.writeFile(JSON.stringify({ pid: process.pid, token: handle.backupToken })); return handle;
}
async function pruneArtifacts(outputDir, days, includeComplete) {
  const files = await Promise.all((await fsp.readdir(outputDir)).map(async (name) => { const stat = await fsp.lstat(path.join(outputDir, name)); return { name, regular: stat.isFile() && !stat.isSymbolicLink(), mtime: stat.mtime }; }));
  const expired = retentionCandidates(files, new Date(), days, includeComplete);
  for (const name of expired) await fsp.unlink(path.join(outputDir, name));
  return expired.length;
}
function pgEnvironment(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database protocol');
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || 'require', PGCONNECT_TIMEOUT: '30' };
}
function runTool(executable, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env, windowsHide: true, shell: false });
    const chunks = []; let bytes = 0, stderr = '', failed = false;
    const timeout = setTimeout(() => { failed = true; child.kill(); reject(new Error('PostgreSQL operation timed out')); }, 600000);
    child.stdout.on('data', (chunk) => { bytes += chunk.length; if (bytes > MAX_BYTES) { failed = true; child.kill(); reject(new Error('Database dump exceeds safety limit')); } else chunks.push(chunk); });
    child.stderr.on('data', (chunk) => { if (stderr.length < 2000) stderr += chunk.toString(); });
    child.on('error', () => { clearTimeout(timeout); reject(new Error('PostgreSQL tool could not start')); });
    child.on('close', (code) => { clearTimeout(timeout); if (!failed) code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`PostgreSQL tool failed (${code}); verify connectivity and installed client version`)); });
  });
}
function collectUploads(value, origin, found = new Set()) {
  if (typeof value === 'string' && (value.startsWith('/uploads/') || value.startsWith(origin + '/uploads/'))) found.add(uploadPath(value, origin));
  else if (Array.isArray(value)) for (const item of value) collectUploads(item, origin, found);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectUploads(item, origin, found);
  return found;
}
async function downloadUpload(relative, origin, fetchImpl = fetch) {
  const url = new URL(uploadPath(relative, origin), origin);
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > 32 * 1024 * 1024) throw new Error('Upload exceeds size limit');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) throw new Error('Upload exceeds size limit'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function runBackup(config) {
  const originUrl = new URL(config.apiOrigin);
  if (originUrl.protocol !== 'https:' || originUrl.pathname !== '/') throw new Error('Backup requires a trusted HTTPS origin');
  const origin = originUrl.origin, outputDir = path.resolve(config.outputDir), key = Buffer.from(config.backupKey, 'base64');
  if ((await fsp.lstat(outputDir)).isSymbolicLink()) throw new Error('Backup directory cannot be a symlink');
  const lock = path.join(outputDir, '.running');
  let lockHandle;
  try { lockHandle = await acquireLock(lock); }
  catch { throw new Error('A backup is already running; check .running before retrying'); }
  let prisma, file;
  try {
    await pruneArtifacts(outputDir, config.retentionDays || 30, false);
    const { PrismaClient } = require(config.prismaClientPath || '../backend/node_modules/@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
    const quote = (name) => '"' + name.replace(/"/g, '""') + '"';
    const snapshot = await prisma.$transaction(async (tx) => {
      const [{ snapshot }] = await tx.$queryRawUnsafe('SELECT pg_export_snapshot() AS snapshot');
      const tables = await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
      const uploads = new Set(), counts = {};
      for (const { tablename } of tables) {
        const rows = await tx.$queryRawUnsafe(`SELECT to_jsonb(t) AS data FROM public.${quote(tablename)} AS t`);
        counts[tablename] = rows.length;
        for (const row of rows) collectUploads(row.data, origin, uploads);
      }
      const dump = await runTool(config.pgDumpPath, ['--format=custom', '--compress=6', '--no-owner', '--no-acl', '--schema=public', '--snapshot=' + snapshot], pgEnvironment(config.databaseUrl));
      if (!dump.subarray(0, 5).equals(Buffer.from('PGDMP'))) throw new Error('Invalid PostgreSQL dump');
      return { dump, uploads: [...uploads], counts };
    }, { isolationLevel: 'RepeatableRead', timeout: 600000, maxWait: 30000 });
    const metadata = { complete: true, databaseSchema: 'public', tables: snapshot.counts, missingUploads: [], source: origin, createdAt: new Date().toISOString() };
    async function* records() {
      yield { name: 'database.dump', data: snapshot.dump };
      yield { name: 'recovery.json', data: Buffer.from(JSON.stringify({ applicationSecrets: config.applicationSecrets || {}, databaseUrl: config.databaseUrl })) };
      for (const relative of snapshot.uploads) {
        try { yield { name: safeName(decodeURIComponent(relative.slice(1))), data: await downloadUpload(relative, origin) }; }
        catch { metadata.complete = false; metadata.missingUploads.push(relative); }
      }
    }
    const stamp = new Date().toISOString().replace(/[-:.]/g, '');
    file = path.join(outputDir, `young-${stamp}.youngbackup.pending`);
    await writeArchive(file, key, records(), metadata);
    const checked = await verifyArchive(file, key);
    const finalFile = file.replace('.pending', checked.complete ? '' : '.partial');
    await fsp.rename(file, finalFile); file = null;
    const deleted = await pruneArtifacts(outputDir, config.retentionDays || 30, checked.complete);
    const status = { lastRun: new Date().toISOString(), status: checked.complete ? 'complete' : 'partial', file: path.basename(finalFile), tables: Object.keys(snapshot.counts).length, uploads: snapshot.uploads.length, missingUploads: checked.missingUploads.length, deleted, verified: true };
    await fsp.writeFile(path.join(outputDir, 'status.json'), JSON.stringify(status, null, 2));
    console.log(JSON.stringify(status));
    if (!checked.complete) process.exitCode = 2;
    return status;
  } finally {
    if (prisma) await prisma.$disconnect();
    if (lockHandle) {
      await lockHandle.close();
      try { const owner = JSON.parse(await fsp.readFile(lock, 'utf8')); if (owner.token === lockHandle.backupToken) await fsp.unlink(lock); } catch {}
    }
    if (file) await fsp.rename(file, file + '.failed').catch(() => {});
  }
}
module.exports = { writeArchive, verifyArchive, extractArchive, uploadPath, retentionCandidates, pgEnvironment, collectUploads, downloadUpload, runBackup, acquireLock };
if (require.main === module) {
  (async () => {
    let input = ''; for await (const chunk of process.stdin) input += chunk;
    const config = JSON.parse(input), action = process.argv[2] || 'run';
    if (action === 'run') await runBackup(config);
    else if (action === 'verify') console.log(JSON.stringify(await verifyArchive(config.file, Buffer.from(config.backupKey, 'base64'))));
    else if (action === 'extract') { await extractArchive(config.file, Buffer.from(config.backupKey, 'base64'), config.destination); console.log('Verified backup extracted to a new directory.'); }
    else throw new Error('Unknown backup action');
  })().catch(() => { console.error('Backup failed. Previous copies were preserved. Verify network, PostgreSQL tools and local configuration.'); process.exitCode = 1; });
}
