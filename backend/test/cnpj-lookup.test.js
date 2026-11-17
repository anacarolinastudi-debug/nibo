const test = require('node:test');
const assert = require('node:assert/strict');
const { lookupCnpj, _private } = require('../src/services/cnpjLookup.service');

const CNPJ = '00000000000191';
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const brasilApi = {
  razao_social: 'BANCO DO BRASIL SA', nome_fantasia: 'DIRECAO GERAL', cep: '70040912', descricao_tipo_de_logradouro: 'QUADRA',
  logradouro: 'SAUN QUADRA 5 BLOCO B', numero: 'SN', complemento: 'ANDAR 1', bairro: 'ASA NORTE', municipio: 'BRASILIA', uf: 'df',
  ddd_telefone_1: '6134939002', email: null, cnae_fiscal: 6422100, cnae_fiscal_descricao: 'Bancos múltiplos, com carteira comercial',
  opcao_pelo_simples: false, opcao_pelo_mei: false, descricao_situacao_cadastral: 'ATIVA',
};

test('valida o dígito do CNPJ', () => {
  assert.equal(_private.validCnpj(CNPJ), true);
  assert.equal(_private.validCnpj('00000000000192'), false);
  assert.equal(_private.validCnpj('11111111111111'), false);
});

test('preenche o cadastro com os dados da BrasilAPI no formato do sistema', async () => {
  _private.cache.clear();
  const data = await lookupCnpj('00.000.000/0001-91', { fetchImpl: async () => json(200, brasilApi) });
  assert.equal(data.cnpj, '00.000.000/0001-91');
  assert.equal(data.name, 'BANCO DO BRASIL SA');
  assert.equal(data.street, 'QUADRA SAUN QUADRA 5 BLOCO B');
  assert.equal(data.number, 'S/N');
  assert.equal(data.cep, '70040-912');
  assert.equal(data.state, 'DF');
  assert.equal(data.phone, '(61) 3493-9002');
  assert.equal(data.cnae, '6422-1/00');
  assert.equal(data.activity, 'Bancos múltiplos, com carteira comercial');
  assert.equal(data.taxRegime, null);
  assert.equal(data.situation, 'ATIVA');
});

test('MEI e Simples viram o regime do cadastro', () => {
  assert.equal(_private.fromBrasilApi({ ...brasilApi, opcao_pelo_mei: true, opcao_pelo_simples: true }).taxRegime, 'MEI');
  assert.equal(_private.fromBrasilApi({ ...brasilApi, opcao_pelo_simples: true }).taxRegime, 'SIMPLES_NACIONAL');
});

test('usa o serviço reserva quando a BrasilAPI falha, com inscrição estadual', async () => {
  _private.cache.clear();
  const urls = [];
  const data = await lookupCnpj(CNPJ, { fetchImpl: async (url) => {
    urls.push(url);
    if (url.includes('brasilapi')) return json(503, {});
    return json(200, { razao_social: 'EMPRESA RESERVA LTDA', simples: { simples: 'Sim', mei: 'Não' }, estabelecimento: {
      nome_fantasia: 'RESERVA', cep: '13480000', tipo_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '10', bairro: 'CENTRO',
      cidade: { nome: 'Limeira' }, estado: { sigla: 'SP' }, ddd1: '19', telefone1: '34511234', email: 'CONTATO@RESERVA.COM',
      atividade_principal: { id: '4781400', descricao: 'Comércio varejista de artigos do vestuário' },
      inscricoes_estaduais: [{ inscricao_estadual: '417123456110', ativo: true, estado: { sigla: 'SP' } }],
    } });
  } });
  assert.equal(urls.length, 2);
  assert.equal(data.name, 'EMPRESA RESERVA LTDA');
  assert.equal(data.stateRegistration, '417123456110');
  assert.equal(data.cnae, '4781-4/00');
  assert.equal(data.email, 'contato@reserva.com');
  assert.equal(data.taxRegime, 'SIMPLES_NACIONAL');
  assert.equal(data.source, 'CNPJ.ws');
});

test('CNPJ inexistente, inválido ou serviços fora do ar', async () => {
  _private.cache.clear();
  await assert.rejects(() => lookupCnpj(CNPJ, { fetchImpl: async () => json(404, {}) }), /não encontrado/);
  await assert.rejects(() => lookupCnpj('12345678000100', { fetchImpl: async () => json(200, brasilApi) }), /CNPJ inválido/);
  _private.cache.clear();
  await assert.rejects(() => lookupCnpj(CNPJ, { fetchImpl: async () => { throw new Error('timeout'); } }), /indisponível/);
});
