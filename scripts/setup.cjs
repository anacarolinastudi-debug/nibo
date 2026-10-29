const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function postgresTools() {
  const base = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
  const versions = fs.existsSync(base) ? fs.readdirSync(base).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a)) : [];
  const bin = versions.map((v) => path.join(base, v, 'bin')).find((p) => fs.existsSync(path.join(p, 'pg_dump.exe')));
  if (!bin) throw new Error('Install PostgreSQL client/server tools before running setup.');
  return bin;
}
function assertLocalDatabase(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55432' || url.pathname !== '/young_dev') throw new Error('Setup only accepts the isolated local development database on port 55432.');
  return url;
}
function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, windowsHide: true, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error('Setup step failed; existing production data was not modified.');
}
function createIfMissing(file, content) { if (!fs.existsSync(file)) fs.writeFileSync(file, content, { flag: 'wx', mode: 0o600 }); }
function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 19)) throw new Error('Node.js 22.19 or newer is required.');
  const bin = postgresTools(), local = path.join(root, '.local'), envFile = path.join(root, 'backend/.env.development.local');
  if (process.argv.includes('--check')) {
    console.log(JSON.stringify({ node: process.versions.node, postgresTools: fs.existsSync(path.join(bin, 'pg_dump.exe')), localConfig: fs.existsSync(envFile), backendInstalled: fs.existsSync(path.join(root, 'backend/node_modules/@prisma/client')), frontendInstalled: fs.existsSync(path.join(root, 'frontend/node_modules/vite')) })); return;
  }
  fs.mkdirSync(local, { recursive: true, mode: 0o700 });
  createIfMissing(envFile, `DATABASE_URL="postgresql://young_dev:${crypto.randomBytes(24).toString('hex')}@127.0.0.1:55432/young_dev?schema=public&sslmode=disable"\nJWT_SECRET="${crypto.randomBytes(48).toString('hex')}"\nCERT_ENCRYPTION_KEY="${crypto.randomBytes(48).toString('hex')}"\nFRONTEND_URL="http://127.0.0.1:5176"\nPORT=4001\nNODE_ENV=development\n`);
  createIfMissing(path.join(root, 'frontend/.env.development.local'), 'VITE_API_URL=http://127.0.0.1:4001/api\n');
  if (!process.argv.includes('--skip-install')) for (const folder of ['backend', 'frontend']) run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'npm.cmd', 'ci'], { cwd: path.join(root, folder), env: { ...process.env, NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --use-system-ca').trim() } });
  const dotenv = require('../backend/node_modules/dotenv');
  const env = { ...process.env, ...dotenv.parse(fs.readFileSync(envFile)) };
  const url = assertLocalDatabase(env.DATABASE_URL), data = path.join(local, 'postgres'), pg = (tool) => path.join(bin, tool + '.exe');
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(local, 'init-password.tmp');
    fs.writeFileSync(passwordFile, decodeURIComponent(url.password), { flag: 'wx', mode: 0o600 });
    try { run(pg('initdb'), ['-D', data, '--username=young_dev', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', '--pwfile=' + passwordFile]); }
    finally { fs.unlinkSync(passwordFile); }
  }
  const pgEnv = { ...env, PGHOST: '127.0.0.1', PGPORT: '55432', PGUSER: 'young_dev', PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'postgres', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '10' };
  const status = spawnSync(pg('pg_ctl'), ['-D', data, 'status'], { windowsHide: true, stdio: 'ignore' });
  if (status.status !== 0) run(pg('pg_ctl'), ['-D', data, '-l', path.join(local, 'postgres.log'), '-o', '-p 55432 -h 127.0.0.1', '-w', 'start'], { env: pgEnv });
  const exists = spawnSync(pg('psql'), ['-X', '-tAc', "SELECT 1 FROM pg_database WHERE datname='young_dev'"], { env: pgEnv, windowsHide: true, encoding: 'utf8' });
  if (exists.status !== 0) throw new Error('Isolated local database could not be reached.');
  if (exists.stdout.trim() !== '1') run(pg('createdb'), ['young_dev'], { env: pgEnv });
  const prisma = path.join(root, 'backend/node_modules/prisma/build/index.js');
  run(process.execPath, [prisma, 'generate', '--schema', path.join(root, 'backend/prisma/schema.prisma')], { env });
  run(process.execPath, [prisma, 'migrate', 'deploy', '--schema', path.join(root, 'backend/prisma/schema.prisma')], { env });
  console.log('Local setup complete. Production configuration was preserved. No sample data was inserted.');
  console.log('Start API: npm run dev:api | Start website in another terminal: npm run dev:web');
}
module.exports = { assertLocalDatabase, postgresTools };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
