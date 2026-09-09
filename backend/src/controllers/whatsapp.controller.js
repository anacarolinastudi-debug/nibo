const { z } = require('zod');
const prisma = require('../lib/prisma');

function firmWhere(req) {
  return { accountingFirmId: req.user.accountingFirmId };
}

function isSendConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function isEvolutionConfigured() {
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE_NAME);
}

function getApiBase(req) {
  const configuredUrl = process.env.PUBLIC_API_URL || 'https://nibo-clone-api.onrender.com';
  return configuredUrl.replace(/^http:\/\//, 'https://').replace(/\/+$/, '');
}

function getEvolutionBaseUrl() {
  return process.env.EVOLUTION_API_URL?.replace(/\/+$/, '');
}

function normalizeEvolutionPhone(phoneNumber) {
  return phoneNumber.replace(/\D/g, '');
}

async function evolutionRequest(path, options = {}) {
  const baseUrl = getEvolutionBaseUrl();
  if (!baseUrl) throw new Error('Evolution API não configurada.');

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: process.env.EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(Array.isArray(detail) ? detail.join(', ') : detail);
  }
  return data;
}

function getStatus(req, res) {
  const sendMissing = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'].filter((key) => !process.env[key]);
  const webhookMissing = ['WHATSAPP_VERIFY_TOKEN'].filter((key) => !process.env[key]);
  const evolutionMissing = ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE_NAME'].filter((key) => !process.env[key]);
  const apiBase = getApiBase(req);
  const evolutionConfigured = isEvolutionConfigured();
  const metaConfigured = [...sendMissing, ...webhookMissing].length === 0;
  res.json({
    provider: evolutionConfigured ? 'evolution' : 'meta',
    configured: evolutionConfigured || metaConfigured,
    sendConfigured: evolutionConfigured || sendMissing.length === 0,
    webhookConfigured: evolutionConfigured || webhookMissing.length === 0,
    evolutionConfigured,
    evolutionMissing,
    evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME || null,
    missing: evolutionConfigured ? [] : evolutionMissing,
    metaMissing: [...sendMissing, ...webhookMissing],
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    webhookUrl: `${apiBase}/api/whatsapp/webhook?firmId=${req.user.accountingFirmId}`,
    evolutionWebhookUrl: `${apiBase}/api/whatsapp/evolution/webhook?firmId=${req.user.accountingFirmId}`,
  });
}

// Etapa de verificação exigida pela Meta ao cadastrar a URL do webhook.
// Documentação: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

async function findOrCreateConversation(accountingFirmId, phoneNumber, contactName) {
  const existing = await prisma.whatsAppConversation.findUnique({
    where: { accountingFirmId_phoneNumber: { accountingFirmId, phoneNumber } },
  });
  if (existing) return existing;

  const client = await prisma.client.findFirst({
    where: { accountingFirmId, phone: phoneNumber },
  });

  return prisma.whatsAppConversation.create({
    data: {
      accountingFirmId,
      phoneNumber,
      contactName: contactName || client?.name || null,
      clientId: client?.id || null,
    },
  });
}

// Recebe as notificações de mensagens enviadas pela Meta. O formato exato
// segue o payload do WhatsApp Cloud API (entry[].changes[].value.messages[]).
async function receiveWebhook(req, res) {
  res.sendStatus(200); // a Meta exige resposta rápida; processamos depois

  try {
    const fallbackFirm = await prisma.accountingFirm.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const accountingFirmId = value.metadata?.accountingFirmId || req.query.firmId || fallbackFirm?.id;
        if (!accountingFirmId) continue;

        for (const statusUpdate of value.statuses || []) {
          const nextStatus = {
            sent: 'ENVIADA',
            delivered: 'ENTREGUE',
            read: 'LIDA',
            failed: 'FALHA',
          }[statusUpdate.status];

          if (!nextStatus || !statusUpdate.id) continue;
          await prisma.whatsAppMessage.updateMany({
            where: { waMessageId: statusUpdate.id },
            data: { status: nextStatus },
          });
        }

        for (const message of value.messages || []) {
          const phoneNumber = message.from;
          const contact = (value.contacts || []).find((item) => item.wa_id === phoneNumber);
          const conversation = await findOrCreateConversation(accountingFirmId, phoneNumber, contact?.profile?.name);
          const body = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || null;
          const mediaUrl = message.image?.id || message.document?.id || message.audio?.id || message.video?.id || null;

          await prisma.whatsAppMessage.create({
            data: {
              conversationId: conversation.id,
              direction: 'ENTRADA',
              body,
              mediaUrl,
              waMessageId: message.id,
              status: 'RECEBIDA',
            },
          });

          await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date(), status: 'ABERTA' },
          });
        }
      }
    }
  } catch {
    // Falhas aqui não devem afetar a resposta já enviada à Meta.
  }
}

