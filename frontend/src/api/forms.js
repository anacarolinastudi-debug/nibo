import api from './client';

export function listForms(params) {
  return api.get('/forms', { params }).then((res) => res.data);
}

export function getForm(id) {
  return api.get(`/forms/${id}`).then((res) => res.data);
}

export function createForm(data) {
  return api.post('/forms', data).then((res) => res.data);
}

export function updateForm(id, data) {
  return api.put(`/forms/${id}`, data).then((res) => res.data);
}

export function toggleFormStatus(id) {
  return api.patch(`/forms/${id}/status`).then((res) => res.data);
}

export function removeForm(id) {
  return api.delete(`/forms/${id}`);
}
