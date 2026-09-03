// =====================================================================
// Robô do Radar e-CAC — consulta pendências fiscais usando o certificado
// digital (e-CNPJ A1) do escritório, autenticando via procuração
// eletrônica para cada cliente.
//
// IMPORTANTE: os seletores e URLs abaixo são uma melhor estimativa com
// base na estrutura pública conhecida do gov.br/e-CAC. Eles PRECISAM
// ser validados e ajustados na primeira execução real, com o
// certificado de verdade — use `npm run ecac:debug` (ver final do
// arquivo) para rodar com o navegador visível e inspecionar cada
// etapa pelo DevTools antes de confiar no resultado em produção.
// =====================================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const certCrypto = require('../utils/certCrypto');

const GOVBR_LOGIN_URL = 'https://sso.acesso.gov.br/login?client_id=cav.receita.fazenda.gov.br';
const ECAC_HOME_URL = 'https://cav.receita.fazenda.gov.br/';

// O certificado é carregado por escritório (não por variável de ambiente):
// fica criptografado no banco e é decifrado em memória só no momento do uso.
async function isCertificateConfigured(accountingFirmId) {
  const firm = await prisma.accountingFirm.findUnique({
    where: { id: accountingFirmId },
    select: { certificatePfxEncrypted: true, certificatePassphraseEncrypted: true },
  });
  return Boolean(firm?.certificatePfxEncrypted && firm?.certificatePassphraseEncrypted);
}

async function loadCertificate(accountingFirmId) {
  const firm = await prisma.accountingFirm.findUnique({
    where: { id: accountingFirmId },
    select: { certificatePfxEncrypted: true, certificatePassphraseEncrypted: true },
  });
  if (!firm?.certificatePfxEncrypted || !firm?.certificatePassphraseEncrypted) {
    throw new Error('Certificado digital não configurado para este escritório. Faça o upload em Configurações > Escritório.');
  }
  return {
    pfx: certCrypto.decrypt(firm.certificatePfxEncrypted),
    passphrase: certCrypto.decrypt(firm.certificatePassphraseEncrypted).toString('utf8'),
  };
}

// Salva uma screenshot e o HTML da página no momento da falha, e devolve
// as URLs públicas (servidas em /uploads) para facilitar o diagnóstico
// remoto, sem precisar de acesso ao servidor.
async function withDebugArtifacts(page, label) {
  try {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'ecac-debug');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now();
    const screenshotFile = path.join(dir, `${label}-${stamp}.png`);
    const htmlFile = path.join(dir, `${label}-${stamp}.html`);
    await page.screenshot({ path: screenshotFile, fullPage: true });
    fs.writeFileSync(htmlFile, await page.content());
    return {
      screenshotUrl: `/uploads/ecac-debug/${label}-${stamp}.png`,
      htmlUrl: `/uploads/ecac-debug/${label}-${stamp}.html`,
      currentUrl: page.url(),
    };
  } catch {
    // Captura de tela é só para depuração; nunca deve derrubar o robô.
    return null;
  }
}

// Faz login no gov.br com o certificado digital e retorna o contexto
// autenticado do e-CAC, pronto para selecionar o outorgante (cliente).
async function loginWithCertificate(browser, accountingFirmId) {
  const cert = await loadCertificate(accountingFirmId);
  const context = await browser.newContext({
    clientCertificates: [
      { origin: 'https://sso.acesso.gov.br', pfx: cert.pfx, passphrase: cert.passphrase },
      { origin: 'https://cav.receita.fazenda.gov.br', pfx: cert.pfx, passphrase: cert.passphrase },
    ],
  });
  const page = await context.newPage();

  await page.goto(GOVBR_LOGIN_URL, { waitUntil: 'domcontentloaded' });

  // TODO: validar o texto/seletor exato do botão "Entrar com certificado digital".
  const certButton = page.getByText('certificado digital', { exact: false });
  if (await certButton.count()) {
    await certButton.first().click();
  }

  await page.waitForURL(/cav\.receita\.fazenda\.gov\.br/, { timeout: 30000 }).catch(async () => {
    const debug = await withDebugArtifacts(page, 'login-timeout');
    throw new Error(`Não foi possível confirmar o login no e-CAC (timeout aguardando redirecionamento).${debug ? ` URL atual: ${debug.currentUrl} | screenshot: ${debug.screenshotUrl} | html: ${debug.htmlUrl}` : ''}`);
  });

  return { context, page };
}

