const { z } = require('zod');
const prisma = require('../lib/prisma');

const clientSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório.'),
  cnpj: z.string().min(11, 'CNPJ inválido.'),
  taxRegime: z.enum(['MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL']),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
});

// Lista todas as empresas do escritório logado.
async function list(req, res) {
  const clients = await prisma.client.findMany({
    where: { accountingFirmId: req.user.accountingFirmId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { demands: true } } },
  });
  res.json(clients);
}

async function getById(req, res) {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
  });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json(client);
}

async function create(req, res) {
  const data = clientSchema.parse(req.body);
  const client = await prisma.client.create({
    data: { ...data, accountingFirmId: req.user.accountingFirmId },
  });
  res.status(201).json(client);
}

async function update(req, res) {
  const data = clientSchema.partial().parse(req.body);

  const existing = await prisma.client.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
  });
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const client = await prisma.client.update({ where: { id: req.params.id }, data });
  res.json(client);
}

async function remove(req, res) {
  const existing = await prisma.client.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
  });
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado.' });

  // Em vez de apagar de fato (perderia o histórico), apenas inativa.
  await prisma.client.update({ where: { id: req.params.id }, data: { active: false } });
  res.status(204).send();
}

module.exports = { list, getById, create, update, remove };
