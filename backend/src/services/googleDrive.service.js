// Acesso ao Google Drive por uma conta de serviço do Google Cloud.
// A conta de serviço só enxerga as pastas que forem compartilhadas com o e-mail
// dela (como Editor). A chave fica na variável GOOGLE_SERVICE_ACCOUNT_JSON do Render
// (o JSON inteiro, ou o mesmo conteúdo em base64).
const jwt = require('jsonwebtoken');

const SCOPE = 'https://www.googleapis.com/auth/drive';
const API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

let cachedToken = null;

function readServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(text);
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isConfigured() {
  return Boolean(readServiceAccount());
}

function serviceAccountEmail() {
  return readServiceAccount()?.client_email || null;
}

async function getAccessToken({ fetchImpl = fetch } = {}) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const account = readServiceAccount();
  if (!account) throw Object.assign(new Error('Google Drive não configurado: falta a variável GOOGLE_SERVICE_ACCOUNT_JSON no servidor.'), { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: account.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    account.private_key.replace(/\\n/g, '\n'),
    { algorithm: 'RS256' },
  );
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw Object.assign(new Error(`O Google recusou a conta de serviço (${data.error_description || data.error || response.status}).`), { status: 502 });
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

async function driveRequest(path, { method = 'GET', query = {}, body, raw = false, fetchImpl = fetch } = {}) {
  const token = await getAccessToken({ fetchImpl });
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries({ supportsAllDrives: 'true', ...query })) url.searchParams.set(key, value);
  const response = await fetchImpl(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message = detail.error?.message || `HTTP ${response.status}`;
    const hint = response.status === 404 ? ' Confira se a pasta foi compartilhada com a conta de serviço como Editor.' : '';
    throw Object.assign(new Error(`Erro no Google Drive: ${message}.${hint}`), { status: response.status === 404 ? 400 : 502 });
  }
  if (raw) return Buffer.from(await response.arrayBuffer());
  return response.json();
}

// Aceita o link da pasta ou só o ID.
function folderIdFromInput(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  const fromUrl = value.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || value.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : null;
}

function escapeQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function getFolder(folderId, options) {
  const data = await driveRequest(`/files/${encodeURIComponent(folderId)}`, { ...options, query: { fields: 'id,name,mimeType,capabilities(canAddChildren,canEdit)' } });
  if (data.mimeType !== FOLDER_MIME) throw Object.assign(new Error('O link informado não é de uma pasta do Drive.'), { status: 400 });
  return data;
}

async function listChildren(folderId, { foldersOnly = false, filesOnly = false, ...options } = {}) {
  const items = [];
  let pageToken;
  const typeFilter = foldersOnly ? ` and mimeType = '${FOLDER_MIME}'` : filesOnly ? ` and mimeType != '${FOLDER_MIME}'` : '';
  do {
    const data = await driveRequest('/files', {
      ...options,
      query: {
        q: `'${escapeQuery(folderId)}' in parents and trashed = false${typeFilter}`,
        fields: 'nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime,parents)',
        pageSize: '200',
        includeItemsFromAllDrives: 'true',
        ...(pageToken ? { pageToken } : {}),
      },
    });
    items.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

async function downloadFile(fileId, options) {
  return driveRequest(`/files/${encodeURIComponent(fileId)}`, { ...options, query: { alt: 'media' }, raw: true });
}

async function createFolder(parentId, name, options) {
  return driveRequest('/files', { ...options, method: 'POST', query: { fields: 'id,name' }, body: { name, mimeType: FOLDER_MIME, parents: [parentId] } });
}

// Move o arquivo (não copia nem apaga): tira da pasta de origem e põe na de destino.
async function moveFile(fileId, fromFolderId, toFolderId, options) {
  return driveRequest(`/files/${encodeURIComponent(fileId)}`, {
    ...options,
    method: 'PATCH',
    query: { addParents: toFolderId, removeParents: fromFolderId, fields: 'id,parents' },
    body: {},
  });
}

module.exports = {
  isConfigured,
  serviceAccountEmail,
  folderIdFromInput,
  getFolder,
  listChildren,
  downloadFile,
  createFolder,
  moveFile,
  FOLDER_MIME,
  _private: { resetToken: () => { cachedToken = null; } },
};
