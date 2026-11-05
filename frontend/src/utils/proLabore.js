export const RULE_YEAR = 2026;
export const FIRST_BAND_LIMIT = 180000;
export const INSS_CEILING = 8475.55;
export const MINIMUM_CONTRIBUTION = 1621;
export const ACTIVITIES = [
  { id: 'commerce', label: 'Comércio e revenda de mercadorias', annex: 'I', detail: 'Revenda comum, sem substituição tributária ou tributação monofásica.', keywords: 'loja varejo atacado vendas' },
  { id: 'industry', label: 'Indústria e fabricação', annex: 'II', detail: 'Produção própria com tributação integral pelo Anexo II.', keywords: 'fabrica fabricação manufatura' },
  { id: 'training', label: 'Treinamento profissional e gerencial', annex: 'III', cnae: '8599-6/04', detail: 'Cursos e treinamento; não inclui consultoria.', keywords: 'ensino cursos educação' },
  { id: 'accounting', label: 'Serviços contábeis com ISS no DAS', annex: 'III', cnae: '6920-6/01', detail: 'Somente quando o ISS é recolhido no DAS, não em valor fixo municipal.', keywords: 'contabilidade contador' },
  { id: 'software', label: 'Desenvolvimento de software sob encomenda', factorR: true, cnae: '6201-5/01', detail: 'Sujeito ao fator R; Anexo III ou V.', keywords: 'tecnologia programador programação sistemas TI' },
  { id: 'consulting', label: 'Consultoria em gestão empresarial', factorR: true, cnae: '7020-4/00', detail: 'Sujeita ao fator R; Anexo III ou V.', keywords: 'gestão negócios consultor' },
  { id: 'advertising', label: 'Agência de publicidade', factorR: true, cnae: '7311-4/00', detail: 'Serviços de publicidade sujeitos ao fator R.', keywords: 'marketing publicidade comunicação' },
  { id: 'medical', label: 'Consultas médicas', factorR: true, cnae: '8630-5/03', detail: 'Atendimento médico ambulatorial restrito a consultas.', keywords: 'médico medicina saúde clinica' },
  { id: 'psychology', label: 'Psicologia e psicanálise', factorR: true, cnae: '8650-0/03', detail: 'Serviços sujeitos ao fator R.', keywords: 'psicólogo psicologa terapia' },
  { id: 'engineering', label: 'Serviços de engenharia (sem execução de obras)', factorR: true, cnae: '7112-0/00', detail: 'Projetos e serviços técnicos; obras não estão nesta categoria.', keywords: 'engenheiro projeto técnico' },
  { id: 'law', label: 'Serviços advocatícios', annex: 'IV', cnae: '6911-7/01', detail: 'Anexo IV com contribuição patronal fora do DAS.', keywords: 'advocacia advogado jurídico' },
  { id: 'cleaning', label: 'Limpeza em prédios e domicílios', annex: 'IV', cnae: '8121-4/00', detail: 'Anexo IV com contribuição patronal fora do DAS.', keywords: 'limpeza conservação faxina' },
  { id: 'construction', label: 'Construção de edifícios (sem CPRB)', annex: 'IV', cnae: '4120-4/00', detail: 'Somente contribuição patronal normal sobre a folha; não calcula desoneração/CPRB.', keywords: 'obra construção civil empreitada' },
  { id: 'other', label: 'Outra atividade / enquadramento a confirmar', detail: 'O CNAE isolado não determina todas as regras. Confirme o enquadramento com a contabilidade.', keywords: 'outra não encontrada ISS fixo' },
];
export const TAX_SOURCES = [
  { label: 'IRPF mensal 2026 · Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026' },
  { label: 'Teto e salário mínimo · INSS', url: 'https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal' },
  { label: 'Retenção de 11% · Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/contribuicoes-previdenciarias-pf' },
  { label: 'Anexos do Simples · LC 155/2016', url: 'https://www2.camara.leg.br/legin/fed/leicom/2016/leicomplementar-155-27-outubro-2016-783850-anexo-pl.pdf' },
  { label: 'Atividades e fator R · Resolução CGSN 140, arts. 25 e 26', url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278' },
  { label: 'Contribuição patronal do Anexo IV · Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cobrancas-e-intimacoes/contribuicao-previdenciaria-anexo-iv-do-simples-nacional' },
];
export const ASSUMPTIONS = [
  'Estimativa mensal de 2026 para empresa optante pelo Simples, com 13 meses ou mais de atividade e RBT12 de até R$ 180.000,00.',
  'Toda a receita simulada pertence à atividade selecionada, com tributação integral. Não inclui ISS fixo, retenções, substituição tributária, monofásicos, exportações, CPRB ou atividades mistas.',
  'Um sócio residente no Brasil e uma única fonte pagadora, sem outros vínculos previdenciários ou rendimentos no mês. O ajuste anual do IRPF pode alterar o imposto final.',
  'O faturamento cobre somente o pró-labore bruto, o DAS e a contribuição patronal externa quando aplicável. Não inclui despesas operacionais, custo das mercadorias, folha de empregados, margem de lucro ou lucros distribuídos.',
  'INSS e IRRF do sócio já integram o pró-labore bruto; não são acrescentados novamente ao faturamento. O desconto simplificado do IR substitui, e não soma, as deduções legais.',
  'O fator R usa a folha com encargos e a receita dos 12 meses anteriores. A retirada simulada não modifica esse histórico nem determina sozinha o anexo.',
  'Não é guia de recolhimento nem enquadramento fiscal definitivo. Valide a atividade efetivamente exercida e os valores com sua contabilidade.',
];
const rates = { I: .04, II: .045, III: .06, IV: .045, V: .155 };
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
function money(value, label, minimum = 0, maximum = 10000000) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || Math.abs(value * 100 - Math.round(value * 100)) > .00001) throw new Error(`${label}: informe um valor válido com até duas casas decimais.`);
  return value;
}
export function calculateProLabore(input) {
  const gross = money(input.gross, 'Pró-labore bruto', .01);
  const pension = money(input.pension ?? 0, 'Pensão judicial');
  const dependents = input.dependents ?? 0;
  if (!Number.isInteger(dependents) || dependents < 0 || dependents > 99) throw new Error('Dependentes: informe um número inteiro de 0 a 99.');
  if (input.established !== true) throw new Error('Esta versão atende empresas com 13 meses ou mais. Empresas em início de atividade precisam de anualização específica.');
  if (input.ordinary !== true) throw new Error('Confirme a tributação integral da receita; regimes especiais precisam de análise específica.');
  const revenue12 = money(input.revenue12, 'Receita dos últimos 12 meses');
  if (revenue12 > FIRST_BAND_LIMIT) throw new Error('A receita dos últimos 12 meses ultrapassa R$ 180.000,00. Esta calculadora atende somente à primeira faixa.');
  const activity = ACTIVITIES.find(item => item.id === input.activityId);
  if (!activity || activity.id === 'other') throw new Error('Selecione uma atividade com enquadramento disponível. Para outra atividade, confirme o anexo com sua contabilidade.');
  let factorR = null;
  let meetsFactorR = false;
  if (activity.factorR) {
    const payroll12 = money(input.payroll12, 'Folha com encargos dos últimos 12 meses');
    factorR = revenue12 ? payroll12 / revenue12 : payroll12 > 0 ? .28 : .01;
    // Compare cents by cross multiplication: exact 28% must not depend on floating-point division.
    meetsFactorR = revenue12 ? Math.round(payroll12 * 100) * 100 >= Math.round(revenue12 * 100) * 28 : payroll12 > 0;
  }
  const annex = activity.factorR ? (meetsFactorR ? 'III' : 'V') : activity.annex;
  const rate = rates[annex];
  const inss = round(Math.min(gross, INSS_CEILING) * .11);
  if (pension > gross - inss) throw new Error('A pensão não pode superar o valor disponível após o INSS.');
  const legalDeduction = round(inss + dependents * 189.59 + pension);
  const deduction = Math.max(legalDeduction, 607.20);
  const baseIR = round(Math.max(0, gross - deduction));
  const bracket = baseIR <= 2428.80 ? [0, 0] : baseIR <= 2826.65 ? [.075, 182.16] : baseIR <= 3751.05 ? [.15, 394.16] : baseIR <= 4664.68 ? [.225, 675.49] : [.275, 908.73];
  const taxBeforeReduction = round(Math.max(0, baseIR * bracket[0] - bracket[1]));
  const reduction = round(Math.min(taxBeforeReduction, gross <= 5000 ? 312.89 : gross <= 7350 ? Math.max(0, 978.62 - .133145 * gross) : 0));
  const irrf = round(Math.max(0, taxBeforeReduction - reduction));
  const net = round(gross - inss - irrf - pension);
  const cpp = annex === 'IV' ? round(gross * .20) : 0;
  // Withholdings belong to gross. Only external company CPP is added before grossing up DAS.
  let cents = Math.ceil(((gross + cpp) / (1 - rate)) * 100 - .000001);
  let revenue = cents / 100;
  let das = round(revenue * rate);
  while (round(revenue - das - cpp) < gross) { revenue = ++cents / 100; das = round(revenue * rate); }
  const companyTaxes = round(das + cpp);
  const individualTaxes = round(inss + irrf);
  const totalTaxes = round(companyTaxes + individualTaxes);
  const warnings = [];
  if (gross < MINIMUM_CONTRIBUTION) warnings.push('O pró-labore está abaixo do salário mínimo de contribuição de 2026 (R$ 1.621,00). Eventual complementação previdenciária não está incluída no total.');
  if (revenue * 12 > FIRST_BAND_LIMIT) warnings.push('Mantido por 12 meses, o faturamento simulado ultrapassa R$ 180.000,00. A primeira faixa não se sustenta nesse cenário; esta é apenas a estimativa do mês com o histórico informado.');
  return { year: RULE_YEAR, activity, gross, dependents, pension, revenue12, payroll12: activity.factorR ? input.payroll12 : null, factorR, annex, rate, inss, baseIR, deduction, deductionMode: legalDeduction >= 607.20 ? 'legal' : 'simplified', taxBeforeReduction, reduction, irrf, net, cpp, revenue, das, companyTaxes, individualTaxes, totalTaxes, taxShare: totalTaxes / revenue, warnings };
}
