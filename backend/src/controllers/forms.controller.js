const { z } = require('zod');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const blockSchema = z.object({
  id: z.string(),
  type: z.enum([
    'TEXTO_CURTO',
    'TEXTO_LONGO',
    'SIM_NAO',
    'MULTIPLA_ESCOLHA',
    'DROPDOWN',
    'DATA',
    'UPLOAD',
    'AVALIACAO',
    'LOGICA',
    'VALIDACAO',
  ]),
  title: z.string().default(''),
  description: z.string().optional().nullable(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  logic: z
    .object({
      sourceBlockId: z.string().optional().nullable(),
      operator: z.enum(['IGUAL', 'DIFERENTE']).optional(),
      value: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  validation: z
    .object({
      minLength: z.number().int().optional().nullable(),
      maxLength: z.number().int().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const pageSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  blocks: z.array(blockSchema).default([]),
});

const settingsSchema = z
  .object({
    language: z.string().optional(),
    mode: z.enum(['editar', 'mostrar']).optional(),
    cookieName: z.string().optional().nullable(),
    widthMode: z.string().optional(),
  })
  .optional()
  .nullable();

const formSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  status: z.enum(['ATIVO', 'INATIVO']).optional(),
  settings: settingsSchema,
  pages: z.array(pageSchema).optional(),
});

function firmWhere(req) {
  return { accountingFirmId: req.user.accountingFirmId };
}

async function ensureForm(req, id) {
  return prisma.form.findFirst({ where: { id, ...firmWhere(req) } });
}

async function listForms(req, res) {
  const { status, department, search } = req.query;
  const where = { ...firmWhere(req) };
  if (status) where.status = status;
  if (department) where.department = department;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  const forms = await prisma.form.findMany({ where, orderBy: { name: 'asc' } });
  res.json(forms);
}

async function getForm(req, res) {
  const form = await ensureForm(req, req.params.id);
  if (!form) return res.status(404).json({ message: 'Formulário não encontrado.' });
  res.json(form);
}

async function createForm(req, res) {
  const data = formSchema.parse(req.body);
  const form = await prisma.form.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      department: data.department ?? null,
      status: data.status ?? 'ATIVO',
      settings: data.settings ?? { language: 'pt-BR', mode: 'editar', widthMode: 'padrao' },
      pages: data.pages ?? [{ id: crypto.randomUUID(), title: 'Página 1', blocks: [] }],
      accountingFirmId: req.user.accountingFirmId,
    },
  });
  res.status(201).json(form);
}

async function updateForm(req, res) {
  const existing = await ensureForm(req, req.params.id);
  if (!existing) return res.status(404).json({ message: 'Formulário não encontrado.' });

  const data = formSchema.partial().parse(req.body);
  const form = await prisma.form.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.department !== undefined ? { department: data.department } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.settings !== undefined ? { settings: data.settings } : {}),
      ...(data.pages !== undefined ? { pages: data.pages } : {}),
    },
  });
  res.json(form);
}

async function toggleFormStatus(req, res) {
  const existing = await ensureForm(req, req.params.id);
  if (!existing) return res.status(404).json({ message: 'Formulário não encontrado.' });
  const form = await prisma.form.update({
    where: { id: existing.id },
    data: { status: existing.status === 'ATIVO' ? 'INATIVO' : 'ATIVO' },
  });
  res.json(form);
}

async function removeForm(req, res) {
  const existing = await ensureForm(req, req.params.id);
  if (!existing) return res.status(404).json({ message: 'Formulário não encontrado.' });
  await prisma.form.delete({ where: { id: existing.id } });
  res.status(204).send();
}

module.exports = {
  listForms,
  getForm,
  createForm,
  updateForm,
  toggleFormStatus,
  removeForm,
};
