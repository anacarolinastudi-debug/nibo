const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const prisma = require('../lib/prisma');

// Mesma lógica de escopo usada em demandas: cliente só vê o que é dele,
// time interno vê tudo do escritório.
function clientScope(user) {
  if (user.role === 'CLIENT') return { clientId: user.clientId };
  return { client: { accountingFirmId: user.accountingFirmId } };
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function datePt(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function logoMime(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.webp') return 'image/webp';
  return '';
}

function apiBaseUrl(req) {
  const configured = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  return configured.replace(/\/+$/, '');
}

function logoSource(logoUrl, req) {
  if (!logoUrl) return '';
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (!logoUrl.startsWith('/uploads/')) return '';

  const filePath = path.join(__dirname, '..', '..', 'uploads', path.basename(logoUrl));
  if (fs.existsSync(filePath)) {
    const mime = logoMime(filePath);
    if (mime) return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  }

  return `${apiBaseUrl(req)}${logoUrl}`;
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
  accountId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  paid: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  recurrence: z.enum(['NONE', 'MONTHLY', 'MONTHLY_INDEFINITE']).optional().default('NONE'),
  recurrenceCount: z.number().int().min(1).max(60).optional().default(1),
});

async function resolveTransactionDefaults({ clientId, accountingFirmId, type, accountId, categoryId }) {
  let resolvedAccountId = accountId;
  if (!resolvedAccountId) {
    const account = await prisma.financialAccount.findFirst({
      where: { clientId, bankName: 'Conta principal' },
    }) || await prisma.financialAccount.create({
      data: { clientId, bankName: 'Conta principal' },
    });
    resolvedAccountId = account.id;
  }

  let resolvedCategoryId = categoryId;
  if (!resolvedCategoryId) {
    const name = type === 'RECEITA' ? 'Recebimentos' : 'Pagamentos';
    const category = await prisma.financialCategory.findFirst({
      where: { accountingFirmId, type, name },
    }) || await prisma.financialCategory.create({
      data: { accountingFirmId, type, name },
    });
    resolvedCategoryId = category.id;
  }

  return { accountId: resolvedAccountId, categoryId: resolvedCategoryId };
}

async function syncMissingReceiptTransactions(accountingFirmId) {
  const receipts = await prisma.financialReceipt.findMany({
    where: { accountingFirmId, transactionId: null },
    select: { id: true, description: true, amount: true, dueDate: true, issueDate: true, paymentDate: true, clientId: true },
  });

  for (const receipt of receipts) {
    const { accountId, categoryId } = await resolveTransactionDefaults({
      clientId: receipt.clientId,
      accountingFirmId,
      type: 'RECEITA',
    });
    const transaction = await prisma.financialTransaction.create({
      data: {
        description: receipt.description,
        amount: receipt.amount,
        type: 'RECEITA',
        status: receipt.paymentDate ? 'PAID' : 'PENDING',
        dueDate: receipt.dueDate || receipt.issueDate || new Date(),
        paidAt: receipt.paymentDate || null,
        clientId: receipt.clientId,
        accountId,
        categoryId,
      },
    });
    await prisma.financialReceipt.update({
      where: { id: receipt.id },
      data: { transactionId: transaction.id },
    });
  }
}

async function listTransactions(req, res) {
  const { clientId, type, status, month, year, includeRecurring } = req.query;

  if (req.user.role !== 'CLIENT') {
    await syncMissingReceiptTransactions(req.user.accountingFirmId);
  }

  const where = {
    ...clientScope(req.user),
    ...(clientId ? { clientId } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };

  if (year) {
    const start = month ? new Date(Number(year), Number(month) - 1, 1) : new Date(Number(year), 0, 1);
    const end = month ? new Date(Number(year), Number(month), 1) : new Date(Number(year) + 1, 0, 1);
    if (includeRecurring) {
      where.OR = [
        { dueDate: { gte: start, lt: end } },
        { recurrenceInfinite: true, dueDate: { lt: end } },
      ];
    } else {
      where.dueDate = { gte: start, lt: end };
    }
  }

  const transactions = await prisma.financialTransaction.findMany({
    where,
    include: {
      client: { select: { name: true } },
      category: { select: { name: true } },
      account: { select: { bankName: true } },
      receipt: { select: { id: true, number: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  res.json(transactions);
}

async function createTransaction(req, res) {
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;
  const data = transactionSchema.parse(req.body);

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, accountingFirmId: req.user.accountingFirmId },
  });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const { accountId, categoryId } = await resolveTransactionDefaults({
    clientId: client.id,
    accountingFirmId: req.user.accountingFirmId,
    type: data.type,
    accountId: data.accountId,
    categoryId: data.categoryId,
  });

  const count = data.recurrence === 'MONTHLY' ? data.recurrenceCount : 1;
  const firstDueDate = new Date(data.dueDate);
  const transactions = await prisma.$transaction(async (tx) => {
    const created = [];
    for (let index = 0; index < count; index += 1) {
      const dueDate = new Date(firstDueDate);
      if (data.recurrence === 'MONTHLY') dueDate.setMonth(firstDueDate.getMonth() + index);
      created.push(await tx.financialTransaction.create({
        data: {
          description: count > 1 ? `${data.description} (${index + 1}/${count})` : data.description,
          amount: data.amount,
          type: data.type,
          dueDate,
          status: data.paid ? 'PAID' : 'PENDING',
          paidAt: data.paid ? new Date() : null,
          notes: data.notes || null,
          recurrence: data.recurrence,
          recurrenceCount: data.recurrence === 'MONTHLY' ? count : null,
          recurrenceInfinite: data.recurrence === 'MONTHLY_INDEFINITE',
          clientId: client.id,
          accountId,
          categoryId,
        },
        include: {
          client: { select: { id: true, name: true, cnpj: true } },
          category: { select: { name: true } },
          account: { select: { bankName: true } },
        },
      }));
    }

    if (data.paid) {
      const delta = (data.type === 'RECEITA' ? data.amount : -data.amount) * count;
      await tx.financialAccount.update({ where: { id: accountId }, data: { balance: { increment: delta } } });
    }

    return created;
  });

  res.status(201).json(count === 1 ? transactions[0] : transactions);
}

async function updateTransaction(req, res) {
  const data = transactionSchema.partial().parse(req.body);
  const existing = await prisma.financialTransaction.findFirst({
    where: { id: req.params.id, ...clientScope(req.user) },
  });
  if (!existing) return res.status(404).json({ error: 'Movimentação não encontrada.' });

  let clientId = existing.clientId;
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, accountingFirmId: req.user.accountingFirmId },
    });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
    clientId = client.id;
  }

  const nextType = data.type || existing.type;
  const { accountId, categoryId } = await resolveTransactionDefaults({
    clientId,
    accountingFirmId: req.user.accountingFirmId,
    type: nextType,
    accountId: data.accountId || existing.accountId,
    categoryId: data.categoryId || existing.categoryId,
  });
  const wasPaid = existing.status === 'PAID';
  const willBePaid = data.paid !== undefined ? data.paid : wasPaid;

  const transaction = await prisma.$transaction(async (tx) => {
    const oldImpact = wasPaid ? (existing.type === 'RECEITA' ? Number(existing.amount) : -Number(existing.amount)) : 0;
    const nextAmount = data.amount !== undefined ? data.amount : Number(existing.amount);
    const newImpact = willBePaid ? (nextType === 'RECEITA' ? Number(nextAmount) : -Number(nextAmount)) : 0;
    const updated = await tx.financialTransaction.update({
      where: { id: existing.id },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.recurrence !== undefined ? { recurrence: data.recurrence } : {}),
        ...(data.recurrence !== undefined ? { recurrenceCount: data.recurrence === 'MONTHLY' ? (data.recurrenceCount || existing.recurrenceCount || 1) : null } : {}),
        ...(data.recurrence !== undefined ? { recurrenceInfinite: data.recurrence === 'MONTHLY_INDEFINITE' } : {}),
        status: willBePaid ? 'PAID' : 'PENDING',
        paidAt: willBePaid ? (existing.paidAt || new Date()) : null,
        clientId,
        accountId,
        categoryId,
      },
      include: {
        client: { select: { id: true, name: true, cnpj: true } },
        category: { select: { name: true } },
        account: { select: { bankName: true } },
        receipt: { select: { id: true, number: true } },
      },
    });
    const delta = newImpact - oldImpact;
    if (delta !== 0) {
      await tx.financialAccount.update({ where: { id: accountId }, data: { balance: { increment: delta } } });
    }
    return updated;
  });

  res.json(transaction);
}

