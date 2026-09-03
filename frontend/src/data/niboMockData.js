export const company = {
  document: '52.107.544',
  name: 'ANA CAROLINA CARPINE AGUIAR',
};

export const calendarEvents = [
  { day: 2, counts: [{ value: 4, color: 'lateDone' }] },
  { day: 5, counts: [{ value: 16, color: 'lateDone' }, { value: 6, color: 'done' }] },
  { day: 10, counts: [{ value: 1, color: 'lateOpen' }] },
  { day: 11, counts: [{ value: 1, color: 'lateDone' }] },
  { day: 17, counts: [{ value: 3, color: 'due' }, { value: 54, color: 'done' }] },
  { day: 18, counts: [{ value: 3, color: 'today' }] },
  { day: 23, counts: [{ value: 1, color: 'lateOpen' }, { value: 3, color: 'done' }] },
  { day: 24, counts: [{ value: 3, color: 'due' }] },
  { day: 25, counts: [{ value: 33, color: 'due' }] },
];

export const internalGoals = [
  'DAS - Documento de Arrecadacao do Simples Nacional',
  'PGDAS - Declaracao Original',
  'PGDAS - Recibo de Entrega da Apuracao',
];

export const agenda = [
  {
    date: 'HOJE, 18/06/2026',
    done: '0/3',
    items: [
      { qty: 2, label: 'DAS Mei do Parcelamento PARCMEI', color: 'today' },
      { qty: 1, label: 'DAS do Parcelamento PARCSN', color: 'today' },
    ],
  },
  {
    date: 'TER, 23/06/2026',
    done: '0/3',
    items: [{ qty: 3, label: 'DeSTDA SIMPLES NACIONAL', color: 'due' }],
  },
  {
    date: 'QUI, 25/06/2026',
    done: '0/33',
    items: [
      { qty: 15, label: 'BALANCETE DE VERIFICACAO', color: 'due' },
      { qty: 1, label: 'ICMS SUBSTITUICAO TRIBUTARIA A PAGAR', color: 'due' },
      { qty: 15, label: 'NOTAS FISCAIS DE ENTRADA', color: 'due' },
      { qty: 2, label: 'NOTAS FISCAIS SAIDA E SERVICO (DIA 30)', color: 'due' },
    ],
  },
];

export const protocols = [
  ['ARQUIVOS XML NFE', '21 - 28.313.581 IVANI SEVERINA SOARES DE ALMEIDA', '05/2026', '10/06/2026', '', 'Baixa justificada'],
  ['DAS - Documento de Arrecadacao do Simples Nacional', '21 - 28.313.581 IVANI SEVERINA SOARES DE ALMEIDA', '05/2026', '22/06/2026', '', 'Baixa justificada'],
  ['PGDAS - Declaracao Original', '21 - 28.313.581 IVANI SEVERINA SOARES DE ALMEIDA', '05/2026', '22/06/2026', '', 'Aguardando entrega fisica'],
  ['PGDAS - Recibo de Entrega da Apuracao', '21 - 28.313.581 IVANI SEVERINA SOARES DE ALMEIDA', '05/2026', '22/06/2026', '', 'Aguardando entrega fisica'],
  ['DAS - Documento de Arrecadacao do Simples Nacional', 'ANA CAROLINA CARPINE AGUIAR', '05/2026', '22/06/2026', '', 'Baixa justificada'],
  ['PGDAS - Declaracao Original', 'ANA CAROLINA CARPINE AGUIAR', '05/2026', '22/06/2026', '', 'Baixa justificada'],
];

export const obligations = [
  ['13o SALARIO 1a PARCELA', 'Pagamento', 'Departamento Pessoal', '13SL1P', 'Anual', 'Ativo', 'Nao'],
  ['13o SALARIO 2a PARCELA', 'Pagamento', 'Departamento Pessoal', '13SL2P', 'Anual', 'Ativo', 'Nao'],
  ['ADIANTAMENTO SALARIAL (Vencimento dia 15)', 'Pagamento', 'Departamento Pessoal', 'ADSA15', 'Mensal', 'Ativo', 'Sim'],
  ['ALVARA CORPO DE BOMBEIRO', 'Cadastral', 'Departamento de Registro', 'AB', '', 'Ativo', 'Nao'],
  ['ALVARA CUIABA', 'Pagamento', 'Departamento de Registro', 'ALVCBA', 'Anual', 'Ativo', 'Nao'],
  ['ALVARA DE LOCALIZACAO E FUNCIONAMENTO', 'Cadastral', 'Departamento de Registro', 'AF', '', 'Ativo', 'Nao'],
  ['ALVARA SANITARIO', 'Cadastral', 'Departamento de Registro', 'AS', '', 'Ativo', 'Nao'],
];

export const departmentStats = [
  { title: 'Departamento Pessoal', open: 1, done: 26, percent: '85%', accent: '#91d9a7' },
  { title: 'Departamento Contabil', open: 15, done: 0, percent: '100%', accent: '#c9ccca' },
  { title: 'Departamento Fiscal', open: 28, done: 41, percent: '53%', accent: '#91d9a7' },
];
