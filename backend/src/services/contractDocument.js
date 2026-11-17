// Contrato de prestação de serviços contábeis, a partir do modelo do escritório
// ("CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS"), com os serviços escolhidos,
// os dados públicos do contratante (Receita) e os dados do escritório.

const SERVICES = [
  {
    key: 'CONTABIL',
    label: 'Departamento Contábil',
    clause: 'DEPARTAMENTO CONTÁBIL: escrituração contábil mensal, conciliação das contas com base nos extratos e documentos enviados, elaboração de balancetes quando solicitados, Balanço Patrimonial e Demonstração do Resultado do Exercício anuais, e transmissão da ECD e da ECF, quando obrigatórias.',
  },
  {
    key: 'FISCAL',
    label: 'Departamento Fiscal',
    clause: 'DEPARTAMENTO FISCAL: escrituração das notas fiscais de entrada e de saída (NF-e e NFS-e), apuração dos impostos mensais e emissão das respectivas guias, e entrega das obrigações acessórias fiscais do regime tributário da CONTRATANTE (como PGDAS-D e DEFIS no Simples Nacional, ou DCTFWeb e EFD-Contribuições nos demais regimes).',
  },
  {
    key: 'PESSOAL',
    label: 'Departamento Pessoal (com empregados)',
    clause: 'DEPARTAMENTO PESSOAL: folha de pagamento mensal, pró-labore, admissões e rescisões, férias, 13º salário, envio dos eventos ao eSocial, apuração do FGTS Digital e da DCTFWeb, e emissão das respectivas guias.',
  },
  {
    key: 'PESSOAL_SEM_MOVIMENTO',
    label: 'Departamento Pessoal (só pró-labore / sem movimento)',
    clause: 'DEPARTAMENTO PESSOAL: declarações mensais sem movimento ou somente de pró-labore, atualização do pró-labore quando necessário, envio dos eventos ao eSocial e da DCTFWeb, e declarações anuais acessórias.',
  },
  {
    key: 'MEI',
    label: 'MEI (DAS-MEI e DASN-SIMEI)',
    clause: 'MICROEMPREENDEDOR INDIVIDUAL: emissão mensal do DAS-MEI, acompanhamento do limite de faturamento e entrega da Declaração Anual do MEI (DASN-SIMEI).',
  },
  {
    key: 'IRPF',
    label: 'IRPF dos sócios',
    clause: 'IMPOSTO DE RENDA PESSOA FÍSICA: Declaração de Ajuste Anual do Imposto de Renda Pessoa Física (IRPF) do(s) sócio(s), que não será cobrada separadamente, estando incluída no valor dos honorários mensais.',
  },
  {
    key: 'PLANEJAMENTO',
    label: 'Planejamento tributário anual',
    clause: 'PLANEJAMENTO TRIBUTÁRIO: análise anual do enquadramento tributário mais vantajoso para a CONTRATANTE, com base no faturamento e na estrutura de custos informados.',
  },
  {
    key: 'CONSULTORIA',
    label: 'Consultoria e atendimento',
    clause: 'CONSULTORIA: orientação contábil, fiscal e trabalhista sobre as rotinas da CONTRATANTE, por e-mail, WhatsApp ou reunião agendada.',
  },
];

const SERVICE_KEYS = new Set(SERVICES.map((item) => item.key));

// ---------- valor por extenso ----------
const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto < 20) { if (resto) partes.push(UNIDADES[resto]); } else {
    partes.push(DEZENAS[Math.floor(resto / 10)] + (resto % 10 ? ` e ${UNIDADES[resto % 10]}` : ''));
  }
  return partes.join(' e ');
}