// Troca o contexto de atendimento para o CNPJ do cliente, usando a
// procuração eletrônica já outorgada ao escritório.
async function selectOutorgante(page, clientCnpj) {
  const digits = clientCnpj.replace(/\D/g, '');

  // TODO: confirmar a rota/seletor reais da troca de procurador no e-CAC
  // (geralmente em "Procurações" ou no seletor de perfil no topo da página).
  await page.goto(`${ECAC_HOME_URL}#/procuracoes`, { waitUntil: 'domcontentloaded' }).catch(() => {});

  // A página costuma exibir o CNPJ formatado (com pontos/barra), por isso
  // comparamos só os dígitos em vez de buscar o texto exato.
  const marker = 'data-ecac-match';
  const found = await page.evaluate(
    ({ targetDigits, markerAttr }) => {
      const candidates = Array.from(document.querySelectorAll('body *')).filter((el) => {
        if (el.children.length > 0) return false;
        const text = (el.textContent || '').replace(/\D/g, '');
        return text && text.includes(targetDigits);
      });
      if (candidates.length === 0) return false;

      let target = candidates[0];
      let depth = 0;
      while (target && depth < 6 && !['BUTTON', 'A', 'LI', 'TR'].includes(target.tagName) && target.parentElement) {
        target = target.parentElement;
        depth += 1;
      }
      target.setAttribute(markerAttr, 'true');
      return true;
    },
    { targetDigits: digits, markerAttr: marker }
  );

  if (!found) {
    const debug = await withDebugArtifacts(page, `outorgante-nao-encontrado-${digits}`);
    throw new Error(`CNPJ ${clientCnpj} não encontrado na lista de procurações. Confirme se a procuração eletrônica está ativa.${debug ? ` URL atual: ${debug.currentUrl} | screenshot: ${debug.screenshotUrl} | html: ${debug.htmlUrl}` : ''}`);
  }

  await page.locator(`[${marker}]`).first().click();
}

// Abre a área de Situação Fiscal / Pendências e extrai os itens da tabela.
async function scrapePendencies(page) {
  // TODO: ajustar a URL real do serviço "Situação Fiscal" / pendências.
  await page.goto(`${ECAC_HOME_URL}#/situacao-fiscal`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('table', { timeout: 15000 }).catch(async () => {
    await withDebugArtifacts(page, 'pendencias-tabela-nao-encontrada');
  });

  const rows = await page.$$eval('table tbody tr', (trs) =>
    trs.map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
      return {
        type: cells[0] || 'Pendência',
        description: cells[1] || cells[0] || '',
        amount: cells[2] || null,
        situation: cells[3] || null,
      };
    })
  ).catch(() => []);

  return rows.filter((row) => row.description);
}

function parseAmount(value) {
  if (!value) return null;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// Função principal: roda a checagem de pendências para um único cliente.
// Retorna a lista de pendências encontradas (já no formato do banco).
async function runPendencyCheck(client) {
  const configured = await isCertificateConfigured(client.accountingFirmId);
  if (!configured) {
    throw new Error('Certificado digital não configurado para este escritório.');
  }

  // --no-sandbox e --disable-dev-shm-usage evitam falhas comuns do Chromium
  // em containers com pouca memória/sem /dev/shm grande, como o Render free.
  const browser = await chromium.launch({
    headless: process.env.ECAC_HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const { context, page } = await loginWithCertificate(browser, client.accountingFirmId);
    try {
      await selectOutorgante(page, client.cnpj);
      const rows = await scrapePendencies(page);
      return rows.map((row) => ({
        type: row.type,
        description: row.description,
        amount: parseAmount(row.amount),
        situation: row.situation,
      }));
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

module.exports = {
  isCertificateConfigured,
  runPendencyCheck,
};
