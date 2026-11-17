const test = require('node:test');
const assert = require('node:assert/strict');
const { SERVICES, contractHtml, valorPorExtenso, defaultSettings } = require('../src/services/contractDocument');

const firm = { name: 'ESCRITÓRIO TESTE', cnpj: '00.000.000/0001-91', street: 'Rua A', number: '10', neighborhood: 'Centro', city: 'Cuiabá', state: 'MT', crc: 'CRC-MT 1' };
const settings = { ...defaultSettings(firm), representanteNome: 'MARIA CONTADORA', representanteCpf: '000.000.000-00', crc: 'CRC-MT 000000/O-0', crcUf: 'Mato Grosso', cidadeAssinatura: 'Cuiabá', ufAssinatura: 'MT', foro: 'Cuiabá' };
const contract = {
  startDate: new Date('2026-12-01T00:00:00Z'),
  monthlyFee: 1320,
  services: ['FISCAL', 'PESSOAL_SEM_MOVIMENTO', 'IRPF'],
  contratante: { razaoSocial: 'CLIENTE EXEMPLO LTDA', cnpj: '11.222.333/0001-81', logradouro: 'RUA DAS FLORES', numero: '100', bairro: 'CENTRO', cidade: 'LIMEIRA', uf: 'SP', cep: '13480-000', representanteNome: 'JOÃO SÓCIO', representanteQualificacao: 'sócio-administrador' },
};

test('valor por extenso', () => {
  assert.equal(valorPorExtenso(200), 'duzentos reais');
  assert.equal(valorPorExtenso(1320), 'mil trezentos e vinte reais');
  assert.equal(valorPorExtenso(2100), 'dois mil e cem reais');
  assert.equal(valorPorExtenso(4429.86), 'quatro mil quatrocentos e vinte e nove reais e oitenta e seis centavos');
  assert.equal(valorPorExtenso(1000000), 'um milhão de reais');
});

test('contrato traz só os serviços escolhidos, as partes e os honorários', () => {
  const html = contractHtml({ contract, firm, settings });
  assert.match(html, /CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS/);
  assert.match(html, /<b>CLIENTE EXEMPLO LTDA<\/b>, inscrita no CNPJ sob nº 11\.222\.333\/0001-81, com sede em RUA DAS FLORES, 100, CENTRO, LIMEIRA - SP, CEP 13480-000, neste ato representada por JOÃO SÓCIO, sócio-administrador/);
  assert.match(html, /<b>ESCRITÓRIO TESTE<\/b>.*representada por MARIA CONTADORA.*CRC-MT 000000\/O-0/s);
  assert.match(html, /a\) DEPARTAMENTO FISCAL/);
  assert.match(html, /b\) DEPARTAMENTO PESSOAL: declarações mensais sem movimento/);
  assert.match(html, /c\) IMPOSTO DE RENDA PESSOA FÍSICA/);
  assert.doesNotMatch(html, /DEPARTAMENTO CONTÁBIL:/);
  assert.match(html, /R\$\s?1\.320,00 \(mil trezentos e vinte reais\)/);
  assert.match(html, /iniciando-se em 01\/12\/2026/);
  assert.match(html, /Cuiabá - MT, 01 de dezembro de 2026\./);
  assert.match(html, /Conselho Regional de Contabilidade do Estado de Mato Grosso/);
  assert.doesNotMatch(html, /honorário adicional/);
  assert.match(contractHtml({ contract, firm, settings: { ...settings, honorarioAnual: true } }), /honorário adicional/);
});

test('escapa caracteres especiais vindos do cadastro', () => {
  const html = contractHtml({ contract: { ...contract, contratante: { ...contract.contratante, razaoSocial: 'A & B <LTDA>' } }, firm, settings });
  assert.match(html, /A &amp; B &lt;LTDA&gt;/);
});

test('catálogo de serviços com chave e cláusula', () => {
  assert.ok(SERVICES.length >= 6);
  for (const item of SERVICES) {
    assert.ok(item.key && item.label && item.clause.length > 40);
  }
});

