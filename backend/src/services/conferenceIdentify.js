// Identificação automática de documentos da Conferência a partir do texto do PDF:
// cliente (CNPJ/CPF ou nome), obrigação (tipo de guia), competência, vencimento e valor.
// Funções puras: recebem o texto e as listas do banco, não acessam nada externo.

const MONTHS = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

// Expressões conhecidas das guias e documentos mais comuns, por apelido da obrigação.
// Cada escritório pode complementar em Configurações > Robôs (identificadores).
const KNOWN_DOCUMENTS = {
  DASMEI: ['simei', 'das mei', 'pgmei', 'microempreendedor individual'],
  DAS: ['documento de arrecadacao do simples nacional', 'das - simples nacional'],
  PGDAS: ['pgdas-d', 'extrato do simples nacional', 'declaracao do simples nacional'],
  PARCSN: ['parcelamento do simples nacional', 'parcelamento simples nacional'],
  DCTFWEB: ['dctfweb'],
  DCTFPREV: ['dctfweb'],
  DARFPREV: ['contribuicao previdenciaria', 'contribuicoes previdenciarias'],
  FGTS: ['guia do fgts digital', 'fgts digital', 'gfd -', 'guia do fgts'],
  FGTSRESC: ['fgts rescisorio', 'rescisorio'],
  DAE: ['documento de arrecadacao do esocial', 'dae esocial'],
  IRRF: ['imposto de renda retido na fonte', 'irrf'],
  PCC: ['csrf', 'pis/cofins/csll'],
  ISS: ['issqn', 'imposto sobre servicos'],
  ICMS: ['icms'],
  GNRE: ['gnre', 'guia nacional de recolhimento de tributos estaduais'],
  FOLHA: ['folha de pagamento', 'recibo de pagamento de salario', 'holerite', 'demonstrativo de pagamento'],
  PROLABORE: ['pro-labore', 'pro labore', 'prolabore'],
  FERIAS: ['recibo de ferias', 'aviso de ferias'],
  '13P1': ['13o salario - 1a parcela', 'primeira parcela do 13', '1a parcela 13'],
  '13P2': ['13o salario - 2a parcela', 'segunda parcela do 13', '2a parcela 13'],
  INFORME: ['informe de rendimentos', 'comprovante de rendimentos'],
  BAL: ['balancete'],
  DRE: ['demonstracao do resultado', 'dre'],
  CNDFED: ['certidao negativa de debitos relativos aos tributos federais', 'certidao positiva com efeitos de negativa'],
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[º°]/g, 'o')
    .replace(/ª/g, 'a')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function findTaxIds(text) {
  const matches = String(text || '').match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || [];
  return Array.from(new Set(matches.map(onlyDigits).filter((d) => d.length === 14 || d.length === 11)));
}

// Devolve { client, method, notes } — notes explica quando há dúvida.
function identifyClient(text, clients, { firmTaxId } = {}) {
  const firmDigits = onlyDigits(firmTaxId);
  const ids = findTaxIds(text).filter((id) => id !== firmDigits);
  const byId = clients.filter((client) => {
    const digits = onlyDigits(client.cnpj);
    return (digits.length === 14 || digits.length === 11) && ids.includes(digits);
  });
  if (byId.length === 1) return { client: byId[0], method: 'CNPJ/CPF', notes: [] };
  if (byId.length > 1) return { client: null, method: null, notes: [`Mais de um cliente encontrado pelo CNPJ/CPF: ${byId.map((c) => c.name).join(', ')}.`] };

  const normalizedText = normalize(text);
  const byName = clients.filter((client) => {
    const name = normalize(client.name).replace(/^\d[\d.]*\s+/, '');
    return name.length >= 8 && name.split(' ').length >= 2 && normalizedText.includes(name);
  });
  if (byName.length === 1) return { client: byName[0], method: 'nome', notes: ['Cliente identificado pelo nome (sem CNPJ/CPF no documento). Confira.'] };
  if (byName.length > 1) return { client: null, method: null, notes: [`Mais de um cliente encontrado pelo nome: ${byName.map((c) => c.name).join(', ')}.`] };
  return { client: null, method: null, notes: ['Cliente não identificado: nenhum CNPJ/CPF ou nome de cliente cadastrado foi encontrado no documento.'] };
}

const MEI_MARKERS = KNOWN_DOCUMENTS.DASMEI;

function scoreObligation(obligation, normalizedText, robots, linkedIds) {
  // O DAS do MEI também traz "Documento de Arrecadação do Simples Nacional":
  // com marcas de MEI no texto, o DAS comum não conta.
  const nickname = String(obligation.nickname || '').toUpperCase();
  const skipKnown = nickname === 'DAS' && MEI_MARKERS.some((marker) => normalizedText.includes(marker));
  let best = 0;
  let reason = null;
  for (const robot of robots.filter((r) => r.active !== false && r.obligationId === obligation.id)) {
    for (const identifier of robot.identifiers || []) {
      const key = normalize(identifier);
      if (key && normalizedText.includes(key) && 100 + key.length > best) { best = 100 + key.length; reason = `identificador "${identifier}"`; }
    }
  }
  for (const phrase of skipKnown ? [] : KNOWN_DOCUMENTS[nickname] || []) {
    const key = normalize(phrase);
    if (normalizedText.includes(key) && 50 + key.length > best) { best = 50 + key.length; reason = `texto "${phrase}"`; }
  }
  const name = normalize(obligation.name);
  if (name.length >= 6 && normalizedText.includes(name) && 40 + name.length > best) { best = 40 + name.length; reason = `nome "${obligation.name}"`; }
  if (best && linkedIds.has(obligation.id)) best += 20;
  return { score: best, reason };
}

