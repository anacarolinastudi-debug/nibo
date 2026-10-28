const { z } = require('zod');
const prisma = require('../lib/prisma');
const crypto = require('../utils/certCrypto');
const { logoDataUrl } = require('../utils/firmLogo');
const { generateContentWithAI, generationInputSchema } = require('../services/contentAi.service');
const active = new Set();

async function settings(req, res) {
  const row = await prisma.contentStudioSettings.findUnique({ where: { accountingFirmId: req.user.accountingFirmId } });
  const provider = row?.provider || 'openai';
  const key = provider === 'gemini' ? row?.geminiKeyEncrypted : row?.apiKeyEncrypted;
  res.json({ provider, configured: Boolean(key || (provider === 'openai' && process.env.OPENAI_API_KEY)), customKey: Boolean(key), logoUrl: row?.logoUrl || null });
}
async function saveKey(req, res) {
  const data = z.object({ provider: z.enum(['openai', 'gemini']).default('openai'), apiKey: z.string().trim().min(20).max(2048).regex(/^[A-Za-z0-9_.-]+$/, 'Informe uma chave de API valida.') }).parse(req.body);
  if (data.provider === 'openai' && !data.apiKey.startsWith('sk-')) return res.status(400).json({ error: 'Informe uma chave valida da OpenAI.' });
  if (!crypto.isConfigured()) return res.status(503).json({ error: 'A criptografia do servidor precisa ser configurada antes de conectar a IA.' });
  const encrypted = crypto.encrypt(data.apiKey);
  const keyData = { provider: data.provider, [data.provider === 'gemini' ? 'geminiKeyEncrypted' : 'apiKeyEncrypted']: encrypted };
  await prisma.contentStudioSettings.upsert({
    where: { accountingFirmId: req.user.accountingFirmId },
    create: { accountingFirmId: req.user.accountingFirmId, ...keyData },
    update: keyData,
  });
  res.json({ configured: true, provider: data.provider });
}
async function removeKey(req, res) {
  const row = await prisma.contentStudioSettings.findUnique({ where: { accountingFirmId: req.user.accountingFirmId } });
  const provider = row?.provider || 'openai';
  await prisma.contentStudioSettings.updateMany({ where: { accountingFirmId: req.user.accountingFirmId }, data: { [provider === 'gemini' ? 'geminiKeyEncrypted' : 'apiKeyEncrypted']: null } });
  res.json({ provider, configured: Boolean(provider === 'openai' && process.env.OPENAI_API_KEY) });
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
    const provider = row?.provider || 'openai';
    const encrypted = provider === 'gemini' ? row?.geminiKeyEncrypted : row?.apiKeyEncrypted;
    let key = provider === 'openai' ? process.env.OPENAI_API_KEY : null;
    if (encrypted) {
      try { key = crypto.decrypt(encrypted).toString('utf8'); }
      catch { return res.status(503).json({ error: 'Reconecte a chave em Configurar IA.' }); }
    }
    if (!key) return res.status(409).json({ error: 'Conecte uma chave em Configurar IA para gerar os conteudos.', code: 'AI_NOT_CONFIGURED' });
    const firm = await prisma.accountingFirm.findUnique({ where: { id: firmId }, select: { name: true } });
    res.json(await generateContentWithAI({ provider, apiKey: key, brief, firmName: firm?.name }));
  } finally { active.delete(firmId); }
}
module.exports = { settings, saveKey, removeKey, uploadLogo, generate };
