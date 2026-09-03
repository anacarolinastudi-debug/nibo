const { z } = require('zod');
const prisma = require('../lib/prisma');

function clientScope(user) {
  if (user.role === 'CLIENT') return { clientId: user.clientId };
  return { client: { accountingFirmId: user.accountingFirmId } };
}

const metaSchema = z.object({
  category: z.enum(['NOTA_FISCAL', 'EXTRATO_BANCARIO', 'CONTRATO', 'GUIA_IMPOSTO', 'COMPROVANTE', 'OUTRO']),
  clientId: z.string().uuid(),
  refMonth: z.coerce.number().int().min(1).max(12).optional(),
  refYear: z.coerce.number().int().min(2000).optional(),
});

async function list(req, res) {
  const { clientId, category } = req.query;
  const documents = await prisma.document.findMany({
    where: {
      ...clientScope(req.user),
      ...(clientId ? { clientId } : {}),
      ...(category ? { category } : {}),
    },
    include: { uploadedBy: { select: { name: true } }, client: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(documents);
}

// O arquivo em si chega via multer (req.file); aqui só gravamos os metadados.
async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;

  const data = metaSchema.parse(req.body);

  const document = await prisma.document.create({
    data: {
      name: req.file.originalname,
      category: data.category,
      fileUrl: `/uploads/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      refMonth: data.refMonth,
      refYear: data.refYear,
      clientId: data.clientId,
      uploadedById: req.user.sub,
    },
  });

  res.status(201).json(document);
}

async function remove(req, res) {
  const existing = await prisma.document.findFirst({ where: { id: req.params.id, ...clientScope(req.user) } });
  if (!existing) return res.status(404).json({ error: 'Documento não encontrado.' });

  await prisma.document.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { list, upload, remove };
