const { z } = require('zod');
const prisma = require('../lib/prisma');
const crypto = require('../utils/certCrypto');
const { logoDataUrl } = require('../utils/firmLogo');
const { generateContentWithAI, generationInputSchema } = require('../services/contentAi.service');
const active = new Set();

async function settings(req, res) {
  const row = await prisma.contentStudioSettings.findUnique({ where: { accountingFirmId: req.user.accountingFirmId } });
  res.json({ configured: Boolean(row?.apiKeyEncrypted || process.env.OPENAI_API_KEY), customKey: Boolean(row?.apiKeyEncrypted), logoUrl: row?.logoUrl || null });
}
async function saveKey(req, res) {
  const data = z.object({ apiKey: z.string().trim().min(20).max(2048).regex(/^sk-[A-Za-z0-9_-]+$/, 'Informe uma chave valida da OpenAI.') }).parse(req.body);
  if (!crypto.isConfigured()) return res.status(503).json({ error: 'A criptografia do servidor precisa ser configurada antes de conectar a IA.' });
  const encrypted = crypto.encrypt(data.apiKey);
  await prisma.contentStudioSettings.upsert({
    where: { accountingFirmId: req.user.accountingFirmId },
    create: { accountingFirmId: req.user.accountingFirmId, apiKeyEncrypted: encrypted },
    update: { apiKeyEncrypted: encrypted },
  });
  res.json({ configured: true });
}
async function removeKey(req, res) {
  await prisma.contentStudioSettings.updateMany({ where: { accountingFirmId: req.user.accountingFirmId }, data: { apiKeyEncrypted: null } });
  res.json({ configured: Boolean(process.env.OPENAI_API_KEY) });
}
async function uploadLogo(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Selecione a logo.' });
  const logoUrl = logoDataUrl(req.file.buffer);
  await prisma.contentStudioSettings.upsert({
    where: { accountingFirmId: req.user.accountingFirmId },
    create: { accountingFirmId: req.user.accountingFirmId, logoUrl }, update: { logoUrl },
  });
  res.json({ logoUrl });
}
async function generate(req, res) {
  const brief = generationInputSchema.parse(req.body);
  const firmId = req.user.accountingFirmId;
  if (active.has(firmId)) return res.status(429).json({ error: 'Ja existe uma geracao em andamento para o escritorio.' });
  active.add(firmId);
  try {
    const row = await prisma.contentStudioSettings.findUnique({ where: { accountingFirmId: firmId } });
    let key = process.env.OPENAI_API_KEY;
    if (row?.apiKeyEncrypted) {
      try { key = crypto.decrypt(row.apiKeyEncrypted).toString('utf8'); }
      catch { return res.status(503).json({ error: 'Reconecte a chave em Configurar IA.' }); }
    }
    if (!key) return res.status(409).json({ error: 'Conecte uma chave da OpenAI em Configurar IA para gerar os conteudos.', code: 'AI_NOT_CONFIGURED' });
    const firm = await prisma.accountingFirm.findUnique({ where: { id: firmId }, select: { name: true } });
    res.json(await generateContentWithAI({ apiKey: key, brief, firmName: firm?.name }));
  } finally { active.delete(firmId); }
}
module.exports = { settings, saveKey, removeKey, uploadLogo, generate };
