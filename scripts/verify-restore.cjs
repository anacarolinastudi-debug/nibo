const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertLocalDatabase, postgresTools } = require('./setup.cjs');
async function main() {
  const root = path.resolve(__dirname, '..');
  const config = require('../backend/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'backend/.env.development.local')));
  const local = assertLocalDatabase(config.DATABASE_URL);
  const directory = path.resolve(process.argv[2] || '.');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
  const database = 'young_restore_' + Date.now(), bin = postgresTools();
  const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: '55432', PGUSER: decodeURIComponent(local.username), PGPASSWORD: decodeURIComponent(local.password), PGDATABASE: 'postgres', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '10' };
  function run(tool, args) {
    const result = spawnSync(path.join(bin, tool + '.exe'), args, { env, windowsHide: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error('Local restore validation failed during ' + tool);
  }
  let created = false, prisma;
  try {
    run('createdb', [database]); created = true;
    run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-acl', '--exit-on-error', '--dbname=' + database, path.join(directory, 'database.dump')]);
    local.pathname = '/' + database;
    const { PrismaClient } = require('../backend/node_modules/@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: local.href } } });
    let checked = 0;
    for (const [name, count] of Object.entries(manifest.tables)) {
      const escaped = '"' + name.replace(/"/g, '""') + '"';
      const [{ total }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS total FROM public.${escaped}`);
      if (total !== count) throw new Error('Restored row count differs from the backup manifest');
      checked++;
    }
    console.log(JSON.stringify({ restored: true, verifiedTables: checked, target: 'isolated local temporary database', productionChanged: false }));
  } finally {
    if (prisma) await prisma.$disconnect();
    if (created) run('dropdb', ['--if-exists', database]);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
