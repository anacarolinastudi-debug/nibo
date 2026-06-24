const prisma = require('../lib/prisma');
const ecacService = require('../services/ecac.service');

function firmWhere(req) {
  return { accountingFirmId: req.user.accountingFirmId };
}

function getStatus(req, res) {
  res.json({ configured: ecacService.isCertificateConfigured() });
}

async function listChecks(req, res) {
  const checks = await prisma.taxPendencyCheck.findMany({
    where: firmWhere(req),
    orderBy: { startedAt: 'desc' },
    include: { client: true, pendencies: true },
    take: 200,
  });
  res.json(checks);
}

async function getLatestByClient(req, res) {
  const clients = await prisma.client.findMany({ where: { ...firmWhere(req), active: true } });
  const latest = await Promise.all(
    clients.map(async (client) => {
      const check = await prisma.taxPendencyCheck.findFirst({
        where: { clientId: client.id, ...firmWhere(req) },
        orderBy: { startedAt: 'desc' },
        include: { pendencies: true },
      });
      return { client, check };
    })
  );
  res.json(latest);
}

async function runCheckForClient(req, res) {
  const client = await prisma.client.findFirst({ where: { id: req.params.clientId, ...firmWhere(req) } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });

  if (!ecacService.isCertificateConfigured()) {
    return res.status(400).json({ error: 'Certificado digital não configurado neste ambiente. Configure RECEITA_CERT_PFX_BASE64 e RECEITA_CERT_PASSPHRASE.' });
  }

  const check = await prisma.taxPendencyCheck.create({
    data: { accountingFirmId: req.user.accountingFirmId, clientId: client.id, status: 'EM_ANDAMENTO' },
  });

  res.status(202).json(check);

  try {
    const pendencies = await ecacService.runPendencyCheck(client);
    await prisma.taxPendencyCheck.update({
      where: { id: check.id },
      data: {
        status: 'SUCESSO',
        finishedAt: new Date(),
        pendencies: { create: pendencies },
      },
    });
  } catch (error) {
    await prisma.taxPendencyCheck.update({
      where: { id: check.id },
      data: { status: 'ERRO', finishedAt: new Date(), errorMessage: error.message },
    });
  }
}

module.exports = {
  getStatus,
  listChecks,
  getLatestByClient,
  runCheckForClient,
};
