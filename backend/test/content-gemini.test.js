const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateContentWithAI } = require('../src/services/contentAi.service');
const generated = { title: 'Rotina', caption: 'Organize seu negocio.', reviewNotes: '', slides: [{ eyebrow: 'Planejamento', headline: 'Organize seu negocio', highlight: 'negocio', body: 'Converse com a equipe.', footer: 'Young' }] };
test('Gemini uses its own endpoint, protected header and validated structured output', async () => {
  const calls = [];
  const result = await generateContentWithAI({ provider: 'gemini', apiKey: 'test-google-key', brief: { topic: 'Rotina', count: 1, research: false }, fetchImpl: async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(generated) }] } }] }) };
  } });
  assert.match(calls[0].url, /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\//);
  assert.ok(!calls[0].url.includes('test-google-key'));
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-google-key');
  assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(result.slides.length, 1);
});
test('Gemini quota errors are actionable and never expose the key', async () => {
  await assert.rejects(() => generateContentWithAI({ provider: 'gemini', apiKey: 'test-google-key', brief: { topic: 'Rotina', count: 1, research: false }, fetchImpl: async () => ({ ok: false, status: 429 }) }), /Gemini.*limite/i);
});
test('research quota failure asks user to disable research instead of silently changing the request', async () => {
  let calls = 0;
  await assert.rejects(() => generateContentWithAI({ provider: 'gemini', apiKey: 'test-google-key', brief: { topic: 'Rotina', count: 1, research: true }, fetchImpl: async () => { calls++; return { ok: false, status: 429 }; } }), /Desmarque a pesquisa/);
  assert.equal(calls, 1);
});
