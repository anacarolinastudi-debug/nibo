// =====================================================================
// CÁLCULO SIMPLIFICADO DE FOLHA DE PAGAMENTO
// =====================================================================
// IMPORTANTE: as faixas de INSS e IRRF abaixo são ILUSTRATIVAS, baseadas
// nas tabelas de 2024/2025, só para o sistema funcionar de ponta a ponta.
// As tabelas oficiais mudam todo ano (e o INSS é corrigido pelo governo).
// Antes de usar isso com folha de pagamento real, um contador ou
// profissional de RH precisa validar e atualizar esses valores com a
// legislação vigente — isso NÃO substitui um sistema de folha homologado.
// =====================================================================

const INSS_BRACKETS = [
  { limit: 1412.00, rate: 0.075 },
  { limit: 2666.68, rate: 0.09 },
  { limit: 4000.03, rate: 0.12 },
  { limit: 7786.02, rate: 0.14 },
];

function calcInss(grossSalary) {
  let inss = 0;
  let previousLimit = 0;

  for (const bracket of INSS_BRACKETS) {
    if (grossSalary > previousLimit) {
      const taxableInBracket = Math.min(grossSalary, bracket.limit) - previousLimit;
      inss += taxableInBracket * bracket.rate;
    }
    previousLimit = bracket.limit;
  }

  // Acima do teto, não incide mais sobre o excedente
  return Math.round(inss * 100) / 100;
}

const IRRF_BRACKETS = [
  { limit: 2259.20, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 169.44 },
  { limit: 3751.05, rate: 0.15, deduction: 381.44 },
  { limit: 4664.68, rate: 0.225, deduction: 662.77 },
  { limit: Infinity, rate: 0.275, deduction: 896.00 },
];

function calcIrrf(baseCalculo) {
  const bracket = IRRF_BRACKETS.find((b) => baseCalculo <= b.limit) || IRRF_BRACKETS[IRRF_BRACKETS.length - 1];
  const irrf = baseCalculo * bracket.rate - bracket.deduction;
  return Math.max(0, Math.round(irrf * 100) / 100);
}

function calcFgts(grossSalary) {
  return Math.round(grossSalary * 0.08 * 100) / 100;
}

// Calcula a folha completa de um funcionário para um mês.
function calcPayroll({ grossSalary, otherBenefits = 0 }) {
  const inss = calcInss(grossSalary);
  const baseIrrf = grossSalary - inss;
  const irrf = calcIrrf(baseIrrf);
  const fgts = calcFgts(grossSalary); // FGTS é depositado pela empresa, não desconta do funcionário
  const netSalary = Math.round((grossSalary - inss - irrf + otherBenefits) * 100) / 100;

  return { inss, irrf, fgts, netSalary };
}

module.exports = { calcPayroll, calcInss, calcIrrf, calcFgts };
