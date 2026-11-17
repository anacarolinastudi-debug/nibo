import api from './client';

export function listNfseClients() {
  return api.get('/nfse/clients').then((res) => res.data);
}

export function uploadClientCertificate(clientId, file, passphrase) {
  const form = new FormData();
  form.append('file', file);
  form.append('passphrase', passphrase);
  return api.post(`/nfse/clients/${clientId}/certificate`, form).then((res) => res.data);
}

export function removeClientCertificate(clientId) {
  return api.delete(`/nfse/clients/${clientId}/certificate`);
}

export function syncNfse(clientId) {
  return api.post(`/nfse/clients/${clientId}/sync`).then((res) => res.data);
}

export function listNfseDocuments(clientId, params) {
  return api.get(`/nfse/clients/${clientId}/documents`, { params }).then((res) => res.data);
}

function saveBlob(response, fallbackName) {
  const header = response.headers['content-disposition'] || '';
  const name = (header.match(/filename="([^"]+)"/) || [])[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadNfseXml(documentId, fallbackName) {
  const response = await api.get(`/nfse/documents/${documentId}/xml`, { responseType: 'blob' });
  saveBlob(response, fallbackName);
}

export async function downloadNfseZip(clientId, params) {
  const response = await api.get(`/nfse/clients/${clientId}/zip`, { params, responseType: 'blob' });
  saveBlob(response, `NFSe_${params.mes}.zip`);
}