async function receiveEvolutionWebhook(req, res) {
  res.sendStatus(200);

  try {
    const fallbackFirm = await prisma.accountingFirm.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
    const accountingFirmId = req.query.firmId || fallbackFirm?.id;
    if (!accountingFirmId) return;

    const payload = req.body || {};
    const event = payload.event || payload.type;
    const data = payload.data || payload;
    const key = data.key || {};
    const isOutgoing = Boolean(key.fromMe || data.fromMe);
    const remoteJid = key.remoteJid || data.remoteJid || data.chatId || data.from || data.sender;
    const phoneNumber = normalizeEvolutionPhone(String(remoteJid || '').split('@')[0]);
    if (!phoneNumber) return;

    const messageBody =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      data.message?.documentMessage?.caption ||
      data.text ||
      data.body ||
      null;
    const waMessageId = key.id || data.messageId || data.id || null;

    if (event === 'messages.update' || event === 'MESSAGES_UPDATE') {
      const status = data.status || data.update?.status;
      const nextStatus = {
        PENDING: 'PENDENTE',
        SERVER_ACK: 'ENVIADA',
        DELIVERY_ACK: 'ENTREGUE',
        READ: 'LIDA',
        PLAYED: 'LIDA',
        ERROR: 'FALHA',
      }[status];
      if (nextStatus && waMessageId) {
        await prisma.whatsAppMessage.updateMany({ where: { waMessageId }, data: { status: nextStatus } });
      }
      return;
    }

    if (!messageBody && !data.message) return;
    const conversation = await findOrCreateConversation(accountingFirmId, phoneNumber, data.pushName || data.senderName);

    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: isOutgoing ? 'SAIDA' : 'ENTRADA',
        body: messageBody,
        mediaUrl: data.message?.imageMessage?.url || data.message?.documentMessage?.url || null,
        waMessageId,
        status: isOutgoing ? 'ENVIADA' : 'RECEBIDA',
      },
    });

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: 'ABERTA' },
    });
  } catch {
    // O webhook precisa responder rápido; falhas ficam isoladas.
  }
}

async function setEvolutionWebhook(webhookUrl) {
  const instance = process.env.EVOLUTION_INSTANCE_NAME;
  return evolutionRequest(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      base64: true,
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    }),
  });
}

async function connectEvolution(req, res) {
  if (!isEvolutionConfigured()) return res.status(400).json({ error: 'Evolution API ainda não configurada.' });
  const apiBase = getApiBase(req);
  const webhookUrl = `${apiBase}/api/whatsapp/evolution/webhook?firmId=${req.user.accountingFirmId}`;

  const webhookResult = await setEvolutionWebhook(webhookUrl).catch((error) => ({ error: error.message }));
  if (webhookResult?.error) {
    return res.status(502).json({ error: `Não foi possível sincronizar o webhook: ${webhookResult.error}` });
  }

  res.json({ webhookUrl, result: { message: 'Webhook sincronizado.' }, webhookResult });
}

async function getEvolutionQr(req, res) {
  if (!isEvolutionConfigured()) return res.status(400).json({ error: 'Evolution API ainda não configurada.' });
  const instance = process.env.EVOLUTION_INSTANCE_NAME;

  try {
    const result = await evolutionRequest(`/instance/connect/${encodeURIComponent(instance)}`);
    res.json({
      pairingCode: result?.pairingCode || null,
      qrCode: result?.base64 || result?.qrcode?.base64 || result?.data?.code || result?.data?.qrcode || result?.code || null,
      raw: result,
    });
  } catch (error) {
    res.status(502).json({ error: `Não foi possível gerar o QR Code: ${error.message}` });
  }
}

async function listConversations(req, res) {
  const conversations = await prisma.whatsAppConversation.findMany({
    where: firmWhere(req),
    orderBy: { lastMessageAt: 'desc' },
    include: { client: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  res.json(conversations);
}

const createConversationSchema = z.object({
  phoneNumber: z.string().min(8),
  contactName: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
});

async function createConversation(req, res) {
  const data = createConversationSchema.parse(req.body);
  const conversation = await prisma.whatsAppConversation.upsert({
    where: { accountingFirmId_phoneNumber: { accountingFirmId: req.user.accountingFirmId, phoneNumber: data.phoneNumber } },
    update: { contactName: data.contactName || undefined, clientId: data.clientId || undefined },
    create: {
      accountingFirmId: req.user.accountingFirmId,
      phoneNumber: data.phoneNumber,
      contactName: data.contactName || null,
      clientId: data.clientId || null,
    },
    include: { client: true },
  });
  res.status(201).json(conversation);
}

async function getConversationMessages(req, res) {
  const conversation = await prisma.whatsAppConversation.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });
  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ conversation, messages });
}

const sendMessageSchema = z.object({ body: z.string().min(1) });

async function sendMessage(req, res) {
  const conversation = await prisma.whatsAppConversation.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });
  const { body } = sendMessageSchema.parse(req.body);

  let status = 'NAO_CONFIGURADO';
  let waMessageId = null;

  if (isEvolutionConfigured()) {
    try {
      const instance = process.env.EVOLUTION_INSTANCE_NAME;
      const result = await evolutionRequest(`/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        body: JSON.stringify({
          number: normalizeEvolutionPhone(conversation.phoneNumber),
          text: body,
        }),
      });
      status = 'ENVIADA';
      waMessageId = result?.key?.id || result?.messageId || result?.id || null;
    } catch {
      status = 'FALHA';
    }
  } else if (isSendConfigured()) {
    try {
      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
      const response = await fetch(`https://graph.facebook.com/${apiVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: conversation.phoneNumber,
          type: 'text',
          text: { body },
        }),
      });
      const result = await response.json();
      if (response.ok) {
        status = 'ENVIADA';
        waMessageId = result.messages?.[0]?.id || null;
      } else {
        status = 'FALHA';
      }
    } catch {
      status = 'FALHA';
    }
  }

  const message = await prisma.whatsAppMessage.create({
    data: { conversationId: conversation.id, direction: 'SAIDA', body, status, waMessageId },
  });
  await prisma.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  res.status(201).json(message);
}

module.exports = {
  getStatus,
  verifyWebhook,
  receiveWebhook,
  receiveEvolutionWebhook,
  connectEvolution,
  getEvolutionQr,
  listConversations,
  createConversation,
  getConversationMessages,
  sendMessage,
};
