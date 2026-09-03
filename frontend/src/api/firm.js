import api from './client';

export function getFirm() {
  return api.get('/firm').then((res) => res.data);
}

export function updateFirm(data) {
  return api.put('/firm', data).then((res) => res.data);
}

export function uploadLogo(file) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/firm/logo', form).then((res) => res.data);
}

export function uploadCertificate(file, passphrase) {
  const form = new FormData();
  form.append('file', file);
  form.append('passphrase', passphrase);
  return api.post('/firm/certificate', form).then((res) => res.data);
}

export function removeCertificate() {
  return api.delete('/firm/certificate').then((res) => res.data);
}
