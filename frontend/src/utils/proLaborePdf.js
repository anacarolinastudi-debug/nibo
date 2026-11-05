import { ASSUMPTIONS, TAX_SOURCES } from './proLabore';

export async function createProLaborePdf(result) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
  let page, y;
  const nextPage = () => { page = pdf.addPage([595.28, 841.89]); y = 790; };
  const line = (text, size = 11, strong = false) => {
    const font = strong ? bold : regular;
    const rows = []; let row = '';
    for (const word of text.split(/\s+/)) {
      if (row && font.widthOfTextAtSize(`${row} ${word}`, size) > 495) { rows.push(row); row = ''; }
      for (const char of (row ? ' ' : '') + word) {
        if (font.widthOfTextAtSize(row + char, size) > 495) { rows.push(row); row = ''; }
        row += char;
      }
    }
    rows.push(row);
    for (const value of rows) {
      if (y < 55) nextPage();
      page.drawText(value, { x: 50, y, size, font, color: rgb(.07, .13, .20) }); y -= size * 1.5;
    }
    y -= 5;
  };
  nextPage();
  line('Young Contábil', 20, true);
  line(`Simulação de pró-labore | regras de ${result.year}`, 16, true);
  line(`Emitida em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })}. Valores mensais estimados.`);
  line(result.activity.label, 12, true);
  line(`Anexo ${result.annex} | DAS ${(result.rate * 100).toLocaleString('pt-BR')}% | RBT12 ${money(result.revenue12)}`);
  if (result.factorR !== null) line(`Folha histórica: ${money(result.payroll12)} | Fator R: ${(result.factorR * 100).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}%`);
  const rows = [
    ['Pró-labore bruto', result.gross], ['INSS do sócio (11%, limitado ao teto)', result.inss], ['IRRF', result.irrf], ['TOTAL DE IMPOSTOS DO SÓCIO (INSS + IRRF)', result.individualTaxes], ['Pensão judicial', result.pension], ['Líquido recebido pelo sócio', result.net],
    ['DAS sobre o faturamento estimado', result.das], ['CPP fora do DAS (Anexo IV)', result.cpp], ['Tributos da empresa', result.companyTaxes],
    ['TOTAL DE TRIBUTOS (sócio + empresa)', result.totalTaxes], ['FATURAMENTO MÍNIMO ESTIMADO', result.revenue],
  ];
  for (const [label, value] of rows) line(`${label}: ${money(value)}`, 11, /TOTAL|FATURAMENTO|Líquido/.test(label));
  line(`IRRF: base ${money(result.baseIR)}; dedução ${money(result.deduction)} (${result.deductionMode === 'legal' ? 'legal' : 'simplificada'}); imposto antes da redução ${money(result.taxBeforeReduction)}; redução ${money(result.reduction)}.`);
  line(`Dependentes: ${result.dependents}. O pró-labore bruto já inclui INSS e IRRF retidos. Não somar esses descontos novamente ao faturamento.`);
  for (const warning of result.warnings) line(`ATENÇÃO: ${warning}`, 10, true);
  nextPage();
  line('Premissas e limites da estimativa', 16, true);
  for (const note of ASSUMPTIONS) line(`- ${note}`, 10);
  line('Fontes oficiais | consulta em 05/11/2026', 13, true);
  for (const source of TAX_SOURCES) { line(source.label, 10, true); line(source.url, 8); }
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
