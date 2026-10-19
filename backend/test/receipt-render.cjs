const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { logoDataUrl } = require('../src/utils/firmLogo');

async function main() {
  const output = path.resolve(__dirname, '../../tmp');
  const recovered = path.join(output, 'young-logo-recovered.png');
  const logo = logoDataUrl(fs.existsSync(recovered) ? fs.readFileSync(recovered) : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64'));
  fs.mkdirSync(output, { recursive: true });
  const fixture = {
    number: 'REC-2026-0001', amount: 500, description: 'HONORARIOS CONTABEIS',
    issueDate: '2026-10-19', dueDate: '2026-10-30', paymentDate: null,
    notes: 'Obrigado por fazer negócios conosco.\n\nTermos & Condições\nLembramos que o não pagamento dos serviços dentro do prazo estabelecido implicará na paralisação imediata dos mesmos. Essa medida é essencial para mantermos a saúde financeira da empresa e garantir a continuidade da prestação de serviços de qualidade.\n\nAgradecemos pela compreensão e colaboração.',
    accountingFirm: { id: 'firm', name: 'Young Contabil', logoUrl: logo, cnpj: '00000000000000', email: 'teste@example.com' },
    client: { name: 'Cliente de teste', cnpj: '00000000000000' }, transaction: { type: 'RECEITA' },
  };
  const prismaPath = require.resolve('../src/lib/prisma');
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { financialReceipt: { findFirst: async () => fixture } } };
  const realLaunch = chromium.launch.bind(chromium);
  chromium.launch = async (options) => {
    const browser = await realLaunch(options);
    const realNewPage = browser.newPage.bind(browser);
    browser.newPage = async () => {
      const page = await realNewPage({ viewport: { width: 794, height: 1123 } });
      const realPdf = page.pdf.bind(page);
      page.pdf = async (pdfOptions) => {
        assert.equal(await page.getByText('Pagamento', { exact: true }).count(), 0);
        const image = await page.locator('img.logo').evaluate((img) => ({ loaded: img.complete && img.naturalWidth > 0, source: img.getAttribute('src') }));
        assert.equal(image.loaded, true);
        assert.ok(image.source.startsWith('data:image/png;base64,'));
        await page.screenshot({ path: path.join(output, 'receipt-fixed.png'), fullPage: true });
        return realPdf(pdfOptions);
      };
      return page;
    };
    return browser;
  };
  const { receiptPdf } = require('../src/controllers/financial.controller');
  await receiptPdf({ params: { id: 'receipt' }, user: { role: 'ADMIN', accountingFirmId: 'firm' } }, {
    setHeader() {}, send(pdf) { assert.equal(pdf.subarray(0, 4).toString(), '%PDF'); fs.writeFileSync(path.join(output, 'receipt-fixed.pdf'), pdf); },
  });
  console.log('PASS: original logo loaded from database image, payment panel absent, PDF generated.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
