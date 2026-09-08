const prisma = require('../lib/prisma');

const TABLES_TO_CLEAR = [
  'password_reset_requests',
  'client_department_responsibles',
  'firm_roles',
  'departments',
  'demand_attachments',
  'demand_comments',
  'demands',
  'task_templates',
  'task_processes',
  'process_templates',
  'obligation_group_items',
  'client_obligations',
  'obligation_robots',
  'protocol_documents',
  'obligation_groups',
  'obligations',
  'whatsapp_messages',
  'whatsapp_conversations',
  'tax_pendencies',
  'tax_pendency_checks',
  'documents',
  'financial_transactions',
  'financial_accounts',
  'financial_categories',
  'invoice_items',
  'invoices',
  'payroll_entries',
  'employees',
  'forms',
  'notifications',
  'audit_logs',
  'client_contacts',
  'clients',
];

async function clearRegistrationsKeepAdmin(req, res) {
  const currentUser = await prisma.user.findFirst({
    where: { id: req.user.id, accountingFirmId: req.user.accountingFirmId, role: 'ADMIN' },
    select: { id: true, email: true },
  });

  if (!currentUser) {
    return res.status(403).json({ error: 'Somente administrador pode limpar os cadastros.' });
  }

  const quotedTables = TABLES_TO_CLEAR.map((table) => `"${table}"`).join(', ');

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`),
    prisma.user.deleteMany({
      where: {
        accountingFirmId: req.user.accountingFirmId,
        id: { not: currentUser.id },
      },
    }),
    prisma.user.update({
      where: { id: currentUser.id },
      data: {
        name: currentUser.email === 'admin@exemplo.com' ? 'Administrador teste' : undefined,
        role: 'ADMIN',
        active: true,
        clientId: null,
      },
    }),
  ]);

  const remainingUsers = await prisma.user.findMany({
    where: { accountingFirmId: req.user.accountingFirmId },
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: { email: 'asc' },
  });

  res.json({
    message: 'Cadastros apagados. Apenas o administrador foi mantido.',
    users: remainingUsers,
  });
}

module.exports = { clearRegistrationsKeepAdmin };
