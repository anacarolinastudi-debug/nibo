const { z } = require('zod');
const prisma = require('../lib/prisma');
const { logoDataUrl } = require('../utils/firmLogo');

const schema = z.object({
  title: z.string().trim().min(1, 'Informe o nome do conteudo.').max(160),
  status: z.enum(['DRAFT', 'READY']).default('DRAFT'),
  settings: z.object({
    template: z.enum(['cover', 'tip', 'quote']),
    accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    fontSize: z.number().int().min(48).max(112),
    background: z.enum(['organic', 'plain', 'white', 'photo']).optional(),
    photoPanel: z.enum(['white', 'blue']).optional(),
    photoPages: z.enum(['white', 'blue']).optional(),
    coverPhoto: z.object({
      dataUrl: z.string().max(1300000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).refine(value => { try { return logoDataUrl(Buffer.from(value.split(',')[1], 'base64')) === value; } catch { return false; } }, 'Imagem da capa invalida.'),
      title: z.string().max(200).default(''), creator: z.string().max(120).default(''),
      sourceUrl: z.union([z.string().url().startsWith('https://').max(2048), z.literal('')]).default(''),
      license: z.string().max(50).default(''), licenseUrl: z.union([z.string().url().startsWith('https://').max(2048), z.literal('')]).default(''),
      mode: z.enum(['auto', 'manual']).default('manual'), query: z.string().max(200).default(''),
    }).nullable().optional(),
    photoX: z.number().min(0).max(100).optional(), photoY: z.number().min(0).max(100).optional(), photoMono: z.boolean().optional(),
    profileHandle: z.string().max(100).optional(),
    caption: z.string().max(5000).default(''),
    reviewNotes: z.string().max(1500).optional(),
    sources: z.array(z.object({ title: z.string().max(300), url: z.string().url().startsWith('https://').max(2048) })).max(12).optional(),
    slides: z.array(z.object({
      eyebrow: z.string().max(60), headline: z.string().max(200),
      highlight: z.string().max(100).optional(),
      body: z.string().max(800), footer: z.string().max(100),
    })).min(1).max(10),
  }),
});
const scope = (req) => ({ accountingFirmId: req.user.accountingFirmId });
async function list(req, res) {
  res.json(await prisma.contentProject.findMany({ where: scope(req), orderBy: { updatedAt: 'desc' } }));
}
async function create(req, res) {
  const data = schema.parse(req.body);
  res.status(201).json(await prisma.contentProject.create({ data: { ...data, ...scope(req) } }));
}
async function update(req, res) {
  const data = schema.parse(req.body);
  const where = { id: req.params.id, ...scope(req) };
  const result = await prisma.contentProject.updateMany({ where, data });
  if (!result.count) return res.status(404).json({ error: 'Conteudo nao encontrado.' });
  res.json(await prisma.contentProject.findFirst({ where }));
}
async function remove(req, res) {
  const result = await prisma.contentProject.deleteMany({ where: { id: req.params.id, ...scope(req) } });
  if (!result.count) return res.status(404).json({ error: 'Conteudo nao encontrado.' });
  res.status(204).send();
}
module.exports = { list, create, update, remove };