async function markPaid(req, res) {
  const existing = await prisma.financialTransaction.findFirst({
    where: { id: req.params.id, ...clientScope(req.user) },
  });
  if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado.' });
  if (existing.status === 'PAID') return res.json(existing);

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

async function removeTransaction(req, res) {
  const existing = await prisma.financialTransaction.findFirst({
    where: { id: req.params.id, ...clientScope(req.user) },
    include: { receipt: true },
  });
  if (!existing) return res.status(404).json({ error: 'Movimentação não encontrada.' });

  await prisma.$transaction(async (tx) => {
    if (existing.receipt) {
      await tx.financialReceipt.delete({ where: { id: existing.receipt.id } });
    }
    if (existing.status === 'PAID') {
      const delta = existing.type === 'RECEITA' ? -Number(existing.amount) : Number(existing.amount);
      await tx.financialAccount.update({ where: { id: existing.accountId }, data: { balance: { increment: delta } } });
    }
    await tx.financialTransaction.delete({ where: { id: existing.id } });
  });

  res.status(204).send();
}

// ---------- Recibos ----------

const receiptSchema = z.object({
  clientId: z.string().uuid(),
  description: z.string().min(2, 'Descrição é obrigatória.'),
  amount: z.number().positive('Valor precisa ser maior que zero.'),
  transactionId: z.string().uuid().optional().nullable(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  paymentDate: z.string().datetime().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function nextReceiptNumber(accountingFirmId) {
  const year = new Date().getFullYear();
  const prefix = `REC-${year}-`;
  const count = await prisma.financialReceipt.count({
    where: { accountingFirmId, number: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

async function listReceipts(req, res) {
  const where = req.user.role === 'CLIENT'
    ? { clientId: req.user.clientId }
    : { accountingFirmId: req.user.accountingFirmId };

  const receipts = await prisma.financialReceipt.findMany({
    where,
    include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(receipts);
}

async function createReceipt(req, res) {
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;
  const data = receiptSchema.parse(req.body);

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, accountingFirmId: req.user.accountingFirmId },
  });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });

  const { accountId, categoryId } = await resolveTransactionDefaults({
    clientId: client.id,
    accountingFirmId: req.user.accountingFirmId,
    type: 'RECEITA',
  });

  const paid = Boolean(data.paymentDate);
  const receipt = await prisma.$transaction(async (tx) => {
    let transaction;
    if (data.transactionId) {
      transaction = await tx.financialTransaction.findFirst({
        where: { id: data.transactionId, clientId: client.id, receipt: null },
      });
      if (!transaction) throw new Error('Movimentação não encontrada ou já vinculada a um recibo.');
      transaction = await tx.financialTransaction.update({
        where: { id: transaction.id },
        data: {
          description: data.description,
          amount: data.amount,
          type: 'RECEITA',
          status: paid ? 'PAID' : transaction.status,
          dueDate: data.dueDate ? new Date(data.dueDate) : transaction.dueDate,
          paidAt: data.paymentDate ? new Date(data.paymentDate) : transaction.paidAt,
          accountId,
          categoryId,
        },
      });
    } else {
      transaction = await tx.financialTransaction.create({
        data: {
          description: data.description,
          amount: data.amount,
          type: 'RECEITA',
          status: paid ? 'PAID' : 'PENDING',
          dueDate: data.dueDate ? new Date(data.dueDate) : (data.issueDate ? new Date(data.issueDate) : new Date()),
          paidAt: data.paymentDate ? new Date(data.paymentDate) : null,
          clientId: client.id,
          accountId,
          categoryId,
        },
      });
    }

    if (paid) {
      await tx.financialAccount.update({ where: { id: accountId }, data: { balance: { increment: data.amount } } });
    }

    return tx.financialReceipt.create({
      data: {
        number: await nextReceiptNumber(req.user.accountingFirmId),
        description: data.description,
        amount: data.amount,
        issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        paymentMethod: data.paymentMethod || null,
        notes: data.notes || null,
        accountingFirmId: req.user.accountingFirmId,
        clientId: client.id,
        transactionId: transaction.id,
      },
      include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
    });
  });

  res.status(201).json(receipt);
}

async function updateReceipt(req, res) {
  const data = receiptSchema.partial().parse(req.body);

  const existing = await prisma.financialReceipt.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
    include: { transaction: true },
  });
  if (!existing) return res.status(404).json({ error: 'Recibo não encontrado.' });

  let clientId = existing.clientId;
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, accountingFirmId: req.user.accountingFirmId },
    });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
    clientId = client.id;
  }

  const nextDescription = data.description ?? existing.description;
  const nextAmount = data.amount ?? Number(existing.amount);
  const nextDueDate = data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : existing.dueDate;
  const nextIssueDate = data.issueDate !== undefined ? (data.issueDate ? new Date(data.issueDate) : existing.issueDate) : existing.issueDate;
  const nextPaymentDate = data.paymentDate !== undefined ? (data.paymentDate ? new Date(data.paymentDate) : null) : existing.paymentDate;
  const nextPaid = Boolean(nextPaymentDate);

  const { accountId, categoryId } = await resolveTransactionDefaults({
    clientId,
    accountingFirmId: req.user.accountingFirmId,
    type: 'RECEITA',
  });

  const receipt = await prisma.$transaction(async (tx) => {
    let transactionId = existing.transactionId;
    if (transactionId) {
      await tx.financialTransaction.update({
        where: { id: transactionId },
        data: {
          description: nextDescription,
          amount: nextAmount,
          dueDate: nextDueDate || nextIssueDate || new Date(),
          status: nextPaid ? 'PAID' : 'PENDING',
          paidAt: nextPaymentDate,
          clientId,
          accountId: existing.transaction?.accountId || accountId,
          categoryId: existing.transaction?.categoryId || categoryId,
        },
      });
    } else {
      const transaction = await tx.financialTransaction.create({
        data: {
          description: nextDescription,
          amount: nextAmount,
          type: 'RECEITA',
          dueDate: nextDueDate || nextIssueDate || new Date(),
          status: nextPaid ? 'PAID' : 'PENDING',
          paidAt: nextPaymentDate,
          clientId,
          accountId,
          categoryId,
        },
      });
      transactionId = transaction.id;
    }

    return tx.financialReceipt.update({
      where: { id: existing.id },
      data: {
        description: nextDescription,
        amount: nextAmount,
        issueDate: nextIssueDate,
        dueDate: nextDueDate,
        paymentDate: nextPaymentDate,
        ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        clientId,
        transactionId,
      },
      include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
    });
  });

  res.json(receipt);
}

