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
  department: z.string().optional().nullable(),
  checklist: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean().optional() })).optional(),
  forms: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  settings: z.object({ overdueNotification: z.boolean(), approvalRequired: z.boolean(), checklistRequired: z.boolean() }).optional(),
  processName: z.string().optional().nullable(),
});

const templateSchema = z.object({
  name: z.string().min(2), description: z.string().optional().nullable(), department: z.string().optional().nullable(),
  checklist: z.array(z.any()).default([]), forms: z.array(z.any()).default([]), settings: z.record(z.any()).default({}), active: z.boolean().optional(),
});
const processSchema = z.object({
  name: z.string().min(2), clientId: z.string(), department: z.string().optional().nullable(), responsibleId: z.string().optional().nullable(),
  status: z.string().optional(), progress: z.number().int().min(0).max(100).optional(), startDate: z.string().optional(), dueDate: z.string().optional().nullable(),
  complement: z.string().optional().nullable(), instructions: z.string().optional().nullable(), stages: z.array(z.any()).optional(),
});
const processTemplateSchema = z.object({ name: z.string().min(2), department: z.string().optional().nullable(), instructions: z.string().optional().nullable(), durationDays: z.number().int().min(1).default(30), stages: z.array(z.any()).min(1), active: z.boolean().optional() });

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

async function listTemplates(req, res) {
  res.json(await prisma.taskTemplate.findMany({ where: { accountingFirmId: req.user.accountingFirmId, active: true }, orderBy: { name: 'asc' } }));
}
async function createTemplate(req, res) {
  const data = templateSchema.parse(req.body);
  res.status(201).json(await prisma.taskTemplate.create({ data: { ...data, accountingFirmId: req.user.accountingFirmId } }));
}
async function updateTemplate(req, res) {
  const data = templateSchema.partial().parse(req.body);
  const existing = await prisma.taskTemplate.findFirst({ where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId } });
  if (!existing) return res.status(404).json({ error: 'Modelo não encontrado.' });
  res.json(await prisma.taskTemplate.update({ where: { id: existing.id }, data }));
}
async function removeTemplate(req, res) {
  const existing = await prisma.taskTemplate.findFirst({ where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId } });
  if (!existing) return res.status(404).json({ error: 'Modelo não encontrado.' });
  await prisma.taskTemplate.update({ where: { id: existing.id }, data: { active: false } }); res.status(204).send();
}
async function listProcesses(req, res) {
  res.json(await prisma.taskProcess.findMany({ where: { accountingFirmId: req.user.accountingFirmId }, orderBy: { startDate: 'desc' }, include: { client: { select: { id: true, name: true } }, responsible: { select: { id: true, name: true } } } }));
}
async function createProcess(req, res) {
  const data = processSchema.parse(req.body);
  res.status(201).json(await prisma.taskProcess.create({ data: { ...data, responsibleId: data.responsibleId || req.user.id || req.user.sub, startDate: data.startDate ? new Date(data.startDate) : new Date(), dueDate: data.dueDate ? new Date(data.dueDate) : null, accountingFirmId: req.user.accountingFirmId }, include: { client: true, responsible: { select: { id: true, name: true } } } }));
}
async function updateProcess(req, res) {
  const data = processSchema.partial().parse(req.body);
  const existing = await prisma.taskProcess.findFirst({ where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId } });
  if (!existing) return res.status(404).json({ error: 'Processo não encontrado.' });
  res.json(await prisma.taskProcess.update({ where: { id: existing.id }, data: { ...data, startDate: data.startDate ? new Date(data.startDate) : undefined, dueDate: data.dueDate ? new Date(data.dueDate) : undefined }, include: { client: true, responsible: { select: { id: true, name: true } } } }));
}
async function listProcessTemplates(req, res) {
  res.json(await prisma.processTemplate.findMany({ where: { accountingFirmId: req.user.accountingFirmId, active: true }, orderBy: { name: 'asc' } }));
}
async function createProcessTemplate(req, res) {
  const data = processTemplateSchema.parse(req.body);
  res.status(201).json(await prisma.processTemplate.create({ data: { ...data, accountingFirmId: req.user.accountingFirmId } }));
}
async function updateProcessTemplate(req, res) {
  const data = processTemplateSchema.partial().parse(req.body);
  const existing = await prisma.processTemplate.findFirst({ where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId } });
  if (!existing) return res.status(404).json({ error: 'Modelo de processo não encontrado.' });
  res.json(await prisma.processTemplate.update({ where: { id: existing.id }, data }));
}
async function transferResponsibilities(req, res) {
  const data = z.object({ fromUserId: z.string(), toUserId: z.string(), tasks: z.boolean().default(false), processes: z.boolean().default(false) }).parse(req.body);
  const users = await prisma.user.count({ where: { id: { in: [data.fromUserId, data.toUserId] }, accountingFirmId: req.user.accountingFirmId, active: true } });
  if (users !== 2) return res.status(400).json({ error: 'Selecione dois usuários ativos do escritório.' });
  const result = { tasks: 0, processes: 0 };
  if (data.tasks) result.tasks = (await prisma.demand.updateMany({ where: { assignedToId: data.fromUserId, status: { notIn: ['DONE', 'CANCELED'] }, client: { accountingFirmId: req.user.accountingFirmId } }, data: { assignedToId: data.toUserId } })).count;
  if (data.processes) result.processes = (await prisma.taskProcess.updateMany({ where: { responsibleId: data.fromUserId, accountingFirmId: req.user.accountingFirmId, status: { not: 'CONCLUIDO' } }, data: { responsibleId: data.toUserId } })).count;
  res.json(result);
}

module.exports = { list, getById, create, update, updateStatus, addComment, remove, listTemplates, createTemplate, updateTemplate, removeTemplate, listProcesses, createProcess, updateProcess, listProcessTemplates, createProcessTemplate, updateProcessTemplate, transferResponsibilities };
