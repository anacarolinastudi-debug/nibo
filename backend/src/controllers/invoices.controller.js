const { z } = require('zod');
const prisma = require('../lib/prisma');

function clientScope(user) {
  if (user.role === 'CLIENT') return { clientId: user.clientId };
  return { client: { accountingFirmId: user.accountingFirmId } };
}

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitValue: z.number().positive(),
});

const invoiceSchema = z.object({
  type: z.enum(['NFE', 'NFSE']),
  clientId: z.string().uuid(),
  description: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'Inclua ao menos um item.'),
});

function calcTotal(items) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
}

async function list(req, res) {
  const { status, clientId } = req.query;
  const invoices = await prisma.invoice.findMany({
    where: {
      ...clientScope(req.user),
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { client: { select: { name: true } }, items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
}

async function getById(req, res) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, ...clientScope(req.user) },
    include: { client: true, items: true },
  });
  if (!invoice) return res.status(404).json({ error: 'Nota fiscal não encontrada.' });
  res.json(invoice);
}

// Gera um número sequencial simples por escritório.
// OBS: para emissão real perante a SEFAZ, isso precisaria de um provedor de
// NF-e/NFS-e homologado (ex.: eNotas, Focus NFe) — aqui é só o registro interno.
async function nextInvoiceNumber(accountingFirmId) {
  const count = await prisma.invoice.count({
    where: { client: { accountingFirmId } },
  });
  return String(count + 1).padStart(6, '0');
}

async function create(req, res) {
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;
  const data = invoiceSchema.parse(req.body);

  const number = await nextInvoiceNumber(req.user.accountingFirmId);

  const invoice = await prisma.invoice.create({
    data: {
      number,
      type: data.type,
      clientId: data.clientId,
      description: data.description,
      totalValue: calcTotal(data.items),
      items: { create: data.items },
    },
    include: { items: true },
  });

  res.status(201).json(invoice);
}

async function issue(req, res) {
  const existing = await prisma.invoice.findFirst({ where: { id: req.params.id, ...clientScope(req.user) } });
  if (!existing) return res.status(404).json({ error: 'Nota fiscal não encontrada.' });
  if (existing.status !== 'DRAFT') return res.status(400).json({ error: 'Apenas notas em rascunho podem ser emitidas.' });

  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: { status: 'ISSUED', issueDate: new Date() },
  });

  res.json(invoice);
}

async function cancel(req, res) {
  const existing = await prisma.invoice.findFirst({ where: { id: req.params.id, ...clientScope(req.user) } });
  if (!existing) return res.status(404).json({ error: 'Nota fiscal não encontrada.' });

  const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { status: 'CANCELED' } });
  res.json(invoice);
}

module.exports = { list, getById, create, issue, cancel };