async function removeReceipt(req, res) {
  const existing = await prisma.financialReceipt.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
  });
  if (!existing) return res.status(404).json({ error: 'Recibo não encontrado.' });

  await prisma.$transaction(async (tx) => {
    await tx.financialReceipt.delete({ where: { id: existing.id } });
    if (existing.transactionId) {
      await tx.financialTransaction.delete({ where: { id: existing.transactionId } });
    }
  });

  res.status(204).send();
}

// ---------- Orçamentos ----------

const budgetSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  clientName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  amount: z.number().positive('Valor precisa ser maior que zero.').optional(),
  items: z.array(z.object({
    service: z.string().min(2, 'Serviço é obrigatório.'),
    amount: z.number().positive('Valor precisa ser maior que zero.'),
  })).min(1, 'Informe ao menos um serviço.').optional(),
  type: z.enum(['RECEITA', 'DESPESA']).optional().default('RECEITA'),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED']).optional().default('DRAFT'),
  validUntil: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function budgetPayload(data) {
  const items = Array.isArray(data.items) ? data.items.map((item) => ({
    service: item.service.trim(),
    amount: Number(item.amount),
  })) : [];
  const amount = items.length
    ? items.reduce((sum, item) => sum + item.amount, 0)
    : Number(data.amount || 0);
  const description = (data.description || items.map((item) => item.service).join(', ')).trim();
  if (!description) throw new Error('Descrição é obrigatória.');
  if (amount <= 0) throw new Error('Valor precisa ser maior que zero.');
  return { items, amount, description };
}

