const cron = require('node-cron');
const prisma = require('../lib/prisma');
const ecacService = require('../services/ecac.service');

// Roda todo dia às 6h da manhã, verificando pendências de todos os
// clientes ativos de cada escritório que já tenha um certificado digital
// configurado (cada escritório tem o seu, guardado de forma criptografada).
function startEcacScheduler() {
  cron.schedule('0 6 * * *', async () => {
    const firmsWithCertificate = await prisma.accountingFirm.findMany({
      where: { certificatePfxEncrypted: { not: null } },
      select: { id: true },
    });
    const firmIds = firmsWithCertificate.map((firm) => firm.id);
    if (firmIds.length === 0) return;

    const clients = await prisma.client.findMany({ where: { active: true, accountingFirmId: { in: firmIds } } });
    for (const client of clients) {
      const check = await prisma.taxPendencyCheck.create({
        data: { accountingFirmId: client.accountingFirmId, clientId: client.id, status: 'EM_ANDAMENTO' },
      });
      try {
        const pendencies = await ecacService.runPendencyCheck(client);
        await prisma.taxPendencyCheck.update({
          where: { id: check.id },
          data: { status: 'SUCESSO', finishedAt: new Date(), pendencies: { create: pendencies } },
        });
      } catch (error) {
        await prisma.taxPendencyCheck.update({
          where: { id: check.id },
          data: { status: 'ERRO', finishedAt: new Date(), errorMessage: error.message },
        });
      }
    }
  });
}

module.exports = { startEcacScheduler };