// Escolhe a obrigação mais provável. Prefere as obrigações vinculadas ao cliente.
function identifyObligation(text, obligations, { robots = [], linkedObligationIds = [] } = {}) {
  const normalizedText = normalize(text);
  const linkedIds = new Set(linkedObligationIds);
  const ranked = obligations
    .map((obligation) => ({ obligation, ...scoreObligation(obligation, normalizedText, robots, linkedIds) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { obligation: null, notes: ['Obrigação não identificada: o tipo de documento não foi reconhecido.'] };
  const [first, second] = ranked;
  if (second && second.score === first.score) {
    return { obligation: null, notes: [`Obrigação ambígua: ${first.obligation.name} ou ${second.obligation.name}.`] };
  }
  const notes = [];
  if (linkedIds.size && !linkedIds.has(first.obligation.id)) notes.push(`A obrigação ${first.obligation.name} não está vinculada a este cliente.`);
  return { obligation: first.obligation, reason: first.reason, notes };
}

function validMonth(month, year) {
  return month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
}

function findCompetence(text) {
  const t = normalize(text);
  const label = '(?:periodo de apuracao|competencia|mes de referencia|referencia|mes/ano|periodo)';
  // Em guias como o DAS, o rótulo e o valor ficam em linhas/colunas diferentes.
  const byName = t.match(new RegExp(`${label}[^0-9]{0,80}?\\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[\\s/.-]*(?:de\\s+)?(\\d{4})`));
  if (byName && validMonth(MONTHS[byName[1]], Number(byName[2]))) return { month: MONTHS[byName[1]], year: Number(byName[2]) };
  const byDate = t.match(new RegExp(`${label}[^0-9]{0,40}(?:(\\d{2})/)?(\\d{2})/(\\d{4})`));
  if (byDate && validMonth(Number(byDate[2]), Number(byDate[3]))) return { month: Number(byDate[2]), year: Number(byDate[3]) };
  return null;
}

function findDueDate(text) {
  const t = normalize(text);
  const match = t.match(/(?:data de vencimento|vencimento|pagar este documento ate|pagar ate|pagavel ate|valido para pagamento ate)[^0-9]{0,60}(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!validMonth(month, year) || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function findTotalValue(text) {
  const t = normalize(text);
  const match = t.match(/(?:valor total do documento|valor total|valor a recolher|total a recolher|valor a pagar|total a pagar|valor do documento|valor liquido)[^0-9]{0,60}(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (!match) return null;
  return Number(match[1].replace(/\./g, '').replace(',', '.'));
}

// Mês da tarefa no calendário: o do vencimento; sem vencimento, o mês seguinte
// à competência (regra das obrigações mensais).
function taskPeriod({ dueDate, competence, frequency }) {
  if (dueDate) return { year: dueDate.getUTCFullYear(), month: dueDate.getUTCMonth() + 1 };
  if (!competence) return null;
  if (frequency && frequency !== 'MONTHLY') return { ...competence };
  const next = new Date(Date.UTC(competence.year, competence.month, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
}

function identifyDocument(text, { clients, obligations, robots = [], links = [], firmTaxId } = {}) {
  const notes = [];
  const clientResult = identifyClient(text, clients, { firmTaxId });
  notes.push(...clientResult.notes);
  const linkedObligationIds = clientResult.client
    ? links.filter((link) => link.clientId === clientResult.client.id && link.active !== false).map((link) => link.obligationId)
    : [];
  const obligationResult = identifyObligation(text, obligations, { robots, linkedObligationIds });
  notes.push(...obligationResult.notes);
  const competence = findCompetence(text);
  if (!competence) notes.push('Competência não encontrada no documento.');
  const dueDate = findDueDate(text);
  const totalValue = findTotalValue(text);
  const period = taskPeriod({ dueDate, competence, frequency: obligationResult.obligation?.frequency });
  if (!String(text || '').trim()) notes.unshift('O PDF não tem texto legível (pode ser imagem escaneada). Identifique manualmente.');
  return {
    client: clientResult.client,
    clientMethod: clientResult.method,
    obligation: obligationResult.obligation,
    obligationReason: obligationResult.reason || null,
    competence,
    dueDate,
    totalValue,
    taskPeriod: period,
    notes,
  };
}

// Converte "MM/AAAA" (digitado na Conferência) em competência e mês da tarefa.
function periodsFromReference(reference, { dueDate, frequency } = {}) {
  const match = String(reference || '').trim().match(/^(\d{1,2})[/.-](\d{4})$/);
  const competence = match && validMonth(Number(match[1]), Number(match[2])) ? { month: Number(match[1]), year: Number(match[2]) } : null;
  const due = dueDate ? new Date(dueDate) : null;
  return { competence, taskPeriod: taskPeriod({ dueDate: due && !Number.isNaN(due.getTime()) ? due : null, competence, frequency }) };
}

function formatCompetence(competence) {
  return competence ? `${String(competence.month).padStart(2, '0')}/${competence.year}` : null;
}

module.exports = {
  identifyDocument,
  identifyClient,
  identifyObligation,
  findCompetence,
  findDueDate,
  findTotalValue,
  findTaxIds,
  taskPeriod,
  formatCompetence,
  periodsFromReference,
  normalize,
  KNOWN_DOCUMENTS,
};
