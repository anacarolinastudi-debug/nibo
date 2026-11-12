const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const servicePath = require.resolve('../src/services/fileStorage.service');

function loadService(env) {
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']) delete process.env[key];
  Object.assign(process.env, env);
  delete require.cache[servicePath];
  return require(servicePath);
}

test('sem Supabase, grava em pasta privada local e lê/remove pelo mesmo ref', async () => {
  const storage = loadService({});
  assert.equal(storage.isRemote(), false);
  const ref = await storage.saveFile({ buffer: Buffer.from('conteudo'), originalName: 'guia.pdf', mimeType: 'application/pdf', folder: 'firma-1/documentos' });
  assert.match(ref, /^local:firma-1\/documentos\/\d+-[a-f0-9]{16}\.pdf$/);
  assert.equal((await storage.readFile(ref)).toString(), 'conteudo');
  await storage.deleteFile(ref);
  assert.equal(await storage.readFile(ref), null);
});

test('rejeita referência local que tenta sair da pasta privada', async () => {
  const storage = loadService({});
  await assert.rejects(() => storage.readFile('local:../src/server.js'), /Arquivo inválido/);
});

test('ignora extensões estranhas no nome do arquivo', () => {
  const storage = loadService({});
  assert.doesNotMatch(storage._private.buildKey('x', 'nota.pdf;rm -rf'), /;/);
  assert.match(storage._private.buildKey('../../etc', 'a.PNG'), /^etc\/\d+-[a-f0-9]{16}\.png$/);
});

test('com Supabase, cria bucket privado, envia, lê e remove pelo Storage', async () => {
  const storage = loadService({ SUPABASE_URL: 'https://proj.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'chave-teste', SUPABASE_STORAGE_BUCKET: 'arquivos' });
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', headers: options.headers, body: options.body });
    if (url.endsWith('/storage/v1/bucket/arquivos')) return new Response('{"error":"not found"}', { status: 404 });
    if (url.endsWith('/storage/v1/bucket')) return new Response('{}', { status: 200 });
    if (options.method === 'POST') return new Response('{}', { status: 200 });
    if (options.method === 'DELETE') return new Response('[]', { status: 200 });
    return new Response(Buffer.from('pdf-remoto'), { status: 200 });
  };
  try {
    const ref = await storage.saveFile({ buffer: Buffer.from('x'), originalName: 'a.pdf', mimeType: 'application/pdf', folder: 'f/conferencia' });
    assert.match(ref, /^storage:f\/conferencia\//);
    const create = calls.find((c) => c.url === 'https://proj.supabase.co/storage/v1/bucket');
    assert.equal(JSON.parse(create.body).public, false);
    const upload = calls.find((c) => c.url.includes('/storage/v1/object/arquivos/f/conferencia/'));
    assert.equal(upload.headers.Authorization, 'Bearer chave-teste');
    assert.equal((await storage.readFile(ref)).toString(), 'pdf-remoto');
    await storage.deleteFile(ref);
    assert.ok(calls.some((c) => c.method === 'DELETE'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('recusa usar bucket público', async () => {
  const storage = loadService({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' });
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('{"public":true}', { status: 200 });
  try {
    await assert.rejects(() => storage.saveFile({ buffer: Buffer.from('x'), originalName: 'a.pdf', folder: 'f' }), /público/);
  } finally {
    global.fetch = originalFetch;
  }
});

test.after(() => {
  loadService({});
  fs.rmSync(require('node:path').join(__dirname, '..', 'private-files', 'firma-1'), { recursive: true, force: true });
});
