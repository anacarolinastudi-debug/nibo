const { z } = require('zod');
const fs = require('fs/promises');
const pdfParse = require('pdf-parse');
const prisma = require('../lib/prisma');

const obligationSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['PAGAMENTO', 'CADASTRAL', 'DECLARACAO', 'DOCUMENTO', 'OUTRO']).default('PAGAMENTO'),
  department: z.string().min(2),
  nickname: z.string().optional().nullable(),
  frequency: z.enum(['NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  status: z.enum(['ATIVO', 'INATIVO']).default('ATIVO'),
  defaultRobot: z.boolean().optional(),
  physicalOnly: z.boolean().optional(),
  dueControl: z.boolean().optional(),
  internalGoalDays: z.number().int().optional().nullable(),
  ruleMonth: z.number().int().min(1).max(12).optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  dueDateRule: z.enum(['ANTECIPA', 'POSTERGA']).optional(),
  saturdayBusinessDay: z.boolean().optional(),
});

const groupSchema = z.object({
  nickname: z.string().min(1),
  name: z.string().min(2),
  obligationIds: z.array(z.string()).default([]),
});

const linkSchema = z.object({
  clientId: z.string(),
  obligationId: z.string(),
  responsibleId: z.string().optional().nullable(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
});

const robotSchema = z.object({
  obligationId: z.string(),
  name: z.string().optional().nullable(),
  identifiers: z.array(z.string().min(1)).default([]),
  active: z.boolean().optional(),
});

function firmWhere(req) {
  return { accountingFirmId: req.user.accountingFirmId };
}

async function ensureObligation(req, id) {
  return prisma.obligation.findFirst({ where: { id, ...firmWhere(req) } });
}

async function listObligations(req, res) {
  const obligations = await prisma.obligation.findMany({
    where: firmWhere(req),
    orderBy: { name: 'asc' },
    include: { _count: { select: { clientLinks: true, groupItems: true, robots: true } } },
  });
  res.json(obligations);
}

async function createObligation(req, res) {
  const data = obligationSchema.parse(req.body);
  const obligation = await prisma.obligation.create({
    data: { ...data, accountingFirmId: req.user.accountingFirmId },
  });
  res.status(201).json(obligation);
}

async function updateObligation(req, res) {
  const existing = await ensureObligation(req, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Obrigacao nao encontrada.' });
  const data = obligationSchema.partial().parse(req.body);
  const obligation = await prisma.obligation.update({ where: { id: existing.id }, data });
  res.json(obligation);
}

async function removeObligation(req, res) {
  const existing = await ensureObligation(req, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Obrigacao nao encontrada.' });
  await prisma.obligation.update({ where: { id: existing.id }, data: { status: 'INATIVO' } });
  res.status(204).send();
}

async function listGroups(req, res) {
  const groups = await prisma.obligationGroup.findMany({
    where: firmWhere(req),
    orderBy: { nickname: 'asc' },
    include: { items: { include: { obligation: true } } },
  });
  res.json(groups);
}

async function createGroup(req, res) {
  const data = groupSchema.parse(req.body);
  const group = await prisma.obligationGroup.create({
    data: {
      nickname: data.nickname,
      name: data.name,
      accountingFirmId: req.user.accountingFirmId,
      items: { create: data.obligationIds.map((obligationId) => ({ obligationId })) },
    },
    include: { items: { include: { obligation: true } } },
  });
  res.status(201).json(group);
}

async function updateGroup(req, res) {
  const data = groupSchema.parse(req.body);
  const existing = await prisma.obligationGroup.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Grupo nao encontrado.' });

  const group = await prisma.$transaction(async (tx) => {
    await tx.obligationGroupItem.deleteMany({ where: { groupId: existing.id } });
    return tx.obligationGroup.update({
      where: { id: existing.id },
      data: {
        nickname: data.nickname,
        name: data.name,
        items: { create: data.obligationIds.map((obligationId) => ({ obligationId })) },
      },
      include: { items: { include: { obligation: true } } },
    });
  });
  res.json(group);
}

async function linkGroupToClients(req, res) {
  const schema = z.object({
    clientIds: z.array(z.string()).min(1),
    responsibleId: z.string().optional().nullable(),
  });
  const data = schema.parse(req.body);
  const group = await prisma.obligationGroup.findFirst({
    where: { id: req.params.id, ...firmWhere(req) },
    include: { items: true },
  });
  if (!group) return res.status(404).json({ error: 'Grupo nao encontrado.' });

  const operations = [];
  for (const item of group.items) {
    for (const clientId of data.clientIds) {
      operations.push(prisma.clientObligation.upsert({
        where: { clientId_obligationId: { clientId, obligationId: item.obligationId } },
        update: { active: true, responsibleId: data.responsibleId || req.user.id },
        create: { clientId, obligationId: item.obligationId, responsibleId: data.responsibleId || req.user.id },
      }));
    }
  }
  await prisma.$transaction(operations);
  res.json({ linked: operations.length });
}

async function removeGroup(req, res) {
  const existing = await prisma.obligationGroup.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Grupo nao encontrado.' });
  await prisma.obligationGroup.delete({ where: { id: existing.id } });
  res.status(204).send();
}

async function getLinksMatrix(req, res) {
  const [clients, obligations, links] = await Promise.all([
    prisma.client.findMany({ where: { ...firmWhere(req), active: true }, orderBy: { name: 'asc' } }),
    prisma.obligation.findMany({ where: { ...firmWhere(req), status: 'ATIVO' }, orderBy: { name: 'asc' } }),
    prisma.clientObligation.findMany({
      where: { client: firmWhere(req) },
      include: { client: true, obligation: true, responsible: { select: { id: true, name: true } } },
    }),
  ]);
  res.json({ clients, obligations, links });
}

async function upsertClientObligation(req, res) {
  const data = linkSchema.parse(req.body);
  const client = await prisma.client.findFirst({ where: { id: data.clientId, ...firmWhere(req) } });
  const obligation = await ensureObligation(req, data.obligationId);
  if (!client || !obligation) return res.status(404).json({ error: 'Cliente ou obrigacao nao encontrados.' });

  const link = await prisma.clientObligation.upsert({
    where: { clientId_obligationId: { clientId: data.clientId, obligationId: data.obligationId } },
    update: {
      active: data.active ?? true,
      responsibleId: data.responsibleId || req.user.id,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
    },
    create: {
      clientId: data.clientId,
      obligationId: data.obligationId,
      responsibleId: data.responsibleId || req.user.id,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
    },
    include: { client: true, obligation: true, responsible: { select: { id: true, name: true } } },
  });
  res.status(201).json(link);
}

async function removeClientObligation(req, res) {
  const link = await prisma.clientObligation.findFirst({
    where: { id: req.params.id, client: firmWhere(req) },
  });
  if (!link) return res.status(404).json({ error: 'Vinculo nao encontrado.' });
  await prisma.clientObligation.delete({ where: { id: link.id } });
  res.status(204).send();
}

async function listRobots(req, res) {
  const robots = await prisma.obligationRobot.findMany({
    where: firmWhere(req),
    orderBy: { createdAt: 'desc' },
    include: { obligation: true },
  });
  res.json(robots);
}

async function createRobot(req, res) {
  const data = robotSchema.parse(req.body);
  const obligation = await ensureObligation(req, data.obligationId);
  if (!obligation) return res.status(404).json({ error: 'Obrigacao nao encontrada.' });
  const robot = await prisma.obligationRobot.create({
    data: { ...data, accountingFirmId: req.user.accountingFirmId },
    include: { obligation: true },
  });
  res.status(201).json(robot);
}

async function updateRobot(req, res) {
  const data = robotSchema.partial().parse(req.body);
  const existing = await prisma.obligationRobot.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Robo nao encontrado.' });
  const robot = await prisma.obligationRobot.update({
    where: { id: existing.id },
    data,
    include: { obligation: true },
  });
  res.json(robot);
}

async function removeRobot(req, res) {
  const existing = await prisma.obligationRobot.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Robo nao encontrado.' });
  await prisma.obligationRobot.delete({ where: { id: existing.id } });
  res.status(204).send();
}

function normalizeRobotText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function matchRobot(fileName, pdfText, robots) {
  const searchableText = normalizeRobotText(`${fileName} ${pdfText}`);
  const matches = robots
    .filter((robot) => robot.active)
    .flatMap((robot) => robot.identifiers
      .map((identifier) => ({ robot, identifier, normalized: normalizeRobotText(identifier) }))
      .filter(({ normalized }) => normalized && searchableText.includes(normalized)))
    .sort((a, b) => b.normalized.length - a.normalized.length);

  return matches[0] || null;
}

async function extractPdfText(file) {
  if (file.mimetype !== 'application/pdf') return '';
  try {
    const buffer = await fs.readFile(file.path);
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  } catch (error) {
    console.warn(`Nao foi possivel ler o PDF ${file.originalname}:`, error.message);
    return '';
  }
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

async function identifyClient(req, pdfText, requestedClientId) {
  if (requestedClientId) {
    return prisma.client.findFirst({ where: { id: requestedClientId, ...firmWhere(req) } });
  }

  const taxIds = Array.from(new Set((pdfText.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || []).map(onlyDigits)));
  if (!taxIds.length) return null;

  const clients = await prisma.client.findMany({ where: firmWhere(req), select: { id: true, name: true, cnpj: true } });
  return clients.find((client) => taxIds.includes(onlyDigits(client.cnpj))) || null;
}

async function uploadConferenceFile(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Arquivo nao enviado.' });
  const bodySchema = z.object({
    clientId: z.string().optional().nullable(),
    obligationId: z.string().optional().nullable(),
    deliveryType: z.enum(['PORTAL', 'EMAIL', 'FISICA']).default('PORTAL'),
    reference: z.string().optional().nullable(),
  });
  const data = bodySchema.parse(req.body);
  const robots = await prisma.obligationRobot.findMany({
    where: firmWhere(req),
    include: { obligation: true },
  });
  const pdfText = await extractPdfText(req.file);
  const match = matchRobot(req.file.originalname, pdfText, robots);
  const robot = match?.robot;
  const client = await identifyClient(req, pdfText, data.clientId);
  const resolvedObligationId = robot?.obligationId || data.obligationId || null;

  if (client && resolvedObligationId) {
    await prisma.clientObligation.upsert({
      where: { clientId_obligationId: { clientId: client.id, obligationId: resolvedObligationId } },
      update: { active: true },
      create: {
        clientId: client.id,
        obligationId: resolvedObligationId,
        responsibleId: req.user.id,
        active: true,
      },
    });
  }

  const document = await prisma.protocolDocument.create({
    data: {
      accountingFirmId: req.user.accountingFirmId,
      clientId: client?.id || null,
      obligationId: resolvedObligationId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      fileUrl: `/uploads/${req.file.filename}`,
      deliveryType: data.deliveryType,
      reference: data.reference || null,
      status: robot ? 'RECONHECIDO_ROBO' : 'CONFERENCIA',
      robotMatched: Boolean(robot),
      robotIdentifier: match?.identifier || null,
      responsibleId: req.user.id,
    },
    include: { client: true, obligation: true, responsible: { select: { id: true, name: true } } },
  });

  res.status(201).json(document);
}

async function listProtocols(req, res) {
  const protocols = await prisma.protocolDocument.findMany({
    where: firmWhere(req),
    orderBy: { createdAt: 'desc' },
    include: { client: true, obligation: true, responsible: { select: { id: true, name: true } } },
  });
  res.json(protocols);
}

async function confirmProtocol(req, res) {
  const existing = await prisma.protocolDocument.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Documento nao encontrado.' });
  const protocol = await prisma.protocolDocument.update({
    where: { id: existing.id },
    data: { status: 'PROTOCOLADO', protocolDate: new Date(), responsibleId: req.user.id },
    include: { client: true, obligation: true, responsible: { select: { id: true, name: true } } },
  });
  res.json(protocol);
}

const createProtocolSchema = z.object({
  fileName: z.string().min(1),
  clientId: z.string().optional().nullable(),
  obligationId: z.string().optional().nullable(),
  documentType: z.string().optional().nullable(),
  documentNumber: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  payDate: z.string().datetime().optional().nullable(),
  principalValue: z.number().optional().nullable(),
  totalValue: z.number().optional().nullable(),
  recalculo: z.boolean().optional(),
  deliveryType: z.enum(['PORTAL', 'EMAIL', 'FISICA']).default('PORTAL'),
  protocolAs: z.enum(['CORRECAO', 'COMPLEMENTO']).optional().nullable(),
  clientNote: z.string().optional().nullable(),
});

async function createProtocolDocument(req, res) {
  const data = createProtocolSchema.parse(req.body);
  const document = await prisma.protocolDocument.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      payDate: data.payDate ? new Date(data.payDate) : null,
      accountingFirmId: req.user.accountingFirmId,
      responsibleId: req.user.id,
    },
    include: { client: true, obligation: true, responsible: { select: { id: true, name: true } } },
  });
  res.status(201).json(document);
}

const updateProtocolSchema = z.object({
  clientId: z.string().optional().nullable(),
  obligationId: z.string().optional().nullable(),
  documentType: z.string().optional().nullable(),
  documentNumber: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  payDate: z.string().datetime().optional().nullable(),
  principalValue: z.number().optional().nullable(),
  totalValue: z.number().optional().nullable(),
  recalculo: z.boolean().optional(),
  deliveryType: z.enum(['PORTAL', 'EMAIL', 'FISICA']).optional(),
  protocolAs: z.enum(['CORRECAO', 'COMPLEMENTO']).optional().nullable(),
  clientNote: z.string().optional().nullable(),
});

async function updateProtocolDocument(req, res) {
  const existing = await prisma.protocolDocument.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Documento nao encontrado.' });
  const data = updateProtocolSchema.parse(req.body);
  const protocol = await prisma.protocolDocument.update({
    where: { id: existing.id },
    data: {
      ...data,
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      payDate: data.payDate !== undefined ? (data.payDate ? new Date(data.payDate) : null) : undefined,
    },
    include: { client: true, obligation: true, responsible: { select: { id: true, name: true } } },
  });
  res.json(protocol);
}

async function removeProtocolDocument(req, res) {
  const existing = await prisma.protocolDocument.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Documento nao encontrado.' });
  await prisma.protocolDocument.delete({ where: { id: existing.id } });
  res.status(204).send();
}

module.exports = {
  listObligations,
  createObligation,
  updateObligation,
  removeObligation,
  listGroups,
  createGroup,
  updateGroup,
  linkGroupToClients,
  removeGroup,
  getLinksMatrix,
  upsertClientObligation,
  removeClientObligation,
  listRobots,
  createRobot,
  updateRobot,
  removeRobot,
  uploadConferenceFile,
  listProtocols,
  confirmProtocol,
  createProtocolDocument,
  updateProtocolDocument,
  removeProtocolDocument,
};
