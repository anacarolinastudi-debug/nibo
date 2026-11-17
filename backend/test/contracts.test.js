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
