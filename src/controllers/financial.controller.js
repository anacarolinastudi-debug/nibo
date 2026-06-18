const { z } = require('zod');
const prisma = require('../lib/prisma');

// Mesma lógica de escopo usada em demandas: cliente só vê o que é dele,
// time interno vê tudo do escritório.
function clientScope(user) {
  if (user.role === 'CLIENT') return { clientId: user.clientId };
  return { client: { accountingFirmId: user.accountingFirmId } };
}

// ---------- Contas bancárias ----------

const accountSchema = z.object({
  bankName: z.string().min(2, 'Nome do banco é obrigatório.'),
  agency: z.string().optional().nullable(),
  accountNum: z.string().optional().nullable(),
  balance: z.number().optional(),
  clientId: z.string().uuid(),
});

async function listAccounts(req, res) {
  const accounts = await prisma.financialAccount.findMany({
    where: clientScope(req.user),
    include: { client: { select: { name: true } } },
    orderBy: { bankName: 'asc' },
  });
  res.json(accounts);
}

async function createAccount(req, res) {
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;
  const data = accountSchema.parse(req.body);
  const account = await prisma.financialAccount.create({ data });
  res.status(201).json(account);
}

// ---------- Plano de contas (categorias) ----------

const categorySchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório.'),
  type: z.enum(['RECEITA', 'DESPESA']),
});

async function listCategories(req, res) {
  const categories = await prisma.financialCategory.findMany({
    where: { accountingFirmId: req.user.accountingFirmId },
    orderBy: { name: 'asc' },
  });
  res.json(categories);
}

async function createCategory(req, res) {
  const data = categorySchema.parse(req.body);
  const category = await prisma.financialCategory.create({
    data: { ...data, accountingFirmId: req.user.accountingFirmId },
  });
  res.status(201).json(category);
}

// ---------- Lançamentos ----------

const transactionSchema = z.object({
  description: z.string().min(2, 'Descrição é obrigatória.'),
  amount: z.number().positive('Valor precisa ser maior que zero.'),
  type: z.enum(['RECEITA', 'DESPESA']),
  dueDate: z.string().datetime(),
  clientId: z.string().uuid(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

async function listTransactions(req, res) {
  const { clientId, type, status, month, year } = req.query;

  const where = {
    ...clientScope(req.user),
    ...(clientId ? { clientId } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };

  if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 1);
    where.dueDate = { gte: start, lt: end };
  }

  const transactions = await prisma.financialTransaction.findMany({
    where,
    include: {
      client: { select: { name: true } },
      category: { select: { name: true } },
      account: { select: { bankName: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  res.json(transactions);
}

async function createTransaction(req, res) {
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;
  const data = transactionSchema.parse(req.body);

  const transaction = await prisma.financialTransaction.create({
    data: { ...data, dueDate: new Date(data.dueDate) },
  });

  res.status(201).json(transaction);
}

async function markPaid(req, res) {
  const existing = await prisma.financialTransaction.findFirst({
    where: { id: req.params.id, ...clientScope(req.user) },
  });
  if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado.' });

  const transaction = await prisma.financialTransaction.update({
    where: { id: req.params.id },
    data: { status: 'PAID', paidAt: new Date() },
  });

  // Atualiza o saldo da conta bancária
  const delta = transaction.type === 'RECEITA' ? Number(transaction.amount) : -Number(transaction.amount);
  await prisma.financialAccount.update({
    where: { id: transaction.accountId },
    data: { balance: { increment: delta } },
  });

  res.json(transaction);
}

// ---------- Resumo (usado no painel/dashboard) ----------

async function summary(req, res) {
  const scope = clientScope(req.user);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [receitasMes, despesasMes, contas, vencendoHoje] = await Promise.all([
    prisma.financialTransaction.aggregate({
      where: { ...scope, type: 'RECEITA', dueDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: { ...scope, type: 'DESPESA', dueDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.financialAccount.aggregate({
      where: scope,
      _sum: { balance: true },
    }),
    prisma.financialTransaction.count({
      where: { ...scope, status: 'PENDING', dueDate: { lt: end } },
    }),
  ]);

  res.json({
    receitasMes: receitasMes._sum.amount || 0,
    despesasMes: despesasMes._sum.amount || 0,
    saldoTotal: contas._sum.balance || 0,
    pendentesAVencer: vencendoHoje,
  });
}

module.exports = {
  listAccounts, createAccount,
  listCategories, createCategory,
  listTransactions, createTransaction, markPaid,
  summary,
};
