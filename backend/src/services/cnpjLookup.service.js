// Consulta pública de CNPJ (dados abertos da Receita Federal) para preencher o
// cadastro de clientes. Fonte principal: BrasilAPI; reserva: publica.cnpj.ws.
// Só dados públicos da empresa são enviados (o próprio CNPJ).
const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

function validCnpj(value) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (base) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split('').reduce((acc, n, i) => acc + Number(n) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(cnpj.slice(0, 12));
  const second = digit(cnpj.slice(0, 12) + first);
  return cnpj.endsWith(`${first}${second}`);
}

const formatCnpj = (c) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const formatCep = (value) => { const d = onlyDigits(value); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const formatCnae = (value) => { const d = onlyDigits(value).padStart(7, '0'); return d.length === 7 ? `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}` : ''; };
function formatPhone(value) {
  const d = onlyDigits(value);
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
}
const clean = (value) => (value === null || value === undefined ? '' : String(value).trim());
const titleNumber = (value) => (/^(SN|S\/N|0+)$/i.test(clean(value)) ? 'S/N' : clean(value));

function regimeFrom({ mei, simples }) {
  if (mei === true) return 'MEI';
  if (simples === true) return 'SIMPLES_NACIONAL';
  return null; // Lucro Presumido x Real não aparece nos dados públicos
}

function fromBrasilApi(d) {
  return {
    name: clean(d.razao_social),
    tradeName: clean(d.nome_fantasia),
    cep: formatCep(d.cep),
    street: [clean(d.descricao_tipo_de_logradouro), clean(d.logradouro)].filter(Boolean).join(' '),
    number: titleNumber(d.numero),
    complement: clean(d.complemento),
    neighborhood: clean(d.bairro),
    city: clean(d.municipio),
    state: clean(d.uf).toUpperCase(),
    phone: formatPhone(d.ddd_telefone_1),
    email: clean(d.email).toLowerCase(),
    cnae: d.cnae_fiscal ? formatCnae(d.cnae_fiscal) : '',
    activity: clean(d.cnae_fiscal_descricao),
    stateRegistration: '',
    taxRegime: regimeFrom({ mei: d.opcao_pelo_mei, simples: d.opcao_pelo_simples }),
    situation: clean(d.descricao_situacao_cadastral),
    source: 'BrasilAPI',
  };
}

function fromCnpjWs(d) {
  const e = d.estabelecimento || {};
  const ie = (e.inscricoes_estaduais || []).find((item) => item.ativo !== false && item.estado?.sigla === e.estado?.sigla);
  return {
    name: clean(d.razao_social),
    tradeName: clean(e.nome_fantasia),
    cep: formatCep(e.cep),
    street: [clean(e.tipo_logradouro), clean(e.logradouro)].filter(Boolean).join(' '),
    number: titleNumber(e.numero),
    complement: clean(e.complemento),
    neighborhood: clean(e.bairro),
    city: clean(e.cidade?.nome),
    state: clean(e.estado?.sigla).toUpperCase(),
    phone: formatPhone(`${clean(e.ddd1)}${clean(e.telefone1)}`),
    email: clean(e.email).toLowerCase(),
    cnae: e.atividade_principal?.id ? formatCnae(e.atividade_principal.id) : '',
    activity: clean(e.atividade_principal?.descricao),
    stateRegistration: clean(ie?.inscricao_estadual),
    taxRegime: regimeFrom({ mei: d.simples?.mei === 'Sim', simples: d.simples?.simples === 'Sim' }),
    situation: clean(e.situacao_cadastral),
    source: 'CNPJ.ws',
  };
}

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'ContabilGestao/1.0' }, signal: AbortSignal.timeout(12000) });
  if (response.status === 404) return { notFound: true };
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { data: await response.json() };
}

async function lookupCnpj(value, { fetchImpl = fetch } = {}) {
  const cnpj = onlyDigits(value);
  if (!validCnpj(cnpj)) throw Object.assign(new Error('CNPJ inválido. Confira os 14 dígitos.'), { status: 400 });
  const cached = cache.get(cnpj);
  if (cached && cached.at > Date.now() - CACHE_MS) return cached.data;

  const sources = [
    { url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, map: fromBrasilApi },
    { url: `https://publica.cnpj.ws/cnpj/${cnpj}`, map: fromCnpjWs },
  ];
  let notFound = false;
  const failures = [];
  for (const source of sources) {
    try {
      const result = await getJson(source.url, fetchImpl);
      if (result.notFound) { notFound = true; continue; }
      const data = { cnpj: formatCnpj(cnpj), ...source.map(result.data) };
      if (!data.name) { failures.push(`${source.map === fromBrasilApi ? 'BrasilAPI' : 'CNPJ.ws'} sem razão social`); continue; }
      cache.set(cnpj, { at: Date.now(), data });
      return data;
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (notFound) throw Object.assign(new Error('CNPJ não encontrado na Receita Federal.'), { status: 404 });
  throw Object.assign(new Error(`Consulta de CNPJ indisponível no momento (${failures.join('; ')}). Preencha manualmente ou tente de novo.`), { status: 502 });
}

module.exports = { lookupCnpj, _private: { validCnpj, fromBrasilApi, fromCnpjWs, formatCnae, formatPhone, cache } };