test('pré-preenche pelo CNPJ e cria o contrato numerado, ligado ao cliente', async () => {
  const prismaPath = require.resolve('../src/lib/prisma');
  const lookupPath = require.resolve('../src/services/cnpjLookup.service');
  const ctrlPath = require.resolve('../src/controllers/contracts.controller');
  const created = [];
  const firmRow = { id: 'f1', name: 'ESCRITÓRIO', cnpj: '00.000.000/0001-91', contractSettings: { representanteNome: 'MARIA' } };
  const db = {
    accountingFirm: { findUnique: async () => firmRow, update: async ({ data }) => Object.assign(firmRow, data) },
    client: { findFirst: async ({ where }) => (where.cnpj.in.includes('11222333000181') ? { id: 'c1', name: 'CLIENTE EXEMPLO LTDA', code: '7' } : null) },
    contract: { findFirst: async () => ({ number: 4 }), create: async ({ data }) => { created.push(data); return { id: 'k1', createdAt: new Date(), status: 'ATIVO', ...data }; } },
    $transaction: async (fn) => fn(db),
  };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: db };
  require.cache[lookupPath] = { id: lookupPath, filename: lookupPath, loaded: true, exports: { lookupCnpj: async () => ({
    cnpj: '11.222.333/0001-81', name: 'CLIENTE EXEMPLO LTDA', cep: '13480-000', street: 'RUA A', number: '1', complement: '', neighborhood: 'CENTRO', city: 'LIMEIRA', state: 'SP', situation: 'ATIVA',
    partners: [{ name: 'SÓCIO QUOTISTA', role: 'Sócio' }, { name: 'JOÃO ADMIN', role: 'Sócio-Administrador' }],
  }) } };
  delete require.cache[ctrlPath];
  const ctrl = require(ctrlPath);
  const res = () => { const r = { statusCode: 200, headers: {}, body: null, status(c) { r.statusCode = c; return r; }, set(k, v) { r.headers[k] = v; return r; }, json(b) { r.body = b; return r; } }; return r; };
  const req = (extra) => ({ user: { accountingFirmId: 'f1', id: 'u1' }, params: {}, body: {}, ...extra });
  try {
    const pre = res();
    await ctrl.prefill(req({ params: { cnpj: '11222333000181' } }), pre);
    assert.equal(pre.body.contratante.razaoSocial, 'CLIENTE EXEMPLO LTDA');
    assert.equal(pre.body.contratante.representanteNome, 'JOÃO ADMIN', 'escolhe o sócio administrador');
    assert.equal(pre.body.client.code, '7');

    const out = res();
    await ctrl.create(req({ body: { cnpj: '11222333000181', startDate: '2026-12-01', monthlyFee: '1320.5', services: ['FISCAL', 'IRPF'], contratante: pre.body.contratante } }), out);
    assert.equal(out.statusCode, 201);
    assert.equal(created[0].number, 5);
    assert.equal(created[0].clientId, 'c1');
    assert.equal(created[0].cnpj, '11.222.333/0001-81');
    assert.equal(out.body.monthlyFee, 1320.5);

    await assert.rejects(() => ctrl.create(req({ body: { cnpj: '11222333000181', startDate: '2026-12-01', monthlyFee: 10, services: ['INEXISTENTE'], contratante: pre.body.contratante } }), res()), /Serviço inválido/);

    firmRow.contractSettings = null;
    const semConfig = res();
    await ctrl.create(req({ body: { cnpj: '11222333000181', startDate: '2026-12-01', monthlyFee: 10, services: ['FISCAL'], contratante: pre.body.contratante } }), semConfig);
    assert.equal(semConfig.statusCode, 400);
    assert.match(semConfig.body.error, /Dados do escritório/);
  } finally {
    delete require.cache[prismaPath];
    delete require.cache[lookupPath];
    delete require.cache[ctrlPath];
  }
});
