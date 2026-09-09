const { z } = require('zod');
const prisma = require('../lib/prisma');
const { seedCatalogForFirm } = require('../services/obligationCatalog.service');

const optionalText = z.string().optional().nullable();
const clientSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório.'),
  cnpj: z.string().min(11, 'CPF/CNPJ inválido.'),
  personType: z.enum(['JURIDICA', 'FISICA']).default('JURIDICA'),
  code: optionalText,
  stateRegistration: optionalText,
  municipalRegistration: optionalText,
  taxRegime: z.enum(['MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL']),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  phone: optionalText,
  cep: optionalText,
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  state: optionalText,
  city: optionalText,
  neighborhood: optionalText,
  activity: optionalText,
  cnae: optionalText,
  allowPublicDocuments: z.boolean().optional(),
  taxReminderEmail: z.boolean().optional(),
  active: z.boolean().optional(),
});

const contactSchema = z.object({
  clientId: z.string(),
  name: z.string().min(2, 'Nome do contato é obrigatório.'),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  whatsapp: optionalText,
  departments: z.array(z.string()).default([]),
  active: z.boolean().optional(),
});

const firmWhere = (req) => ({ accountingFirmId: req.user.accountingFirmId });

async function list(req, res) {
  const clients = await prisma.client.findMany({
    where: firmWhere(req),
    orderBy: { name: 'asc' },
    include: { _count: { select: { demands: true, contacts: true, obligationLinks: true } } },
  });
  res.json(clients);
}

async function getById(req, res) {
  const client = await prisma.client.findFirst({ where: { id: req.params.id, ...firmWhere(req) }, include: { contacts: true } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json(client);
}

async function create(req, res) {
  const data = clientSchema.parse(req.body);
  const client = await prisma.client.create({ data: { ...data, email: data.email || null, accountingFirmId: req.user.accountingFirmId } });
  res.status(201).json(client);
}

async function update(req, res) {
  const data = clientSchema.partial().parse(req.body);
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado.' });
  const client = await prisma.client.update({ where: { id: existing.id }, data: { ...data, email: data.email || null } });
  res.json(client);
}

async function remove(req, res) {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado.' });
  await prisma.client.update({ where: { id: existing.id }, data: { active: false } });
  res.status(204).send();
}

async function clearForSetup(req, res) {
  const firmId = req.user.accountingFirmId;
  const clients = await prisma.client.findMany({ where: { accountingFirmId: firmId }, select: { id: true } });
  const clientIds = clients.map((client) => client.id);

  await prisma.$transaction(async (tx) => {
    await tx.taxPendency.deleteMany({ where: { check: { clientId: { in: clientIds } } } });
    await tx.taxPendencyCheck.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.payrollEntry.deleteMany({ where: { employee: { clientId: { in: clientIds } } } });
    await tx.employee.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.invoiceItem.deleteMany({ where: { invoice: { clientId: { in: clientIds } } } });
    await tx.invoice.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.financialTransaction.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.financialAccount.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.document.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.demandComment.deleteMany({ where: { demand: { clientId: { in: clientIds } } } });
    await tx.demandAttachment.deleteMany({ where: { demand: { clientId: { in: clientIds } } } });
    await tx.protocolDocument.deleteMany({ where: { accountingFirmId: firmId } });
    await tx.demand.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.taskProcess.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.clientContact.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.clientDepartmentResponsible.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.clientObligation.deleteMany({ where: { clientId: { in: clientIds } } });
    await tx.whatsAppMessage.deleteMany({ where: { conversation: { accountingFirmId: firmId } } });
    await tx.whatsAppConversation.deleteMany({ where: { accountingFirmId: firmId } });
    await tx.user.deleteMany({ where: { accountingFirmId: firmId, role: 'CLIENT' } });
    await tx.client.deleteMany({ where: { id: { in: clientIds } } });
  });

  const seeded = await seedCatalogForFirm(firmId);
  res.json({
    removedClients: clientIds.length,
    remainingClients: await prisma.client.count({ where: { accountingFirmId: firmId } }),
    seeded,
  });
}

async function listContacts(req, res) {
  const contacts = await prisma.clientContact.findMany({
    where: { ...firmWhere(req), ...(req.query.clientId ? { clientId: req.query.clientId } : {}) },
    orderBy: [{ client: { name: 'asc' } }, { name: 'asc' }],
    include: { client: { select: { id: true, name: true, cnpj: true } } },
  });
  res.json(contacts);
}

async function createContact(req, res) {
  const data = contactSchema.parse(req.body);
  const client = await prisma.client.findFirst({ where: { id: data.clientId, ...firmWhere(req) } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  const contact = await prisma.clientContact.create({
    data: { ...data, email: data.email || null, accountingFirmId: req.user.accountingFirmId },
    include: { client: { select: { id: true, name: true, cnpj: true } } },
  });
  res.status(201).json(contact);
}

async function updateContact(req, res) {
  const data = contactSchema.partial().parse(req.body);
  const existing = await prisma.clientContact.findFirst({ where: { id: req.params.contactId, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Contato não encontrado.' });
  const contact = await prisma.clientContact.update({
    where: { id: existing.id }, data: { ...data, email: data.email || null },
    include: { client: { select: { id: true, name: true, cnpj: true } } },
  });
  res.json(contact);
}

async function removeContact(req, res) {
  const existing = await prisma.clientContact.findFirst({ where: { id: req.params.contactId, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Contato não encontrado.' });
  await prisma.clientContact.delete({ where: { id: existing.id } });
  res.status(204).send();
}

module.exports = { list, getById, create, update, remove, clearForSetup, listContacts, createContact, updateContact, removeContact };
