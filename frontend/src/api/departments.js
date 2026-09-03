import api from './client';

export function listDepartments() {
  return api.get('/departments').then((res) => res.data);
}

export function createDepartment(data) {
  return api.post('/departments', data).then((res) => res.data);
}

export function updateDepartment(id, data) {
  return api.put(`/departments/${id}`, data).then((res) => res.data);
}

export function removeDepartment(id) {
  return api.delete(`/departments/${id}`);
}

export function getClientMatrix() {
  return api.get('/departments/client-matrix/list').then((res) => res.data);
}

export function upsertClientMatrix(data) {
  return api.post('/departments/client-matrix', data).then((res) => res.data);
}

export function listFirmRoles() {
  return api.get('/departments/firm-roles/list').then((res) => res.data);
}

export function createFirmRole(data) {
  return api.post('/departments/firm-roles', data).then((res) => res.data);
}

export function removeFirmRole(id) {
  return api.delete(`/departments/firm-roles/${id}`);
}
