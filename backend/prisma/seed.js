// Popula o banco com dados de exemplo, para você testar o sistema sem
// precisar cadastrar tudo manualmente. Rode com: npm run seed
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('senha123', 10);

  const firm = await prisma.accountingFirm.create({
    data: {
      name: 'Contábil Exemplo Ltda',
      cnpj: '11222333000144',
      email: 'contato@contabilexemplo.com.br',
      users: {
        create: [
          { name: 'Ana (Admin)', email: 'admin@exemplo.com', passwordHash, role: 'ADMIN' },
          { name: 'Carlos (Contador)', email: 'contador@exemplo.com', passwordHash, role: 'ACCOUNTANT' },
        ],
      },
    },
    include: { users: true },
  });

  const accountant = firm.users.find((u) => u.role === 'ACCOUNTANT');
  const admin = firm.users.find((u) => u.role === 'ADMIN');

  const client = await prisma.client.create({
    data: {
      name: 'Padaria Pão Quente ME',
      cnpj: '99888777000166',
      taxRegime: 'SIMPLES_NACIONAL',
      email: 'financeiro@paoquente.com.br',
      accountingFirmId: firm.id,
      portalUsers: {
        create: { name: 'João (Padaria)', email: 'joao@paoquente.com.br', passwordHash, role: 'CLIENT', accountingFirmId: firm.id },
      },
    },
  });

  await prisma.demand.createMany({
    data: [
      {
        title: 'Enviar nota fiscal de compra de insumos - Maio',
        description: 'Precisamos da nota fiscal dos insumos comprados em maio para lançamento contábil.',
        category: 'DOCUMENTACAO',
        priority: 'HIGH',
        status: 'PENDING',
        dueDate: new Date('2026-06-25'),
        clientId: client.id,
        assignedToId: accountant.id,
        createdById: admin.id,
      },
      {
        title: 'Fechamento contábil de Maio/2026',
        description: 'Conferir lançamentos e gerar balancete.',
        category: 'CONTABIL',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        dueDate: new Date('2026-06-30'),
        clientId: client.id,
        assignedToId: accountant.id,
        createdById: admin.id,
      },
      {
        title: 'Guia do Simples Nacional (DAS) - Junho',
        category: 'FISCAL',
        priority: 'URGENT',
        status: 'PENDING',
        dueDate: new Date('2026-06-20'),
        clientId: client.id,
        assignedToId: accountant.id,
        createdById: admin.id,
        recurrence: 'MONTHLY',
      },
    ],
  });

  // ---------- Obrigações, vínculos e robôs ----------
  const das = await prisma.obligation.create({
    data: {
      name: 'DAS - Documento de Arrecadacao do Simples Nacional',
      type: 'PAGAMENTO',
      department: 'Departamento Fiscal',
      nickname: 'DAS',
      frequency: 'MONTHLY',
      ruleMonth: 1,
      dueDay: 20,
      dueDateRule: 'ANTECIPA',
      accountingFirmId: firm.id,
    },
  });

  const darf = await prisma.obligation.create({
    data: {
      name: 'DARF Previdenciario',
      type: 'PAGAMENTO',
      department: 'Departamento Fiscal',
      nickname: 'DARFP',
      frequency: 'MONTHLY',
      ruleMonth: 1,
      dueDay: 20,
      dueDateRule: 'ANTECIPA',
      defaultRobot: true,
      accountingFirmId: firm.id,
    },
  });

  const balance = await prisma.obligation.create({
    data: {
      name: 'BALANCETE DE VERIFICACAO',
      type: 'DECLARACAO',
      department: 'Departamento Contabil',
      nickname: 'BAL',
      frequency: 'MONTHLY',
      ruleMonth: 1,
      dueDay: 25,
      dueDateRule: 'POSTERGA',
      accountingFirmId: firm.id,
    },
  });

  await prisma.clientObligation.createMany({
    data: [
      { clientId: client.id, obligationId: das.id, responsibleId: accountant.id },
      { clientId: client.id, obligationId: darf.id, responsibleId: accountant.id },
      { clientId: client.id, obligationId: balance.id, responsibleId: accountant.id },
    ],
    skipDuplicates: true,
  });

  await prisma.obligationGroup.create({
    data: {
      nickname: 'SNC',
      name: 'Simples Nacional Comercio',
      accountingFirmId: firm.id,
      items: {
        create: [
          { obligationId: das.id },
          { obligationId: darf.id },
          { obligationId: balance.id },
        ],
      },
    },
  });

  await prisma.obligationRobot.createMany({
    data: [
      {
        accountingFirmId: firm.id,
        obligationId: darf.id,
        name: 'Robo de leitura de DARFs',
        identifiers: ['0561', '0588', '1082', '1089', '1099', 'darf previdenciario'],
      },
      {
        accountingFirmId: firm.id,
        obligationId: das.id,
        name: 'Robo de leitura de DAS',
        identifiers: ['das', 'simples nacional', 'pgdas'],
      },
    ],
  });

  // ---------- Financeiro ----------
  const [catVendas, catInsumos, catImpostos] = await Promise.all([
    prisma.financialCategory.create({ data: { name: 'Vendas', type: 'RECEITA', accountingFirmId: firm.id } }),
    prisma.financialCategory.create({ data: { name: 'Compra de insumos', type: 'DESPESA', accountingFirmId: firm.id } }),
    prisma.financialCategory.create({ data: { name: 'Impostos', type: 'DESPESA', accountingFirmId: firm.id } }),
  ]);

  const account = await prisma.financialAccount.create({
    data: { bankName: 'Banco do Brasil', agency: '1234-5', accountNum: '98765-0', balance: 8500, clientId: client.id },
  });

  await prisma.financialTransaction.createMany({
    data: [
      { description: 'Venda de produtos - semana 1', amount: 3200, type: 'RECEITA', status: 'PAID', dueDate: new Date('2026-06-05'), paidAt: new Date('2026-06-05'), clientId: client.id, accountId: account.id, categoryId: catVendas.id },
      { description: 'Compra de farinha e insumos', amount: 950, type: 'DESPESA', status: 'PAID', dueDate: new Date('2026-06-08'), paidAt: new Date('2026-06-08'), clientId: client.id, accountId: account.id, categoryId: catInsumos.id },
      { description: 'DAS - Simples Nacional', amount: 480, type: 'DESPESA', status: 'PENDING', dueDate: new Date('2026-06-20'), clientId: client.id, accountId: account.id, categoryId: catImpostos.id },
    ],
  });

  // ---------- Nota fiscal ----------
  await prisma.invoice.create({
    data: {
      number: '000001',
      type: 'NFSE',
      status: 'ISSUED',
      totalValue: 1200,
      issueDate: new Date('2026-06-10'),
      description: 'Prestação de serviços de consultoria',
      clientId: client.id,
      items: { create: [{ description: 'Consultoria - Junho/2026', quantity: 1, unitValue: 1200 }] },
    },
  });

  // ---------- Folha de pagamento ----------
  const employee = await prisma.employee.create({
    data: { name: 'Maria Padeira', cpf: '12345678900', role: 'Confeiteira', baseSalary: 2200, admissionAt: new Date('2024-02-01'), clientId: client.id },
  });

  await prisma.payrollEntry.create({
    data: {
      employeeId: employee.id,
      refMonth: 5,
      refYear: 2026,
      grossSalary: 2200,
      inss: 218.35,
      irrf: 0,
      fgts: 176,
      otherBenefits: 150,
      netSalary: 2131.65,
    },
  });

  console.log('Seed concluído!');
  console.log('Login admin: admin@exemplo.com / senha123');
  console.log('Login contador: contador@exemplo.com / senha123');
  console.log('Login cliente (portal): joao@paoquente.com.br / senha123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
