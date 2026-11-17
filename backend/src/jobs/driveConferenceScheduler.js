const cron = require('node-cron');
const { syncAllFirms } = require('../services/driveConference.service');

// A cada 15 minutos busca PDFs novos na pasta de Conferência do Drive de cada escritório.
// No plano gratuito do Render o servidor dorme sem uso; por isso a tela de Conferência
// também dispara a busca ao ser aberta.
function startDriveConferenceScheduler() {
  cron.schedule('*/15 * * * *', () => {
    syncAllFirms().catch((error) => console.error('Falha na busca automática do Drive:', error.message));
  });
}

module.exports = { startDriveConferenceScheduler };
