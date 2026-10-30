const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateContentWithAI, generationInputSchema } = require('../src/services/contentAi.service');
const brief = { topic: 'Organizacao financeira', context: 'Escritorio contabil para pequenos negocios', audience: 'Empreendedores', goal: 'educar', tone: 'profissional', count: 2, research: true };
const slides = [1, 2].map((index) => ({ eyebrow: 'Planejamento', headline: `Organize seu negocio ${index}`, highlight: 'negocio', body: 'Separe suas informacoes e converse com um profissional.', footer: 'Young Contabil' }));
const output = { title: 'Organizacao', caption: 'Fale com a equipe.', slides, reviewNotes: '' };
function response(value = output, status = 200) {
  return { ok: status === 200, status, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [{ type: 'url_citation', url: 'https://www.gov.br/receitafederal/pt-br', title: 'Receita Federal' }] }] }] }) };
}
test('real AI request uses structured output, official research and no retained response', async () => {
  let request;
  const result = await generateContentWithAI({ apiKey: 'sk-test-only', brief, firmName: 'Young Contabil', fetchImpl: async (url, options) => { request = { url, ...options, payload: JSON.parse(options.body) }; return response(); } });
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.payload.store, false);
  assert.ok(request.payload.instructions.includes('Adapte a mensagem ao publico informado'));
  assert.ok(request.payload.instructions.includes('nao copie a materia'));
  assert.equal(request.payload.model, 'gpt-5-mini');
  assert.equal(request.payload.reasoning.effort, 'low');
  assert.equal(request.payload.text.format.strict, true);
  assert.equal(request.payload.text.format.schema.properties.slides.minItems, 2);
  assert.ok(request.payload.tools[0].filters.allowed_domains.includes('gov.br'));
  assert.equal(result.slides.length, 2);
  assert.equal(result.sources[0].title, 'Receita Federal');
  assert.ok(!JSON.stringify(result).includes('sk-test-only'));
});
test('rejects provider errors, malformed responses and incorrect slide counts', async () => {
  await assert.rejects(() => generateContentWithAI({ apiKey: 'sk-test', brief, fetchImpl: async () => response(output, 401) }), /chave/i);
  await assert.rejects(() => generateContentWithAI({ apiKey: 'sk-test', brief, fetchImpl: async () => response({ ...output, slides: slides.slice(0, 1) }) }), /resposta/i);
  await assert.rejects(() => generateContentWithAI({ apiKey: 'sk-test', brief, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'incomplete', output: [] }) }) }), /resposta/i);
});
test('requires a theme or context, and caps the requested slide count', () => {
  assert.throws(() => generationInputSchema.parse({ count: 1, topic: '', context: '' }));
  assert.throws(() => generationInputSchema.parse({ ...brief, count: 11 }));
  assert.equal(generationInputSchema.parse({ context: 'Texto para transformar em conteudo', count: 1 }).count, 1);
});
