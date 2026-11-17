const cron = require('node-cron');
const prisma = require('../lib/prisma');
const nfseAdn = require('../services/nfseAdn.service');

// Todo dia às 5h: busca as NFS-e novas de cada empresa que tem certificado
// cadastrado e válido. Uma empresa por vez, para não sobrecarregar a API.
function startNfseScheduler() {
  // Buscas que estavam rodando quando o servidor reiniciou foram interrompidas.
  prisma.clientNfseConfig.updateMany({
    where: { lastSyncStatus: 'EM_ANDAMENTO' },
    data: { lastSyncStatus: 'ERRO', lastSyncError: 'Busca interrompida porque o servidor reiniciou. Clique em Buscar agora.' },
  }).catch((error) => console.error('Falha ao liberar buscas de NFS-e interrompidas:', error.message));
  cron.schedule('0 5 * * *', async () => {
    const configs = await prisma.clientNfseConfig.findMany({
      where: {
        client: { active: true },
        OR: [{ certificateValidUntil: null }, { certificateValidUntil: { gt: new Date() } }],
      },
      select: { clientId: true },
    });
    for (const { clientId } of configs) {
      try {
        await nfseAdn.syncClient(clientId);
      } catch (error) {
        console.error(`Busca automática de NFS-e (${clientId}):`, error.message);
      }
    }
  }, { timezone: 'America/Cuiaba' });
}

module.exports = { startNfseScheduler };
