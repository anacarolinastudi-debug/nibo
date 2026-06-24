import api from './client';

export function getStatus() {
  return api.get('/ecac/status').then((res) => res.data);
}

export function getLatestByClient() {
  return api.get('/ecac/clients/latest').then((res) => res.data);
}

export function listChecks() {
  return api.get('/ecac/checks').then((res) => res.data);
}

export function syncClient(clientId) {
  return api.post(`/ecac/clients/${clientId}/sync`).then((res) => res.data);
}