async function nextBudgetNumber(accountingFirmId) {
  const year = new Date().getFullYear();
  const prefix = `ORC-${year}-`;
  const count = await prisma.financialBudget.count({
    where: { accountingFirmId, number: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

async function listBudgets(req, res) {
  const where = req.user.role === 'CLIENT'
    ? { clientId: req.user.clientId }
    : { accountingFirmId: req.user.accountingFirmId };

  const budgets = await prisma.financialBudget.findMany({
    where,
    include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(budgets);
}

async function createBudget(req, res) {
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;
  const data = budgetSchema.parse(req.body);

  let client = null;
  if (data.clientId) {
    client = await prisma.client.findFirst({
      where: { id: data.clientId, accountingFirmId: req.user.accountingFirmId },
    });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  }
  const clientName = client?.name || String(data.clientName || '').trim();
  if (!clientName) return res.status(400).json({ error: 'Informe o cliente ou digite o nome do cliente.' });
  const prepared = budgetPayload(data);

  const budget = await prisma.financialBudget.create({
    data: {
      number: await nextBudgetNumber(req.user.accountingFirmId),
      description: prepared.description,
      amount: prepared.amount,
      items: prepared.items.length ? prepared.items : null,
      type: data.type,
      status: data.status,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      notes: data.notes || null,
      accountingFirmId: req.user.accountingFirmId,
      clientId: client?.id || null,
      clientName,
    },
    include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
  });

  res.status(201).json(budget);
}

async function updateBudget(req, res) {
  const data = budgetSchema.partial().parse(req.body);
  const existing = await prisma.financialBudget.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
  });
  if (!existing) return res.status(404).json({ error: 'Orçamento não encontrado.' });

  let clientId = existing.clientId || null;
  let clientName = existing.clientName || null;
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, accountingFirmId: req.user.accountingFirmId },
    });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
    clientId = client.id;
    clientName = client.name;
  } else if (data.clientId === null || data.clientId === '') {
    clientId = null;
    clientName = String(data.clientName || '').trim();
  } else if (data.clientName !== undefined) {
    clientName = String(data.clientName || '').trim();
  }
  if (!clientName) return res.status(400).json({ error: 'Informe o cliente ou digite o nome do cliente.' });
  const prepared = budgetPayload({ ...existing, ...data });

  const budget = await prisma.financialBudget.update({
    where: { id: existing.id },
    data: {
      description: prepared.description,
      amount: prepared.amount,
      items: prepared.items.length ? prepared.items : null,
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.validUntil !== undefined ? { validUntil: data.validUntil ? new Date(data.validUntil) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      clientId,
      clientName,
    },
    include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
  });

  res.json(budget);
}

async function removeBudget(req, res) {
  const existing = await prisma.financialBudget.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
  });
  if (!existing) return res.status(404).json({ error: 'Orçamento não encontrado.' });

  await prisma.financialBudget.delete({ where: { id: existing.id } });
  res.status(204).send();
}

