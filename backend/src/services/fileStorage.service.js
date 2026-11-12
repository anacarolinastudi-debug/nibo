// Armazenamento de arquivos enviados (documentos, Conferência, depuração do e-CAC).
//
// Em produção os arquivos vão para um bucket PRIVADO do Supabase Storage, porque o
// disco do Render é apagado a cada reinício/deploy. Sem as variáveis do Supabase
// (desenvolvimento local), os arquivos ficam em uma pasta local que NÃO é servida
// publicamente: o acesso sempre passa por uma rota autenticada.
//
// Referência gravada no banco (campo fileUrl):
//   storage:<caminho>   -> objeto no bucket do Supabase
//   local:<caminho>     -> arquivo na pasta privada local
//   /uploads/<arquivo>  -> formato antigo (disco do servidor), apenas leitura
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const LOCAL_ROOT = path.join(__dirname, '..', '..', 'private-files');
const LEGACY_ROOT = path.join(__dirname, '..', '..', 'uploads');

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'arquivos';
  return { url, key, bucket, remote: Boolean(url && key) };
}

function isRemote() {
  return config().remote;
}

function safeExtension(originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

function buildKey(folder, originalName) {
  const cleanFolder = String(folder || 'geral').replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'geral';
  return `${cleanFolder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExtension(originalName)}`;
}

function encodeKey(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function headers(extra = {}) {
  const { key } = config();
  // Chaves novas (sb_secret_...) vão só no cabeçalho apikey; a chave antiga
  // service_role (JWT) também precisa ir como Bearer.
  if (key.startsWith('sb_')) return { apikey: key, ...extra };
  return { Authorization: `Bearer ${key}`, apikey: key, ...extra };
}

let bucketReady = null;
async function ensureBucket() {
  if (bucketReady) return bucketReady;
  const { url, bucket } = config();
  bucketReady = (async () => {
    const found = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers: headers() });
    if (found.ok) {
      const info = await found.json().catch(() => ({}));
      if (info.public) throw new Error(`O bucket "${bucket}" do Supabase está público. Ele precisa ser privado.`);
      return;
    }
    const created = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
    if (!created.ok && created.status !== 409) {
      throw new Error(`Não foi possível criar o bucket "${bucket}" no Supabase (HTTP ${created.status}).`);
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

function resolveLocalPath(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw Object.assign(new Error('Arquivo inválido.'), { status: 400 });
  return target;
}

// Grava o arquivo e devolve a referência a ser salva no banco.
async function saveFile({ buffer, originalName, mimeType, folder }) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Arquivo ausente.');
  const key = buildKey(folder, originalName);
  const { url, bucket, remote } = config();

  if (remote) {
    await ensureBucket();
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeKey(key)}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': mimeType || 'application/octet-stream', 'x-upsert': 'false' }),
      body: buffer,
    });
    if (!response.ok) throw new Error(`Falha ao guardar o arquivo no Supabase Storage (HTTP ${response.status}).`);
    return `storage:${key}`;
  }

  const target = resolveLocalPath(LOCAL_ROOT, key);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return `local:${key}`;
}

// Lê o conteúdo de um arquivo a partir da referência gravada no banco.
// Retorna null se o arquivo não existir mais.
async function readFile(ref) {
  if (!ref) return null;
  if (ref.startsWith('storage:')) {
    const { url, bucket, remote } = config();
    if (!remote) throw new Error('Supabase Storage não configurado neste ambiente.');
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeKey(ref.slice(8))}`, { headers: headers() });
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new Error(`Falha ao ler o arquivo no Supabase Storage (HTTP ${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }
  let target;
  if (ref.startsWith('local:')) target = resolveLocalPath(LOCAL_ROOT, ref.slice(6));
  else if (ref.startsWith('/uploads/')) target = resolveLocalPath(LEGACY_ROOT, path.basename(ref));
  else return null;
  return fs.existsSync(target) ? fs.readFileSync(target) : null;
}

// Remove o arquivo. Falhas são registradas, mas não impedem a exclusão do registro.
async function deleteFile(ref) {
  if (!ref) return;
  try {
    if (ref.startsWith('storage:')) {
      const { url, bucket, remote } = config();
      if (!remote) return;
      await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
        method: 'DELETE',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prefixes: [ref.slice(8)] }),
      });
      return;
    }
    let target;
    if (ref.startsWith('local:')) target = resolveLocalPath(LOCAL_ROOT, ref.slice(6));
    else if (ref.startsWith('/uploads/')) target = resolveLocalPath(LEGACY_ROOT, path.basename(ref));
    if (target && fs.existsSync(target)) fs.unlinkSync(target);
  } catch (error) {
    console.error('Falha ao remover arquivo armazenado:', error.message);
  }
}

module.exports = { saveFile, readFile, deleteFile, isRemote, _private: { buildKey, resetBucketCache: () => { bucketReady = null; } } };
