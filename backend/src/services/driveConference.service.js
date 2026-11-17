// Conferência automática:
// 1) lê os PDFs novos da pasta do Drive do escritório;
// 2) identifica cliente, obrigação, competência, vencimento e valor;
// 3) coloca o documento na aba Conferência para aprovação;
// 4) ao aprovar: envia por e-mail ao cliente, dá baixa na tarefa do mês e move
//    o arquivo no Drive para CLIENTE / DEPARTAMENTO / ANO / MMAAAA.
const pdfParse = require('pdf-parse');
const prisma = require('../lib/prisma');
const drive = require('./googleDrive.service');
const fileStorage = require('./fileStorage.service');
const { sendEmail, missingEmailConfig } = require('./email.service');
const { identifyDocument, formatCompetence, normalize, periodsFromReference } = require('./conferenceIdentify');

const MAX_FILES_PER_RUN = 25;
const running = new Set();

const protocolInclude = { client: true, obligation: true, demand: true, responsible: { select: { id: true, name: true } } };

function isPdf(file) {
  return file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

async function readPdfText(buffer) {
  try {
    return (await pdfParse(buffer)).text || '';
  } catch {
    return '';
  }
}

async function syncFirm(accountingFirmId, { db = prisma, driveApi = drive, storage = fileStorage } = {}) {
  if (running.has(accountingFirmId)) return { status: 'RUNNING', imported: 0 };
  running.add(accountingFirmId);
  try {
    const firm = await db.accountingFirm.findUnique({ where: { id: accountingFirmId } });
    if (!firm?.driveConferenceFolderId) return { status: 'NOT_CONFIGURED', imported: 0 };
    if (!driveApi.isConfigured()) return { status: 'NOT_CONFIGURED', imported: 0, error: 'Falta a variável GOOGLE_SERVICE_ACCOUNT_JSON no servidor.' };

    const files = (await driveApi.listChildren(firm.driveConferenceFolderId, { filesOnly: true })).filter(isPdf);
    const known = await db.protocolDocument.findMany({
      where: { accountingFirmId, sourceDriveFileId: { in: files.map((f) => f.id) } },
      select: { sourceDriveFileId: true },
    });
    const knownIds = new Set(known.map((item) => item.sourceDriveFileId));
    const pending = files.filter((f) => !knownIds.has(f.id)).slice(0, MAX_FILES_PER_RUN);

    const [clients, obligations, robots, links] = pending.length
      ? await Promise.all([
        db.client.findMany({ where: { accountingFirmId, active: true }, select: { id: true, name: true, cnpj: true, code: true, email: true } }),
        db.obligation.findMany({ where: { accountingFirmId }, select: { id: true, name: true, nickname: true, department: true, frequency: true } }),
        db.obligationRobot.findMany({ where: { accountingFirmId }, select: { obligationId: true, identifiers: true, active: true } }),
        db.clientObligation.findMany({ where: { client: { accountingFirmId } }, select: { clientId: true, obligationId: true, active: true } }),
      ])
      : [[], [], [], []];

    let imported = 0;
    const errors = [];
    for (const file of pending) {
      try {
        const buffer = await driveApi.downloadFile(file.id);
        const text = await readPdfText(buffer);
        const result = identifyDocument(text, { clients, obligations, robots, links, firmTaxId: firm.cnpj });
        const fileUrl = await storage.saveFile({ buffer, originalName: file.name, mimeType: 'application/pdf', folder: `${accountingFirmId}/conferencia` });
        await db.protocolDocument.create({
          data: {
            accountingFirmId,
            clientId: result.client?.id || null,
            obligationId: result.obligation?.id || null,
            fileName: file.name,
            fileSize: buffer.length,
            mimeType: 'application/pdf',
            fileUrl,
            sourceDriveFileId: file.id,
            status: 'CONFERENCIA',
            deliveryType: 'EMAIL',
            reference: formatCompetence(result.competence),
            competenceYear: result.competence?.year || null,
            competenceMonth: result.competence?.month || null,
            taskYear: result.taskPeriod?.year || null,
            taskMonth: result.taskPeriod?.month || null,
            dueDate: result.dueDate,
            totalValue: result.totalValue,
            robotMatched: Boolean(result.client && result.obligation && result.competence),
            robotIdentifier: [result.clientMethod && `cliente por ${result.clientMethod}`, result.obligationReason && `obrigação por ${result.obligationReason}`].filter(Boolean).join('; ') || null,
            identificationNotes: result.notes.join('\n') || null,
          },
        });
        imported += 1;
      } catch (error) {
        if (error.code === 'P2002') continue; // já importado por outra execução
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    const remaining = files.length - knownIds.size - pending.length;
    await db.accountingFirm.update({
      where: { id: accountingFirmId },
      data: { driveLastSyncAt: new Date(), driveLastSyncError: errors.length ? errors.slice(0, 5).join('\n') : null },
    });
    return { status: 'DONE', imported, remaining: Math.max(remaining, 0), errors };
  } catch (error) {
    await db.accountingFirm.update({ where: { id: accountingFirmId }, data: { driveLastSyncAt: new Date(), driveLastSyncError: error.message } }).catch(() => {});
    throw error;
  } finally {
    running.delete(accountingFirmId);
  }
}

async function syncAllFirms(options = {}) {
  const db = options.db || prisma;
  const firms = await db.accountingFirm.findMany({ where: { driveConferenceFolderId: { not: null } }, select: { id: true } });
  for (const firm of firms) {
    try {
      await syncFirm(firm.id, options);
    } catch (error) {
      console.error('Falha ao buscar documentos no Drive:', error.message);
    }
  }
}

// ---------- Destino no Drive ----------

function digitsKey(value) {
  return String(value || '').replace(/\D/g, '');
}

function findClientFolder(folders, client) {
  const name = normalize(client.name);
  const code = String(client.code || '').trim();
  const items = folders.map((folder) => ({ folder, key: normalize(folder.name) }));
  return (
    items.find(({ key }) => key === name)
    || (code && items.find(({ key }) => new RegExp(`^0*${code}\\s*[-_.]`).test(key)))
    || items.find(({ key }) => key.length >= 5 && name.includes(key))
    || items.find(({ key }) => key.includes(name))
  )?.folder || null;
}

function findDepartmentFolder(folders, department) {
  const target = normalize(department);
  const short = target.replace(/^departamento\s+/, '');
  return folders.find((folder) => {
    const key = normalize(folder.name);
    return key === target || key === short || key === `departamento ${short}` || key === `depto ${short}` || key === `dp ${short}`;
  }) || null;
}

async function ensureChild(parentId, name, matcher, driveApi) {
  const children = await driveApi.listChildren(parentId, { foldersOnly: true });
  const found = matcher(children);
  if (found) return { folder: found, children };
  return { folder: await driveApi.createFolder(parentId, name), children };
}

// Segue a estrutura que o cliente já usa: DEPARTAMENTO/AAAA/MMAAAA ou DEPARTAMENTO/MMAAAA.
async function resolveDestination({ clientsRootId, client, department, period, driveApi = drive }) {
  const monthKey = `${String(period.month).padStart(2, '0')}${period.year}`;
  const clientFolderName = `${client.code ? `${client.code} - ` : ''}${client.name}`;
  const { folder: clientFolder } = await ensureChild(clientsRootId, clientFolderName, (items) => findClientFolder(items, client), driveApi);
  const departmentName = String(department || 'Departamento Fiscal').toUpperCase();
  const { folder: departmentFolder } = await ensureChild(clientFolder.id, departmentName, (items) => findDepartmentFolder(items, department || 'Departamento Fiscal'), driveApi);

  const departmentChildren = await driveApi.listChildren(departmentFolder.id, { foldersOnly: true });
  const isMonthFolder = (folder) => digitsKey(folder.name).length === 6 && /^\d{2}[\s./-]?\d{4}$/.test(String(folder.name).trim());
  const flatMonth = departmentChildren.find((folder) => isMonthFolder(folder) && digitsKey(folder.name) === monthKey);
  const usesFlat = departmentChildren.some(isMonthFolder) && !departmentChildren.some((folder) => String(folder.name).trim() === String(period.year));
  let monthFolder;
  let path;
  if (flatMonth || usesFlat) {
    monthFolder = flatMonth || await driveApi.createFolder(departmentFolder.id, monthKey);
    path = [clientFolder.name, departmentFolder.name, monthFolder.name];
  } else {
    const yearFolder = departmentChildren.find((folder) => String(folder.name).trim() === String(period.year))
      || await driveApi.createFolder(departmentFolder.id, String(period.year));
    const yearChildren = await driveApi.listChildren(yearFolder.id, { foldersOnly: true });
    monthFolder = yearChildren.find((folder) => digitsKey(folder.name) === monthKey) || await driveApi.createFolder(yearFolder.id, monthKey);
    path = [clientFolder.name, departmentFolder.name, yearFolder.name, monthFolder.name];
  }
  return { folderId: monthFolder.id, path: path.join(' / ') };
}

// ---------- Aprovação ----------

function splitEmails(value) {
  return String(value || '').split(/[;,\s]+/).map((item) => item.trim()).filter((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item));
}

function formatMoney(value) {
  if (value === null || value === undefined) return null;
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildEmail(protocol, firm) {
  const obligationName = protocol.obligation?.name || protocol.documentType || 'Documento';
  const competence = protocol.reference ? ` - competência ${protocol.reference}` : '';
  const lines = [
    `Olá, ${protocol.client.name}.`,
    '',
    `Segue em anexo o documento ${obligationName}${competence}.`,
    protocol.dueDate ? `Vencimento: ${new Date(protocol.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : null,
    protocol.totalValue ? `Valor: ${formatMoney(protocol.totalValue)}` : null,
    protocol.clientNote ? `\nObservação: ${protocol.clientNote}` : null,
    '',
    'Qualquer dúvida, estamos à disposição.',
    firm?.name || null,
  ];
  return { subject: `${obligationName}${competence} - ${protocol.client.name}`, text: lines.filter((line) => line !== null).join('\n') };
}

function problemsForApproval(protocol) {
  const problems = [];
  if (!protocol.client) problems.push('Defina o cliente do documento.');
  else if (!splitEmails(protocol.client.email).length) problems.push(`O cliente ${protocol.client.name} não tem e-mail válido no cadastro.`);
  if (!protocol.obligation) problems.push('Defina a obrigação do documento.');
  if (!protocol.taskYear || !protocol.taskMonth) problems.push('Defina a competência/mês da tarefa para dar baixa.');
  if (!protocol.fileUrl) problems.push('O documento não tem arquivo anexado.');
  return problems;
}

async function approveAndSend(protocolId, user, { db = prisma, driveApi = drive, storage = fileStorage, send = sendEmail } = {}) {
  const protocol = await db.protocolDocument.findFirst({ where: { id: protocolId, accountingFirmId: user.accountingFirmId }, include: protocolInclude });
  if (!protocol) throw Object.assign(new Error('Documento não encontrado.'), { status: 404 });
  if (protocol.status === 'PROTOCOLADO') throw Object.assign(new Error('Este documento já foi enviado.'), { status: 409 });

  // Documentos enviados manualmente só têm a competência em texto (MM/AAAA).
  if ((!protocol.taskYear || !protocol.taskMonth) && protocol.reference) {
    const periods = periodsFromReference(protocol.reference, { dueDate: protocol.dueDate, frequency: protocol.obligation?.frequency });
    if (periods.taskPeriod) {
      Object.assign(protocol, {
        competenceYear: periods.competence.year, competenceMonth: periods.competence.month,
        taskYear: periods.taskPeriod.year, taskMonth: periods.taskPeriod.month,
      });
      await db.protocolDocument.update({ where: { id: protocol.id }, data: { competenceYear: protocol.competenceYear, competenceMonth: protocol.competenceMonth, taskYear: protocol.taskYear, taskMonth: protocol.taskMonth } });
    }
  }

  const problems = problemsForApproval(protocol);
  if (problems.length) throw Object.assign(new Error(problems.join(' ')), { status: 400 });

  const link = await db.clientObligation.findFirst({ where: { clientId: protocol.clientId, obligationId: protocol.obligationId } });
  if (!link) {
    throw Object.assign(new Error(`A obrigação ${protocol.obligation.name} não está vinculada a ${protocol.client.name}. Vincule em Configurações > Vínculos (com data de início) ou corrija a obrigação do documento.`), { status: 400 });
  }

  const attachment = await storage.readFile(protocol.fileUrl);
  if (!attachment) throw Object.assign(new Error('O arquivo deste documento não está mais disponível. Envie novamente.'), { status: 409 });

  const firm = await db.accountingFirm.findUnique({ where: { id: user.accountingFirmId } });
  const recipients = splitEmails(protocol.client.email);
  const message = buildEmail(protocol, firm);
  const result = await send({ to: recipients.join(', '), subject: message.subject, text: message.text, attachments: [{ filename: protocol.fileName, content: attachment, contentType: 'application/pdf' }] });
  if (!result.sent) {
    throw Object.assign(new Error(`O e-mail do sistema não está configurado. Faltando no Render: ${missingEmailConfig().join(', ')}.`), { status: 400 });
  }

  const now = new Date();
  await db.clientObligationStatus.upsert({
    where: { linkId_year_month: { linkId: link.id, year: protocol.taskYear, month: protocol.taskMonth } },
    update: { taskStatus: 'CONCLUIDA' },
    create: { linkId: link.id, year: protocol.taskYear, month: protocol.taskMonth, taskStatus: 'CONCLUIDA' },
  });
  let updated = await db.protocolDocument.update({
    where: { id: protocol.id },
    data: { status: 'PROTOCOLADO', deliveryType: 'EMAIL', protocolDate: now, sentAt: now, emailTo: recipients.join(', '), emailStatus: 'ENVIADO', responsibleId: user.id },
    include: protocolInclude,
  });

  let warning = null;
  if (protocol.sourceDriveFileId) {
    try {
      if (!firm?.driveClientsFolderId) throw new Error('a pasta de clientes do Drive não está configurada');
      const period = protocol.competenceYear && protocol.competenceMonth
        ? { year: protocol.competenceYear, month: protocol.competenceMonth }
        : { year: protocol.taskYear, month: protocol.taskMonth };
      const destination = await resolveDestination({ clientsRootId: firm.driveClientsFolderId, client: protocol.client, department: protocol.obligation.department, period, driveApi });
      await driveApi.moveFile(protocol.sourceDriveFileId, firm.driveConferenceFolderId, destination.folderId);
      updated = await db.protocolDocument.update({ where: { id: protocol.id }, data: { driveMovedAt: new Date(), driveDestination: destination.path }, include: protocolInclude });
    } catch (error) {
      warning = `E-mail enviado e tarefa baixada, mas o arquivo não foi movido no Drive: ${error.message}.`;
      updated = await db.protocolDocument.update({ where: { id: protocol.id }, data: { identificationNotes: [protocol.identificationNotes, warning].filter(Boolean).join('\n') }, include: protocolInclude });
    }
  }

  return { protocol: updated, warning };
}

module.exports = { syncFirm, syncAllFirms, approveAndSend, resolveDestination, buildEmail, splitEmails, problemsForApproval, _private: { findClientFolder, findDepartmentFolder } };
