const { z } = require('zod');
const prisma = require('../lib/prisma');

const demandSchema = z.object({
  title: z.string().min(2, 'Título é obrigatório.'),
  description: z.string().optional().nullable(),
  category: z.enum(['FISCAL', 'CONTABIL', 'FOLHA_PAGAMENTO', 'SOCIETARIO', 'FINANCEIRO', 'DOCUMENTACAO', 'OUTROS']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  clientId: z.string().uuid('Cliente inválido.'),
  assignedToId: z.string().uuid().optional().nullable(),
  recurrence: z.enum(['NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'WAITING_CLIENT', 'DONE', 'CANCELED']),
});

// Garante que o usuário só acesse demandas da própria empresa (se for CLIENT)
// ou do próprio escritório (se for ADMIN/ACCOUNTANT).
function buildScopeFilter(user) {
  if (user.role === 'CLIENT') {
    return { clientId: user.clientId };
  }
  return { client: { accountingFirmId: user.accountingFirmId } };
}

async function list(req, res) {
  const { status, clientId, assignedToId, category } = req.query;

  const where = {
    ...buildScopeFilter(req.user),
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(category ? { category } : {}),
  };

  const demands = await prisma.demand.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });

  res.json(demands);
}

async function getById(req, res) {
  const demand = await prisma.demand.findFirst({
    where: { id: req.params.id, ...buildScopeFilter(req.user) },
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      attachments: true,
    },
  });
  if (!demand) return res.status(404).json({ error: 'Demanda não encontrada.' });
  res.json(demand);
}

async function create(req, res) {
  // Usuário do portal do cliente não pode criar demanda para outra empresa.
  if (req.user.role === 'CLIENT') {
    req.body.clientId = req.user.clientId;
  }

  const data = demandSchema.parse(req.body);

  const demand = await prisma.demand.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdById: req.user.sub,
    },
  });

  res.status(201).json(demand);
}

async function update(req, res) {
  const data = demandSchema.partial().parse(req.body);

  const existing = await prisma.demand.findFirst({ where: { id: req.params.id, ...buildScopeFilter(req.user) } });
  if (!existing) return res.status(404).json({ error: 'Demanda não encontrada.' });

  const demand = await prisma.demand.update({
    where: { id: req.params.id },
    data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
  });

  res.json(demand);
}

async function updateStatus(req, res) {
  const { status } = updateStatusSchema.parse(req.body);

  const existing = await prisma.demand.findFirst({ where: { id: req.params.id, ...buildScopeFilter(req.user) } });
  if (!existing) return res.status(404).json({ error: 'Demanda não encontrada.' });

  const demand = await prisma.demand.update({
    where: { id: req.params.id },
    data: { status, completedAt: status === 'DONE' ? new Date() : null },
  });

  res.json(demand);
}

async function addComment(req, res) {
  const { message } = z.object({ message: z.string().min(1, 'Mensagem vazia.') }).parse(req.body);

  const existing = await prisma.demand.findFirst({ where: { id: req.params.id, ...buildScopeFilter(req.user) } });
  if (!existing) return res.status(404).json({ error: 'Demanda não encontrada.' });

  const comment = await prisma.demandComment.create({
    data: { message, demandId: req.params.id, authorId: req.user.sub },
    include: { author: { select: { id: true, name: true } } },
  });

  res.status(201).json(comment);
}

async function remove(req, res) {
  const existing = await prisma.demand.findFirst({ where: { id: req.params.id, ...buildScopeFilter(req.user) } });
  if (!existing) return res.status(404).json({ error: 'Demanda não encontrada.' });

  await prisma.demand.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { list, getById, create, update, updateStatus, addComment, remove };
