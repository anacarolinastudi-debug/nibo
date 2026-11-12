const crypto = require('node:crypto');
const { getJwtSecret } = require('./jwt');

// Token por escritório incluído na URL dos webhooks do WhatsApp (Meta e Evolution).
// Sem ele, qualquer pessoa poderia enviar mensagens falsas para a caixa de um escritório.
function webhookToken(accountingFirmId) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET || getJwtSecret();
  return crypto.createHmac('sha256', secret).update(`whatsapp-webhook:${accountingFirmId}`).digest('hex').slice(0, 40);
}

function isValidWebhookToken(accountingFirmId, token) {
  if (!accountingFirmId || typeof token !== 'string' || !token) return false;
  const expected = Buffer.from(webhookToken(accountingFirmId));
  const received = Buffer.from(token);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function buildWebhookUrl(apiBase, path, accountingFirmId) {
  return `${apiBase}${path}?firmId=${encodeURIComponent(accountingFirmId)}&token=${webhookToken(accountingFirmId)}`;
}

module.exports = { webhookToken, isValidWebhookToken, buildWebhookUrl };
