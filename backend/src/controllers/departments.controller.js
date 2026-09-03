const { z } = require('zod');
const prisma = require('../lib/prisma');

const DEFAULT_DEPARTMENTS = ['Departamento Contábil', 'Departamento de Registro', 'Departamento Financeiro', 'Departamento Fiscal', 'Departamento Pessoal'];

function firmWhere(req) {
  return { accountingFirmId: req.user.accountingFirmId };
}

// Na primeira visita, cria os departamentos padrão (se o escritório ainda
// não tiver nenhum), já com o usuário logado como responsável — só pra não
// começar com a tela vazia.
async function ensureDefaultDepartments(req) {
  const count = await prisma.department.count({ where: firmWhere(req) });
  if (count > 0) return;
  await prisma.department.createMany({
    data: DEFAULT_DEPARTMENTS.map((name) => ({ name, accountingFirmId: req.user.accountingFirmId, responsibleId: req.user.id })),
  });
}

async function listDepartments(req, res) {
  await ensureDefaultDepartments(req);
  const departments = await prisma.department.findMany({
    where: firmWhere(req),
    include: { responsible: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(departments);
}

const departmentSchema = z.object({
  name: z.string().min(2),
  responsibleId: z.string().optional().nullable(),
});

async function createDepartment(req, res) {
  const data = departmentSchema.parse(req.body);
  const department = await prisma.department.create({
    data: { ...data, accountingFirmId: req.user.accountingFirmId },
    include: { responsible: { select: { id: true, name: true } } },
  });
  res.status(201).json(department);
}

async function updateDepartment(req, res) {
  const existing = await prisma.department.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Departamento não encontrado.' });
  const data = departmentSchema.partial().parse(req.body);
  const department = await prisma.department.update({
    where: { id: existing.id },
    data,
    include: { responsible: { select: { id: true, name: true } } },
  });
  res.json(department);
}

async function removeDepartment(req, res) {
  const existing = await prisma.department.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Departamento não encontrado.' });
  await prisma.department.delete({ where: { id: existing.id } });
  res.status(204).send();
}

// Matriz cliente x departamento x responsável. Gera uma linha para cada
// combinação existente (mesmo sem um responsável definido ainda).
async function getClientMatrix(req, res) {
  await ensureDefaultDepartments(req);
  const [clients, departments, links] = await Promise.all([
    prisma.client.findMany({ where: { ...firmWhere(req), active: true }, orderBy: { name: 'asc' } }),
    prisma.department.findMany({ where: firmWhere(req), orderBy: { name: 'asc' } }),
    prisma.clientDepartmentResponsible.findMany({
      where: { client: firmWhere(req) },
      include: { responsible: { select: { id: true, name: true } } },
    }),
  ]);

  const linkMap = new Map(links.map((link) => [`${link.clientId}:${link.departmentId}`, link]));

  const rows = [];
  for (const client of clients) {
    for (const department of departments) {
      const link = linkMap.get(`${client.id}:${department.id}`);
      rows.push({
        id: link?.id || `${client.id}:${department.id}`,
        client: { id: client.id, name: client.name, cnpj: client.cnpj, code: client.code },
        department: { id: department.id, name: department.name },
        responsible: link?.responsible || null,
      });
    }
  }
  res.json(rows);
}

const matrixUpdateSchema = z.object({
  clientId: z.string(),
  departmentId: z.string(),
  responsibleId: z.string().optional().nullable(),
});

async function upsertClientMatrix(req, res) {
  const data = matrixUpdateSchema.parse(req.body);
  const client = await prisma.client.findFirst({ where: { id: data.clientId, ...firmWhere(req) } });
  const department = await prisma.department.findFirst({ where: { id: data.departmentId, ...firmWhere(req) } });
  if (!client || !department) return res.status(404).json({ error: 'Cliente ou departamento não encontrado.' });

  const link = await prisma.clientDepartmentResponsible.upsert({
    where: { clientId_departmentId: { clientId: data.clientId, departmentId: data.departmentId } },
    update: { responsibleId: data.responsibleId || null },
    create: { clientId: data.clientId, departmentId: data.departmentId, responsibleId: data.responsibleId || null },
    include: { responsible: { select: { id: true, name: true } } },
  });
  res.json(link);
}

async function listFirmRoles(req, res) {
  const roles = await prisma.firmRole.findMany({
    where: firmWhere(req),
    include: { user: { select: { id: true, name: true } } },
    orderBy: { title: 'asc' },
  });
  res.json(roles);
}

const firmRoleSchema = z.object({
  title: z.string().min(2),
  userId: z.string().optional().nullable(),
});

async function createFirmRole(req, res) {
  const data = firmRoleSchema.parse(req.body);
  const role = await prisma.firmRole.create({
    data: { ...data, accountingFirmId: req.user.accountingFirmId },
    include: { user: { select: { id: true, name: true } } },
  });
  res.status(201).json(role);
}

async function removeFirmRole(req, res) {
  const existing = await prisma.firmRole.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Cargo não encontrado.' });
  await prisma.firmRole.delete({ where: { id: existing.id } });
  res.status(204).send();
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  removeDepartment,
  getClientMatrix,
  upsertClientMatrix,
  listFirmRoles,
  createFirmRole,
  removeFirmRole,
};
