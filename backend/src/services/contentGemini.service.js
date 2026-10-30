const fail = (message, status = 502) => Object.assign(new Error(message), { status });

async function generateGemini({ apiKey, payload, fetchImpl }) {
  const model = process.env.CONTENT_GEMINI_MODEL || 'gemini-3-flash-preview';
  if (!/^[a-z0-9.-]+$/.test(model)) throw fail('Modelo Gemini invalido.', 503);
  const signal = AbortSignal.timeout(90000);
  async function request(body) {
    let response;
    try {
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
      });
    } catch { throw fail('O Gemini demorou ou ficou indisponivel. Tente novamente.', 504); }
    if (!response.ok) {
      if (response.status === 429) throw fail('O Gemini atingiu o limite de uso da conta. Aguarde ou confira sua cota no Google AI Studio.', 429);
      if ([400, 401, 403].includes(response.status)) throw fail('Confira a chave e as permissoes da API Gemini em Configurar IA.', 400);
      throw fail('Nao foi possivel gerar com o Gemini neste momento. Tente novamente.');
    }
    let data;
    try { data = await response.json(); } catch { throw fail('O Gemini retornou uma resposta invalida. Tente novamente.'); }
    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason !== 'STOP') throw fail('O Gemini nao concluiu a resposta. Revise o contexto e tente novamente.');
    const text = (candidate.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || '').join('');
    return { text, candidate };
  }
  const result = await request({
    systemInstruction: { parts: [{ text: payload.instructions + '\nNao ha ferramenta de pesquisa nesta etapa. Use apenas o contexto e as referencias parciais fornecidas; sinalize limites em reviewNotes.' }] },
    contents: [{ role: 'user', parts: [{ text: payload.input }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: payload.text.format.schema, maxOutputTokens: 6500 },
  });
  return { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: result.text, annotations: [] }] }] };
}
module.exports = { generateGemini };
