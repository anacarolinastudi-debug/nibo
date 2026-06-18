const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');

const userSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres.'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'CLIENT']),
  clientId: z.string().uuid().optional().nullable(),
});

// Lista os usuários do escritório logado (colaboradores + usuários de portal).
async function list(req, res) {
  const users = await prisma.user.findMany({
    where: { accountingFirmId: req.user.accountingFirmId },
    select: { id: true, name: true, email: true, role: true, active: true, clientId: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
}

async function create(req, res) {
  const data = userSchema.parse(req.body);

  if (data.role === 'CLIENT' && !data.clientId) {
    return res.status(400).json({ error: 'Usuário do portal precisa estar vinculado a um cliente.' });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      clientId: data.role === 'CLIENT' ? data.clientId : null,
      accountingFirmId: req.user.accountingFirmId,
    },
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

async function update(req, res) {
  const data = userSchema.partial().parse(req.body);

  const existing = await prisma.user.findFirst({ where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId } });
  if (!existing) return res.status(404).json({ error: 'Usuário não encontrado.' });

  const updateData = { ...data };
  delete updateData.password;
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

async function deactivate(req, res) {
  const existing = await prisma.user.findFirst({ where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId } });
  if (!existing) return res.status(404).json({ error: 'Usuário não encontrado.' });

  await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
  res.status(204).send();
}

module.exports = { list, create, update, deactivate };