function inteiroPorExtenso(n) {
  if (n === 0) return 'zero';
  const grupos = [];
  let x = n;
  while (x > 0) { grupos.push(x % 1000); x = Math.floor(x / 1000); }
  const nomes = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
  const partes = [];
  for (let i = grupos.length - 1; i >= 0; i -= 1) {
    const g = grupos[i];
    if (!g) continue;
    let texto = i === 1 && g === 1 ? 'mil' : ate999(g);
    if (i >= 1 && !(i === 1 && g === 1)) texto += ` ${g === 1 ? nomes[i][0] : nomes[i][1]}`;
    partes.push({ texto, g });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda
  return partes.map((p, idx) => {
    const ultimo = idx === partes.length - 1 && partes.length > 1;
    return (ultimo && (p.g < 100 || p.g % 100 === 0) ? 'e ' : '') + p.texto;
  }).join(' ').replace(/ e e /g, ' e ');
}

function valorPorExtenso(valor) {
  const centavosTotal = Math.round(Number(valor) * 100);
  const reais = Math.floor(centavosTotal / 100);
  const centavos = centavosTotal % 100;
  const partes = [];
  if (reais) {
    const milhoesRedondos = reais >= 1000000 && reais % 1000000 === 0;
    partes.push(`${inteiroPorExtenso(reais)}${milhoesRedondos ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.join(' e ') || 'zero reais';
}

// ---------- documento ----------
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateBr = (date) => new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const dataPorExtenso = (date) => { const d = new Date(date); return `${String(d.getUTCDate()).padStart(2, '0')} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
const letra = (i) => String.fromCharCode(97 + i);

function defaultSettings(firm) {
  return {
    representanteNome: '',
    representanteQualificacao: 'brasileira, contadora',
    representanteCpf: '',
    crc: firm?.crc || '',
    crcUf: firm?.state || '',
    cidadeAssinatura: firm?.city || '',
    ufAssinatura: firm?.state || '',
    foro: firm?.city || '',
    diasPagamento: '01 a 05 ou 10',
    prazoDocumentos: '02 (dois)',
    honorarioAnual: false,
    avisoPrevioDias: 30,
  };
}

function contractHtml({ contract, firm, settings }) {
  const s = { ...defaultSettings(firm), ...(settings || {}) };
  const c = contract.contratante || {};
  const servicos = SERVICES.filter((item) => contract.services.includes(item.key));
  const firmEndereco = [firm.street && `${firm.street}${firm.number ? `, ${firm.number}` : ''}`, firm.neighborhood, firm.city && `${firm.city}${firm.state ? ` - ${firm.state}` : ''}`].filter(Boolean).join(', ');
  const contratanteEndereco = [c.logradouro && `${c.logradouro}${c.numero ? `, ${c.numero}` : ''}`, c.complemento, c.bairro, c.cidade && `${c.cidade}${c.uf ? ` - ${c.uf}` : ''}`, c.cep && `CEP ${c.cep}`].filter(Boolean).join(', ');
  const representante = c.representanteNome
    ? `, neste ato representada por ${esc(c.representanteNome)}${c.representanteQualificacao ? `, ${esc(c.representanteQualificacao)}` : ''}${c.representanteCpf ? `, inscrito(a) no CPF sob nº ${esc(c.representanteCpf)}` : ''}`
    : '';
  const valor = Number(contract.monthlyFee);
  let clausula = 0;
  const ORD = ['PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA', 'DÉCIMA PRIMEIRA', 'DÉCIMA SEGUNDA'];
  const titulo = (texto) => `<h2>CLÁUSULA ${ORD[clausula++]}: ${texto}</h2>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 22mm 20mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5pt; line-height: 1.5; color: #222; text-align: justify; }
    h1 { text-align: center; font-size: 14pt; margin: 0 0 18px; letter-spacing: .5px; }
    h2 { font-size: 11.5pt; margin: 18px 0 6px; }
    p { margin: 6px 0; }
    ul { margin: 4px 0 4px 18px; padding: 0; }
    li { margin: 4px 0; }
    .assinaturas { margin-top: 36px; page-break-inside: avoid; }
    .assinatura { margin-top: 46px; width: 62%; }
    .linha { border-top: 1px solid #333; padding-top: 4px; }
    .testemunhas { display: flex; gap: 40px; margin-top: 46px; }
    .testemunhas div { flex: 1; }
    .centro { text-align: center; }
  </style></head><body>
  <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS</h1>
  <p><b>${esc(c.razaoSocial)}</b>, inscrita no CNPJ sob nº ${esc(c.cnpj)}, com sede em ${esc(contratanteEndereco)}${representante}, doravante denominada <b>CONTRATANTE</b>.</p>
  <p><b>${esc(firm.name)}</b>, inscrita no CNPJ sob nº ${esc(firm.cnpj)}, com sede em ${esc(firmEndereco)}, neste ato representada por ${esc(s.representanteNome)}${s.representanteQualificacao ? `, ${esc(s.representanteQualificacao)}` : ''}${s.crc ? `, ${esc(s.crc)}` : ''}${s.representanteCpf ? `, inscrita no CPF sob nº ${esc(s.representanteCpf)}` : ''}, doravante denominada <b>CONTRATADA</b>, têm entre si justo e contratado o que se segue, mediante as cláusulas e condições seguintes:</p>

  ${titulo('DOS SERVIÇOS PRESTADOS PELA CONTRATADA')}
  ${servicos.map((item, i) => `<p>${letra(i)}) ${esc(item.clause)}</p>`).join('')}
  <p>Parágrafo único: não estão incluídos neste contrato serviços ou obrigações não relacionados acima, ressalvado acordo financeiro entre as partes formalizado em termo aditivo.</p>

  ${titulo('DA SISTEMÁTICA DE TRABALHO')}
  <p>1 - Os serviços serão executados nas dependências da CONTRATADA, cabendo à CONTRATANTE fornecer a documentação indispensável ao desempenho dos serviços, consistindo basicamente em: a) extratos de todas as contas correntes bancárias, inclusive aplicações, e documentos relativos aos lançamentos; b) notas fiscais de compra (entrada) e de venda (saída), com os arquivos XML, bem como a comunicação de eventual cancelamento; c) demais documentos relacionados à empresa.</p>
  <p>2 - A documentação deverá ser enviada pela CONTRATANTE de forma completa e em boa ordem, impreterivelmente até o dia ${esc(s.prazoDocumentos)} de cada mês, por e-mail, WhatsApp ou pelo portal da CONTRATADA, a fim de que a escrituração seja efetuada em tempo hábil.</p>
  <p>3 - Todas as guias de impostos serão entregues antes do seu vencimento, desde que a documentação tenha sido entregue no prazo do item anterior. Por motivo de segurança para ambas as partes, a CONTRATADA não efetua pagamentos de impostos e taxas de qualquer natureza para clientes.</p>
  <p>Parágrafo único: a CONTRATADA não se responsabiliza por atrasos em informações e declarações, nem por suas consequências, como multas e encargos, decorrentes de documentos e arquivos não apresentados em tempo hábil.</p>

  ${titulo('DOS HONORÁRIOS')}
  <p>Pela prestação dos serviços objeto deste contrato, a CONTRATANTE pagará à CONTRATADA honorários mensais no valor de <b>${money(valor)} (${esc(valorPorExtenso(valor))})</b>, com vencimento nos dias ${esc(s.diasPagamento)} de cada mês, a partir de ${dateBr(contract.startDate)}.</p>
  ${s.honorarioAnual ? '<p>Parágrafo único: ao final de cada exercício será cobrado um honorário adicional, no valor de uma mensalidade, referente às obrigações anuais executadas no período, com vencimento em dezembro. Em caso de rescisão, será cobrado proporcionalmente aos meses do exercício.</p>' : ''}

  ${titulo('DOS REAJUSTES')}
  <p>Os honorários serão reajustados anualmente, a contar do início deste contrato: a) pela variação do salário mínimo vigente; b) considerando a variação no volume de serviços; ou c) em comum acordo entre as partes.</p>

  ${titulo('DA MORA')}
  <p>Em caso de atraso no pagamento dos honorários, incidirão multa de 2% (dois por cento) sobre o valor devido e juros de mora de 1% (um por cento) ao mês, pro rata die, até a data do efetivo pagamento.</p>
  <p>Parágrafo único: a falta de pagamento de qualquer parcela de honorários faculta à CONTRATADA suspender a execução dos serviços, eximindo-se de qualquer responsabilidade pelos danos resultantes do período de paralisação, ou considerar rescindido o presente contrato.</p>

  ${titulo('DOS SERVIÇOS EXTRACONTÁBEIS')}
  <p>Todos os serviços não incluídos neste contrato serão cobrados à parte, tais como: abertura, alteração e baixa de empresa, certidões negativas, recálculo de guias em atraso, parcelamentos, autenticação e registro de livros, cadastros e recadastramentos bancários e atendimento a fiscalizações.</p>

  ${titulo('DOS MATERIAIS E TAXAS')}
  <p>Custas, emolumentos, taxas exigidas por órgãos públicos, autenticações e reconhecimento de firmas necessários à execução dos serviços serão de responsabilidade da CONTRATANTE, mediante recibo discriminado acompanhado dos comprovantes de desembolso.</p>

  ${titulo('DAS RESPONSABILIDADES')}
  <p>A CONTRATADA assume inteira responsabilidade pelos serviços técnicos realizados e pelas orientações escritas que prestar, estando os seus serviços baseados na documentação e nas informações apresentadas pela CONTRATANTE, não assumindo responsabilidade pelas consequências de informações, declarações ou documentação inidôneas ou incompletas, nem por omissão da CONTRATANTE ou pelo desrespeito às orientações prestadas.</p>
  <p>a) A CONTRATADA responderá por multas somente quando comprovada a sua exclusiva culpa, não incluindo correção monetária e juros sobre recolhimentos em atraso.</p>
  <p>b) Os documentos contábeis, em caso de transferência dos serviços a outro profissional, serão entregues após cumpridas as formalidades do Conselho Regional de Contabilidade${s.crcUf ? ` do Estado de ${esc(s.crcUf)}` : ''}.</p>

  ${titulo('DA PROTEÇÃO DE DADOS (LGPD)')}
  <p>Os dados pessoais e as informações obtidas ou utilizadas por qualquer das partes em decorrência deste contrato serão coletados, utilizados, armazenados e mantidos de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), exclusivamente para a execução dos serviços contratados e o cumprimento de obrigações legais.</p>

  ${titulo('DO PRAZO E DA RESCISÃO')}
  <p>Este instrumento é feito por prazo indeterminado, iniciando-se em ${dateBr(contract.startDate)}, podendo ser rescindido a qualquer tempo, por qualquer das partes, mediante aviso prévio por escrito de no mínimo ${Number(s.avisoPrevioDias) || 30} (${esc(inteiroPorExtenso(Number(s.avisoPrevioDias) || 30))}) dias. A não observância deste prazo acarretará multa equivalente a 2 (dois) honorários mensais.</p>
  <p>Parágrafo único: caso a CONTRATANTE não coloque os documentos à disposição da CONTRATADA, por qualquer motivo, as obrigações não serão suspensas, permanecendo a de apresentar os documentos e de pagar os honorários.</p>

  ${titulo('DO FORO')}
  <p>As partes elegem o foro da Comarca de ${esc(s.foro || s.cidadeAssinatura)}${s.ufAssinatura ? ` - ${esc(s.ufAssinatura)}` : ''} para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
  <p>E, por estarem justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.</p>

  <div class="assinaturas">
    <p class="centro">${esc(s.cidadeAssinatura)}${s.ufAssinatura ? ` - ${esc(s.ufAssinatura)}` : ''}, ${dataPorExtenso(contract.startDate)}.</p>
    <div class="assinatura"><p>CONTRATANTE:</p><br><div class="linha">${esc(c.razaoSocial)}<br>CNPJ: ${esc(c.cnpj)}${c.representanteNome ? `<br>${esc(c.representanteNome)}` : ''}${c.representanteCpf ? `<br>CPF: ${esc(c.representanteCpf)}` : ''}</div></div>
    <div class="assinatura"><p>CONTRATADA:</p><br><div class="linha">${esc(firm.name)}<br>CNPJ: ${esc(firm.cnpj)}${s.representanteNome ? `<br>${esc(s.representanteNome)}` : ''}${s.representanteCpf ? `<br>CPF: ${esc(s.representanteCpf)}` : ''}${s.crc ? `<br>${esc(s.crc)}` : ''}</div></div>
    <p style="margin-top:36px">Testemunhas:</p>
    <div class="testemunhas"><div class="linha">Nome:<br>CPF:</div><div class="linha">Nome:<br>CPF:</div></div>
  </div>
  </body></html>`;
}

module.exports = { SERVICES, SERVICE_KEYS, contractHtml, defaultSettings, valorPorExtenso, inteiroPorExtenso };
