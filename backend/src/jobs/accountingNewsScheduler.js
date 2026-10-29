const cron = require('node-cron');
const { requestSync } = require('../services/accountingNews.service');
function startAccountingNewsScheduler() {
  const update = () => requestSync({ daily: true }).catch(() => console.error('Nao foi possivel iniciar a coleta contabil.'));
  cron.schedule('0,30 * * * *', update, { timezone: 'America/Cuiaba' });
  update();
}
module.exports = { startAccountingNewsScheduler };
