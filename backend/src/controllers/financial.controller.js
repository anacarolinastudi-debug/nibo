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

function logoDataUri(logoUrl) {
  if (!logoUrl?.startsWith('/uploads/')) return '';
  const filePath = path.join(__dirname, '..', '..', 'uploads', path.basename(logoUrl));
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.bmp' ? 'image/bmp' : '';
  if (!mime) return '';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
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

// ---------- Recibos ----------

const receiptSchema = z.object({
  clientId: z.string().uuid(),
  description: z.string().min(2, 'Descrição é obrigatória.'),
  amount: z.number().positive('Valor precisa ser maior que zero.'),
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

  const receipt = await prisma.financialReceipt.create({
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
    },
    include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
  });

  res.status(201).json(receipt);
}

async function updateReceipt(req, res) {
  const data = receiptSchema.partial().parse(req.body);

  const existing = await prisma.financialReceipt.findFirst({
    where: { id: req.params.id, accountingFirmId: req.user.accountingFirmId },
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

  const receipt = await prisma.financialReceipt.update({
    where: { id: existing.id },
    data: {
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.issueDate !== undefined ? { issueDate: data.issueDate ? new Date(data.issueDate) : existing.issueDate } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.paymentDate !== undefined ? { paymentDate: data.paymentDate ? new Date(data.paymentDate) : null } : {}),
      ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      clientId,
    },
    include: { client: { select: { id: true, name: true, cnpj: true, email: true } } },
  });

  res.json(receipt);
}

function receiptHtml(receipt) {
  const firm = receipt.accountingFirm;
  const logoSrc = logoDataUri(firm.logoUrl);
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
      <p>${escapeHtml(receipt.notes || 'Obrigado por fazer negócios conosco.')}</p>
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
    await page.setContent(receiptHtml(receipt), { waitUntil: 'networkidle' });
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
  listTransactions, createTransaction, markPaid,
  listReceipts, createReceipt, updateReceipt, receiptPdf,
  summary,
};
