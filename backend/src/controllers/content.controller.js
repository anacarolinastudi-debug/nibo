const { z } = require('zod');
const prisma = require('../lib/prisma');

const schema = z.object({
  title: z.string().trim().min(1, 'Informe o nome do conteudo.').max(160),
  status: z.enum(['DRAFT', 'READY']).default('DRAFT'),
  settings: z.object({
    template: z.enum(['cover', 'tip', 'quote']),
    accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    fontSize: z.number().int().min(48).max(112),
    caption: z.string().max(5000).default(''),
    slides: z.array(z.object({
      eyebrow: z.string().max(60), headline: z.string().max(200),
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
