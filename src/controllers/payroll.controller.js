const { z } = require('zod');
const prisma = require('../lib/prisma');
const { calcPayroll } = require('../utils/payrollCalculator');

function clientScope(user) {
  if (user.role === 'CLIENT') return { clientId: user.clientId };
  return { client: { accountingFirmId: user.accountingFirmId } };
}

// ---------- Funcionários ----------

const employeeSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório.'),
  cpf: z.string().min(11, 'CPF inválido.'),
  role: z.string().min(2, 'Cargo é obrigatório.'),
  baseSalary: z.number().positive('Salário precisa ser maior que zero.'),
  admissionAt: z.string().datetime(),
  clientId: z.string().uuid(),
});

async function listEmployees(req, res) {
  const employees = await prisma.employee.findMany({
    where: clientScope(req.user),
    include: { client: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(employees);
}

async function createEmployee(req, res) {
  if (req.user.role === 'CLIENT') req.body.clientId = req.user.clientId;
  const data = employeeSchema.parse(req.body);
  const employee = await prisma.employee.create({
    data: { ...data, admissionAt: new Date(data.admissionAt) },
  });
  res.status(201).json(employee);
}

// ---------- Folha mensal ----------

const generateSchema = z.object({
  employeeId: z.string().uuid(),
  refMonth: z.number().int().min(1).max(12),
  refYear: z.number().int().min(2000),
  otherBenefits: z.number().optional(),
});

async function listEntries(req, res) {
  const { employeeId, refMonth, refYear } = req.query;

  const employees = await prisma.employee.findMany({ where: clientScope(req.user), select: { id: true } });
  const employeeIds = employees.map((e) => e.id);

  const entries = await prisma.payrollEntry.findMany({
    where: {
      employeeId: employeeId ? employeeId : { in: employeeIds },
      ...(refMonth ? { refMonth: Number(refMonth) } : {}),
      ...(refYear ? { refYear: Number(refYear) } : {}),
    },
    include: { employee: { select: { name: true, role: true } } },
    orderBy: [{ refYear: 'desc' }, { refMonth: 'desc' }],
  });

  res.json(entries);
}

// Gera (ou recalcula) a folha de um funcionário para um mês específico.
async function generateEntry(req, res) {
  const data = generateSchema.parse(req.body);

  const employee = await prisma.employee.findFirst({ where: { id: data.employeeId, ...clientScope(req.user) } });
  if (!employee) return res.status(404).json({ error: 'Funcionário não encontrado.' });

  const calc = calcPayroll({ grossSalary: Number(employee.baseSalary), otherBenefits: data.otherBenefits || 0 });

  const entry = await prisma.payrollEntry.upsert({
    where: { employeeId_refMonth_refYear: { employeeId: data.employeeId, refMonth: data.refMonth, refYear: data.refYear } },
    create: {
      employeeId: data.employeeId,
      refMonth: data.refMonth,
      refYear: data.refYear,
      grossSalary: employee.baseSalary,
      otherBenefits: data.otherBenefits || 0,
      ...calc,
    },
    update: {
      grossSalary: employee.baseSalary,
      otherBenefits: data.otherBenefits || 0,
      ...calc,
    },
  });

  res.status(201).json(entry);
}

module.exports = { listEmployees, createEmployee, listEntries, generateEntry };
