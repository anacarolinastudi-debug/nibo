import api from './client';

export function getStatus() {
  return api.get('/whatsapp/status').then((res) => res.data);
}

export function listConversations() {
  return api.get('/whatsapp/conversations').then((res) => res.data);
}

export function createConversation(data) {
  return api.post('/whatsapp/conversations', data).then((res) => res.data);
}

export function getConversationMessages(id) {
  return api.get(`/whatsapp/conversations/${id}/messages`).then((res) => res.data);
}

export function sendMessage(id, body) {
  return api.post(`/whatsapp/conversations/${id}/messages`, { body }).then((res) => res.data);
}
