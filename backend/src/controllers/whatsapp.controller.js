const { z } = require('zod');
const prisma = require('../lib/prisma');

function firmWhere(req) {
  return { accountingFirmId: req.user.accountingFirmId };
}

function isSendConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function getStatus(req, res) {
  const sendMissing = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'].filter((key) => !process.env[key]);
  const webhookMissing = ['WHATSAPP_VERIFY_TOKEN'].filter((key) => !process.env[key]);
  const missing = [...sendMissing, ...webhookMissing];
  const apiBase = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    configured: missing.length === 0,
    sendConfigured: sendMissing.length === 0,
    webhookConfigured: webhookMissing.length === 0,
    missing,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    webhookUrl: `${apiBase}/api/whatsapp/webhook?firmId=${req.user.accountingFirmId}`,
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

  if (isSendConfigured()) {
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
  listConversations,
  createConversation,
  getConversationMessages,
  sendMessage,
};
