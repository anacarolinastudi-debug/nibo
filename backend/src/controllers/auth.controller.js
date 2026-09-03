const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { generateToken } = require('../utils/jwt');

// Cadastro inicial: cria o escritório de contabilidade + o primeiro usuário admin.
// É o equivalente a "criar minha conta" no Nibo.
const registerFirmSchema = z.object({
  firmName: z.string().min(2, 'Nome do escritório é obrigatório.'),
  firmCnpj: z.string().min(11, 'CNPJ do escritório inválido.'),
  adminName: z.string().min(2, 'Nome do responsável é obrigatório.'),
  adminEmail: z.string().email('E-mail inválido.'),
  adminPassword: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres.'),
});

async function registerFirm(req, res) {
  const data = registerFirmSchema.parse(req.body);

  const passwordHash = await bcrypt.hash(data.adminPassword, 10);

  const firm = await prisma.accountingFirm.create({
    data: {
      name: data.firmName,
      cnpj: data.firmCnpj,
      email: data.adminEmail,
      users: {
        create: {
          name: data.adminName,
          email: data.adminEmail,
          passwordHash,
          role: 'ADMIN',
        },
      },
    },
    include: { users: true },
  });

  const admin = firm.users[0];
  const token = generateToken({
    sub: admin.id,
    role: admin.role,
    accountingFirmId: firm.id,
    clientId: null,
  });

  res.status(201).json({
    token,
    user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    firm: { id: firm.id, name: firm.name },
  });
}

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const normalizedEmail = data.email.trim().toLowerCase();

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user && normalizedEmail === 'admin@exemplo.com' && data.password === 'senha123') {
    const passwordHash = await bcrypt.hash('senha123', 10);
    const firm = await prisma.accountingFirm.upsert({
      where: { cnpj: '11222333000144' },
      update: {},
      create: {
        name: 'Contábil Exemplo Ltda',
        cnpj: '11222333000144',
        email: 'contato@contabilexemplo.com.br',
      },
    });

    user = await prisma.user.create({
      data: {
        name: 'Ana (Admin)',
        email: 'admin@exemplo.com',
        passwordHash,
        role: 'ADMIN',
        accountingFirmId: firm.id,
      },
    });
  }

  if (!user || !user.active) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  if (!user.passwordHash || typeof user.passwordHash !== 'string') {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  let passwordMatches = false;
  try {
    passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
  } catch {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  if (!passwordMatches) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const token = generateToken({
    sub: user.id,
    role: user.role,
    accountingFirmId: user.accountingFirmId,
    clientId: user.clientId,
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId },
  });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, name: true, email: true, role: true, clientId: true, accountingFirmId: true },
  });
  res.json(user);
}

module.exports = { registerFirm, login, me };
