const { z } = require('zod');
const { chromium } = require('playwright');
const prisma = require('../lib/prisma');
const { lookupCnpj } = require('../services/cnpjLookup.service');
const { SERVICES, SERVICE_KEYS, contractHtml, defaultSettings } = require('../services/contractDocument');

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
const formatCnpj = (value) => onlyDigits(value).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const firmWhere = (req) => ({ accountingFirmId: req.user.accountingFirmId });

const settingsSchema = z.object({
  representanteNome: z.string().trim().max(200).default(''),
  representanteQualificacao: z.string().trim().max(200).default(''),
  representanteCpf: z.string().trim().max(20).default(''),
  crc: z.string().trim().max(60).default(''),
  crcUf: z.string().trim().max(30).default(''),
  cidadeAssinatura: z.string().trim().max(120).default(''),
  ufAssinatura: z.string().trim().max(2).default(''),
  foro: z.string().trim().max(120).default(''),
  diasPagamento: z.string().trim().max(60).default('01 a 05 ou 10'),
  prazoDocumentos: z.string().trim().max(40).default('02 (dois)'),
  honorarioAnual: z.boolean().default(false),
  avisoPrevioDias: z.coerce.number().int().min(0).max(365).default(30),
});

const contratanteSchema = z.object({
  razaoSocial: z.string().trim().min(2, 'Informe a razão social do contratante.').max(250),
  cep: z.string().trim().max(12).optional().default(''),
  logradouro: z.string().trim().max(200).optional().default(''),
  numero: z.string().trim().max(30).optional().default(''),
  complemento: z.string().trim().max(200).optional().default(''),
  bairro: z.string().trim().max(120).optional().default(''),
  cidade: z.string().trim().max(120).optional().default(''),
  uf: z.string().trim().max(2).optional().default(''),
  representanteNome: z.string().trim().max(200).optional().default(''),
  representanteQualificacao: z.string().trim().max(200).optional().default(''),
  representanteCpf: z.string().trim().max(20).optional().default(''),
});

const contractSchema = z.object({
  cnpj: z.string().refine((value) => onlyDigits(value).length === 14, 'CNPJ deve ter 14 dígitos.'),
  startDate: z.coerce.date(),
  monthlyFee: z.coerce.number().positive('Informe o valor mensal.'),
  services: z.array(z.string()).min(1, 'Selecione pelo menos um serviço.').refine((list) => list.every((key) => SERVICE_KEYS.has(key)), 'Serviço inválido.'),
  contratante: contratanteSchema,
});

async function loadFirm(req) {
  return prisma.accountingFirm.findUnique({ where: { id: req.user.accountingFirmId } });
}

function serializeContract(contract) {
  return {
    id: contract.id,
    number: contract.number,
    clientId: contract.clientId,
    cnpj: contract.cnpj,
    contratante: contract.contratante,
    startDate: contract.startDate,
    monthlyFee: Number(contract.monthlyFee),
    services: contract.services,
    status: contract.status,
    createdAt: contract.createdAt,
  };
}

async function getSettings(req, res) {
  const firm = await loadFirm(req);
  const saved = firm.contractSettings || null;
  res.json({ configured: Boolean(saved?.representanteNome), settings: { ...defaultSettings(firm), ...(saved || {}) }, services: SERVICES.map(({ key, label }) => ({ key, label })) });
}

async function saveSettings(req, res) {
  const data = settingsSchema.parse(req.body);
  await prisma.accountingFirm.update({ where: { id: req.user.accountingFirmId }, data: { contractSettings: data } });
  res.json({ configured: Boolean(data.representanteNome), settings: data });
}

// Dados do contratante a partir do CNPJ (Receita), para conferir antes de gerar.
async function prefill(req, res) {
  const data = await lookupCnpj(req.params.cnpj);
  const partners = data.partners || [];
  const admin = partners.find((item) => /administrador|titular|empres[aá]rio|presidente|diretor/i.test(item.role)) || partners[0];
  const client = await prisma.client.findFirst({ where: { ...firmWhere(req), cnpj: { in: [data.cnpj, onlyDigits(data.cnpj)] } }, select: { id: true, name: true, code: true } });
  res.set('Cache-Control', 'no-store');
  res.json({
    cnpj: data.cnpj,
    situation: data.situation,
    client,
    partners,
    contratante: {
      razaoSocial: data.name,
      cep: data.cep,
      logradouro: data.street,
      numero: data.number,
      complemento: data.complement,
      bairro: data.neighborhood,
      cidade: data.city,
      uf: data.state,
      // Empresário individual/MEI: o titular é a própria pessoa da razão social.
      representanteNome: admin?.name || '',
      representanteQualificacao: admin?.role ? `${admin.role.toLowerCase()}` : '',
      representanteCpf: '',
    },
  });
}

async function list(req, res) {
  const contracts = await prisma.contract.findMany({ where: firmWhere(req), orderBy: { number: 'desc' } });
  res.json(contracts.map(serializeContract));
}

async function create(req, res) {
  const data = contractSchema.parse(req.body);
  const firm = await loadFirm(req);
  if (!firm.contractSettings?.representanteNome) {
    return res.status(400).json({ error: 'Preencha antes os dados do escritório para contratos (botão "Dados do escritório").' });
  }
  const cnpj = formatCnpj(data.cnpj);
  const client = await prisma.client.findFirst({ where: { ...firmWhere(req), cnpj: { in: [cnpj, onlyDigits(cnpj)] } }, select: { id: true } });
  const contract = await prisma.$transaction(async (tx) => {
    const last = await tx.contract.findFirst({ where: firmWhere(req), orderBy: { number: 'desc' }, select: { number: true } });
    return tx.contract.create({
      data: {
        accountingFirmId: req.user.accountingFirmId,
        clientId: client?.id || null,
        number: (last?.number || 0) + 1,
        cnpj,
        contratante: { ...data.contratante, cnpj },
        startDate: data.startDate,
        monthlyFee: data.monthlyFee,
        services: data.services,
        createdById: req.user.id || null,
      },
    });
  });
  res.status(201).json(serializeContract(contract));
}

async function updateStatus(req, res) {
  const status = z.enum(['ATIVO', 'ENCERRADO']).parse(req.body.status);
  const existing = await prisma.contract.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Contrato não encontrado.' });
  const contract = await prisma.contract.update({ where: { id: existing.id }, data: { status } });
  res.json(serializeContract(contract));
}

async function remove(req, res) {
  const existing = await prisma.contract.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!existing) return res.status(404).json({ error: 'Contrato não encontrado.' });
  await prisma.contract.delete({ where: { id: existing.id } });
  res.status(204).end();
}

async function pdf(req, res) {
  const contract = await prisma.contract.findFirst({ where: { id: req.params.id, ...firmWhere(req) } });
  if (!contract) return res.status(404).json({ error: 'Contrato não encontrado.' });
  const firm = await loadFirm(req);
  const html = contractHtml({ contract: { ...contract, monthlyFee: Number(contract.monthlyFee) }, firm, settings: firm.contractSettings });
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const nome = String(contract.contratante?.razaoSocial || 'contrato').normalize('NFD').replace(/[^\w ]/g, '').trim().replace(/\s+/g, '_').slice(0, 50);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Contrato_${String(contract.number).padStart(4, '0')}_${nome}.pdf"`);
    res.send(buffer);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { getSettings, saveSettings, prefill, list, create, updateStatus, remove, pdf };
