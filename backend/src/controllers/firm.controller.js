const { z } = require('zod');
const prisma = require('../lib/prisma');
const drive = require('../services/googleDrive.service');
const { isEmailConfigured, missingEmailConfig } = require('../services/email.service');
const certCrypto = require('../utils/certCrypto');
const { inspectPfx } = require('../utils/certInspect');
const { logoDataUrl, preserveFirmLogo } = require('../utils/firmLogo');

function serializeFirm(firm) {
  return {
    id: firm.id,
    name: firm.name,
    cnpj: firm.cnpj,
    email: firm.email,
    phone: firm.phone,
    crc: firm.crc,
    logoUrl: firm.logoUrl,
    cep: firm.cep,
    street: firm.street,
    number: firm.number,
    complement: firm.complement,
    neighborhood: firm.neighborhood,
    city: firm.city,
    state: firm.state,
    certificate: firm.certificateSubject
      ? {
          subject: firm.certificateSubject,
          validUntil: firm.certificateValidUntil,
          uploadedAt: firm.certificateUploadedAt,
          expired: firm.certificateValidUntil ? new Date(firm.certificateValidUntil) < new Date() : false,
        }
      : null,
  };
}

async function getFirm(req, res) {
  const firm = await prisma.accountingFirm.findUnique({ where: { id: req.user.accountingFirmId } });
  res.json(serializeFirm(await preserveFirmLogo(firm, prisma)));
}

const updateFirmSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  crc: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

async function updateFirm(req, res) {
  const data = updateFirmSchema.parse(req.body);
  const firm = await prisma.accountingFirm.update({ where: { id: req.user.accountingFirmId }, data });
  res.json(serializeFirm(firm));
}

async function uploadLogo(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado.' });
  const firm = await prisma.accountingFirm.update({
    where: { id: req.user.accountingFirmId },
    data: { logoUrl: logoDataUrl(req.file.buffer) },
  });
  res.json(serializeFirm(firm));
}

async function uploadCertificate(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Arquivo do certificado (.pfx) não enviado.' });
  if (!req.body.passphrase) return res.status(400).json({ error: 'Informe a senha do certificado.' });
  if (!certCrypto.isConfigured()) {
    return res.status(500).json({ error: 'CERT_ENCRYPTION_KEY não configurada no servidor. Configure antes de subir um certificado.' });
  }

  let meta;
  try {
    meta = inspectPfx(req.file.buffer, req.body.passphrase);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const firm = await prisma.accountingFirm.update({
    where: { id: req.user.accountingFirmId },
    data: {
      certificatePfxEncrypted: certCrypto.encrypt(req.file.buffer),
      certificatePassphraseEncrypted: certCrypto.encrypt(req.body.passphrase),
      certificateSubject: meta.subject,
      certificateValidUntil: meta.validUntil,
      certificateUploadedAt: new Date(),
    },
  });

  res.status(201).json(serializeFirm(firm));
}

async function removeCertificate(req, res) {
  const firm = await prisma.accountingFirm.update({
    where: { id: req.user.accountingFirmId },
    data: {
      certificatePfxEncrypted: null,
      certificatePassphraseEncrypted: null,
      certificateSubject: null,
      certificateValidUntil: null,
      certificateUploadedAt: null,
    },
  });
  res.json(serializeFirm(firm));
}

// ---------- Conferência pelo Google Drive ----------

function driveSettingsPayload(firm) {
  return {
    driveConfigured: drive.isConfigured(),
    serviceAccountEmail: drive.serviceAccountEmail(),
    conferenceFolderId: firm.driveConferenceFolderId || null,
    clientsFolderId: firm.driveClientsFolderId || null,
    lastSyncAt: firm.driveLastSyncAt || null,
    lastSyncError: firm.driveLastSyncError || null,
    emailConfigured: isEmailConfigured(),
    emailMissing: missingEmailConfig(),
  };
}

async function getDriveSettings(req, res) {
  const firm = await prisma.accountingFirm.findUnique({ where: { id: req.user.accountingFirmId } });
  res.json(driveSettingsPayload(firm));
}

const driveSettingsSchema = z.object({
  conferenceFolder: z.string().max(500).optional().nullable(),
  clientsFolder: z.string().max(500).optional().nullable(),
});

async function updateDriveSettings(req, res) {
  const data = driveSettingsSchema.parse(req.body || {});
  const update = {};
  const checked = [];
  for (const [field, column, label] of [['conferenceFolder', 'driveConferenceFolderId', 'Pasta de conferência'], ['clientsFolder', 'driveClientsFolderId', 'Pasta de clientes']]) {
    if (data[field] === undefined) continue;
    if (!data[field]) { update[column] = null; continue; }
    const folderId = drive.folderIdFromInput(data[field]);
    if (!folderId) return res.status(400).json({ error: `${label}: cole o link da pasta do Google Drive.` });
    if (drive.isConfigured()) {
      const folder = await drive.getFolder(folderId);
      if (folder.capabilities && folder.capabilities.canAddChildren === false) {
        return res.status(400).json({ error: `${label}: a conta de serviço precisa ser Editor da pasta "${folder.name}".` });
      }
      checked.push({ label, name: folder.name });
    }
    update[column] = folderId;
  }
  const firm = await prisma.accountingFirm.update({ where: { id: req.user.accountingFirmId }, data: update });
  res.json({ ...driveSettingsPayload(firm), checked });
}

module.exports = {
  getDriveSettings,
  updateDriveSettings,
  getFirm,
  updateFirm,
  uploadLogo,
  uploadCertificate,
  removeCertificate,
};