function budgetHtml(budget, req) {
  const firm = budget.accountingFirm;
  const logoSrc = logoSource(firm.logoUrl, req);
  const firmAddress = [firm.street, firm.number, firm.neighborhood, firm.city, firm.state].filter(Boolean).join(', ');
  const clientName = budget.client?.name || budget.clientName || '-';
  const clientDoc = budget.client?.cnpj || '';
  const clientAddress = budget.client ? [budget.client.street, budget.client.number, budget.client.neighborhood, budget.client.city, budget.client.state].filter(Boolean).join(', ') : '';
  const items = Array.isArray(budget.items) && budget.items.length
    ? budget.items
    : [{ service: budget.description, amount: Number(budget.amount || 0) }];

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 36px; color: #33383b; font-family: Arial, sans-serif; font-size: 13px; }
    .page { border: 1px solid #d7dde2; min-height: 100%; padding: 32px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0b4f8f; padding-bottom: 22px; }
    .brand { display: flex; gap: 16px; align-items: flex-start; }
    .logo { width: 86px; height: 86px; object-fit: contain; border: 1px solid #e1e6ea; border-radius: 6px; padding: 6px; }
    h1 { margin: 0; color: #0b4f8f; font-size: 32px; letter-spacing: 1px; }
    .muted { color: #69747b; line-height: 1.45; }
    .number { text-align: right; font-size: 14px; }
    .amount-box { margin-top: 16px; background: #eef8fc; border: 1px solid #c7e8f5; border-radius: 6px; padding: 14px 18px; text-align: right; }
    .amount-box strong { display: block; font-size: 24px; color: #0b4f8f; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; }
    .label { margin: 0 0 6px; color: #69747b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .box { border: 1px solid #e1e6ea; border-radius: 6px; padding: 16px; min-height: 100px; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    th { background: #f2f4f5; border: 1px solid #dfe5e8; padding: 10px; text-align: left; font-size: 12px; }
    td { border: 1px solid #dfe5e8; padding: 12px 10px; }
    .right { text-align: right; }
    .totals { margin-left: auto; width: 320px; margin-top: 20px; }
    .totals div { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e5e9ec; }
    .totals .grand { font-size: 18px; font-weight: 700; color: #0b4f8f; }
    .notes { margin-top: 34px; border-top: 1px solid #e5e9ec; padding-top: 20px; white-space: pre-wrap; line-height: 1.55; }
    .footer { margin-top: 44px; color: #69747b; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Logotipo" />` : ''}
        <div>
          <h1>ORÇAMENTO</h1>
          <p class="muted"><strong>${escapeHtml(firm.name)}</strong><br>${escapeHtml(firm.cnpj || '')}<br>${escapeHtml(firm.email || '')}<br>${escapeHtml(firmAddress)}</p>
        </div>
      </div>
      <div class="number">
        <p><strong>Nº do orçamento</strong><br>${escapeHtml(budget.number)}</p>
        <p><strong>Emissão</strong><br>${datePt(budget.createdAt)}</p>
        <p><strong>Validade</strong><br>${datePt(budget.validUntil)}</p>
        <div class="amount-box">
          Valor total
          <strong>${money(budget.amount)}</strong>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <p class="label">Cliente</p>
        <strong>${escapeHtml(clientName)}</strong>
        <p class="muted">${escapeHtml(clientDoc)}${clientAddress ? `<br>${escapeHtml(clientAddress)}` : ''}</p>
      </div>
      <div class="box">
        <p class="label">Condições</p>
        <p><strong>Status:</strong> ${escapeHtml(budgetStatusText(budget.status))}</p>
        <p><strong>Tipo:</strong> ${budget.type === 'DESPESA' ? 'Saída' : 'Entrada'}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Serviço</th><th class="right">Valor</th></tr>
      </thead>
      <tbody>
        ${items.map((item) => `<tr><td>${escapeHtml(item.service)}</td><td class="right">${money(item.amount)}</td></tr>`).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><strong>${money(budget.amount)}</strong></div>
      <div class="grand"><span>Total</span><span>${money(budget.amount)}</span></div>
    </div>

    ${budget.notes ? `<div class="notes"><p class="label">Observações</p><p>${escapeHtml(budget.notes)}</p></div>` : ''}
    <p class="footer">Documento emitido pelo Young Contábil.</p>
  </div>
</body>
</html>`;
}

function budgetStatusText(status) {
  const labels = { DRAFT: 'Rascunho', SENT: 'Enviado', APPROVED: 'Aprovado', REJECTED: 'Reprovado' };
  return labels[status] || status || '-';
}

async function budgetPdf(req, res) {
  const where = req.user.role === 'CLIENT'
    ? { id: req.params.id, clientId: req.user.clientId }
    : { id: req.params.id, accountingFirmId: req.user.accountingFirmId };

  const budget = await prisma.financialBudget.findFirst({
    where,
    include: { accountingFirm: true, client: true },
  });
  if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado.' });

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(budgetHtml(budget, req), { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${budget.number}.pdf"`);
    res.send(pdf);
  } finally {
    await browser.close();
  }
}

function receiptHtml(receipt, req) {
  const firm = receipt.accountingFirm;
  const logoSrc = logoSource(firm.logoUrl, req);
  const firmAddress = [firm.street, firm.number, firm.neighborhood, firm.city, firm.state].filter(Boolean).join(', ');
  const clientAddress = [receipt.client.street, receipt.client.number, receipt.client.neighborhood, receipt.client.city, receipt.client.state].filter(Boolean).join(', ');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 36px; color: #33383b; font-family: Arial, sans-serif; font-size: 13px; }
    .page { border: 1px solid #d7dde2; min-height: 100%; padding: 32px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0b4f8f; padding-bottom: 22px; }
    .brand { display: flex; gap: 16px; align-items: flex-start; }
    .logo { width: 86px; height: 86px; object-fit: contain; border: 1px solid #e1e6ea; border-radius: 6px; padding: 6px; }
    h1 { margin: 0; color: #0b4f8f; font-size: 34px; letter-spacing: 1px; }
    .muted { color: #69747b; line-height: 1.45; }
    .number { text-align: right; font-size: 14px; }
    .amount-box { margin-top: 16px; background: #eef8fc; border: 1px solid #c7e8f5; border-radius: 6px; padding: 14px 18px; text-align: right; }
    .amount-box strong { display: block; font-size: 24px; color: #0b4f8f; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; }
    .label { margin: 0 0 6px; color: #69747b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .box { border: 1px solid #e1e6ea; border-radius: 6px; padding: 16px; min-height: 112px; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    th { background: #f2f4f5; border: 1px solid #dfe5e8; padding: 10px; text-align: left; font-size: 12px; }
    td { border: 1px solid #dfe5e8; padding: 12px 10px; }
    .right { text-align: right; }
    .totals { margin-left: auto; width: 320px; margin-top: 20px; }
    .totals div { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e5e9ec; }
    .totals .grand { font-size: 18px; font-weight: 700; color: #0b4f8f; }
    .notes { margin-top: 34px; border-top: 1px solid #e5e9ec; padding-top: 20px; }
    .footer { margin-top: 44px; color: #69747b; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Logotipo" />` : ''}
        <div>
          <h1>RECIBO</h1>
          <p class="muted"><strong>${escapeHtml(firm.name)}</strong><br>${escapeHtml(firm.cnpj || '')}<br>${escapeHtml(firm.email || '')}<br>${escapeHtml(firmAddress)}</p>
        </div>
      </div>
      <div class="number">
        <p><strong>Nº do recibo</strong><br>${escapeHtml(receipt.number)}</p>
        <p><strong>Emissão</strong><br>${datePt(receipt.issueDate)}</p>
        <p><strong>Vencimento</strong><br>${datePt(receipt.dueDate)}</p>
        <div class="amount-box">
          Valor do recibo
          <strong>${money(receipt.amount)}</strong>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <p class="label">Recebemos de</p>
        <strong>${escapeHtml(receipt.client.name)}</strong>
        <p class="muted">${escapeHtml(receipt.client.cnpj || '')}<br>${escapeHtml(receipt.client.email || '')}<br>${escapeHtml(clientAddress)}</p>
      </div>
      <div class="box">
        <p class="label">Pagamento</p>
        <p><strong>Data:</strong> ${datePt(receipt.paymentDate)}</p>
        <p><strong>Forma:</strong> ${escapeHtml(receipt.paymentMethod || '-')}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Item & descrição</th><th class="right">Quant.</th><th class="right">Valor</th><th class="right">Total</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(receipt.description)}</td>
          <td class="right">1,00</td>
          <td class="right">${money(receipt.amount)}</td>
          <td class="right">${money(receipt.amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><strong>${money(receipt.amount)}</strong></div>
      <div class="grand"><span>Total</span><span>${money(receipt.amount)}</span></div>
    </div>

    <div class="notes">
      <p class="label">Observações</p>
      <p>${escapeHtml(receipt.notes || '')}</p>
    </div>
    <p class="footer">Documento emitido pelo Young Contábil.</p>
  </div>
</body>
</html>`;
}

async function receiptPdf(req, res) {
  const where = req.user.role === 'CLIENT'
    ? { id: req.params.id, clientId: req.user.clientId }
    : { id: req.params.id, accountingFirmId: req.user.accountingFirmId };

  const receipt = await prisma.financialReceipt.findFirst({
    where,
    include: { accountingFirm: true, client: true },
  });
  if (!receipt) return res.status(404).json({ error: 'Recibo não encontrado.' });

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(receiptHtml(receipt, req), { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${receipt.number}.pdf"`);
    res.send(pdf);
  } finally {
    await browser.close();
  }
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
  listTransactions, createTransaction, updateTransaction, markPaid, removeTransaction,
  listReceipts, createReceipt, updateReceipt, removeReceipt, receiptPdf,
  listBudgets, createBudget, updateBudget, removeBudget, budgetPdf,
  summary,
};
