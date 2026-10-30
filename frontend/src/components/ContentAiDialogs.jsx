import React, { useState } from 'react';
import { KeyRound, LoaderCircle, Sparkles, X } from 'lucide-react';
import api from '../api/client';

const inputClass = 'mt-1 w-full rounded border border-[#d8dfe3] bg-white px-3 py-2 text-sm';
function Field({ label, children }) { return <label className="block text-sm font-medium">{label}{children}</label>; }
function Dialog({ title, busy, onClose, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-label={title} aria-busy={busy} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded bg-white p-5 text-[#3f4548] shadow-xl"><header className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{title}</h2><button type="button" disabled={busy} onClick={onClose} title="Fechar" aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded border disabled:opacity-40"><X size={17} /></button></header>{children}</section></div>;
}
export function AiConnectionDialog({ customKey, provider: currentProvider = 'openai', onClose, onConfigured }) {
  const [provider, setProvider] = useState(currentProvider);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.put('/content/settings/ai', { provider, apiKey: key.trim() }); setKey(''); onConfigured(true, true, provider); }
    catch (failure) { setError(failure.response?.data?.error || 'Não foi possível conectar a chave.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Remover a chave de IA deste escritório?')) return;
    setBusy(true); setError('');
    try { const { data } = await api.delete('/content/settings/ai'); onConfigured(data.configured, false, data.provider); }
    catch { setError('Não foi possível remover a chave.'); }
    finally { setBusy(false); }
  }
  return <Dialog title="Configurar IA" busy={busy} onClose={onClose}><form onSubmit={save}>
    <Field label="Provedor"><select value={provider} onChange={(event) => { setProvider(event.target.value); setKey(''); }} disabled={busy} className={inputClass}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option></select></Field>
    <div className="mt-4"><Field label={`Chave da API ${provider === 'gemini' ? 'Gemini' : 'OpenAI'} *`}><input autoFocus required type="password" autoComplete="new-password" spellCheck={false} maxLength={2048} value={key} onChange={(event) => setKey(event.target.value)} className={inputClass} disabled={busy} /></Field></div>
    <p className="mt-3 text-sm text-[#68737a]">A chave fica criptografada no servidor. O uso está sujeito aos limites e condições da conta conectada.</p>
    {provider === 'gemini' && <p className="mt-2 text-sm text-amber-800">No plano gratuito do Gemini, os dados enviados podem ser usados para melhorar os produtos do Google. Não inclua dados confidenciais de clientes.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <footer className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-4">{customKey && <button type="button" disabled={busy} onClick={remove} className="mr-auto text-sm text-red-700">Remover chave</button>}<button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 text-sm">Cancelar</button><button disabled={busy} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-4 py-2 text-sm text-white disabled:opacity-50"><KeyRound size={16} />{busy ? 'Salvando...' : 'Salvar conexão'}</button></footer>
  </form></Dialog>;
}

export function ContentAiDialog({ count, initialBrief, provider = 'openai', configured, canConfigure, onConnect, onClose, onApply }) {
  const [form, setForm] = useState({ topic: '', context: '', audience: 'Pequenos empresários, MEIs e autônomos', goal: 'educar', tone: 'profissional', count, research: true, ...initialBrief });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  async function generate(event) {
    event.preventDefault(); if (busy) return;
    if (!form.topic.trim() && !form.context.trim()) { setError('Informe um tema ou cole um contexto.'); return; }
    setBusy(true); setError('');
    try { const { data } = await api.post('/content/generate', form, { timeout: 150000 }); setResult(data); }
    catch (failure) { setError(failure.response?.data?.error || 'Não foi possível gerar o conteúdo. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <Dialog title="Gerar conteúdo com IA" busy={busy} onClose={onClose}>
    {!configured && <div className="mb-5 border-y bg-[#eef8fc] p-3 text-sm">{canConfigure ? <button type="button" onClick={() => onConnect(form)} className="inline-flex items-center gap-2 text-[#16829b]"><KeyRound size={16} /> Conectar IA</button> : 'Solicite ao administrador a conexão da IA do escritório.'}</div>}
    {result ? <>
      <h3 className="mb-4 font-semibold">{result.title}</h3>
      <ol className="divide-y border-y">{result.slides.map((slide, index) => <li key={index} className="py-4"><small className="text-xs text-[#68737a]">Slide {index + 1} · {slide.eyebrow}</small><p className="mt-1 font-semibold">{slide.headline}</p><p className="mt-2 whitespace-pre-wrap text-sm">{slide.body}</p></li>)}</ol>
      <div className="mt-4"><h3 className="text-sm font-semibold">Legenda</h3><p className="mt-2 whitespace-pre-wrap text-sm">{result.caption}</p></div>
      {result.reviewNotes && <div className="mt-4 border-l-2 border-amber-400 bg-amber-50 p-3 text-sm"><h3 className="mb-1 font-semibold">Pontos para revisar</h3><p className="whitespace-pre-wrap">{result.reviewNotes}</p></div>}
      {result.sources?.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">Fontes consultadas</h3>{result.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-words text-sm text-[#16829b] underline">{source.title}</a>)}</div>}
      <footer className="mt-6 flex flex-wrap justify-end gap-3 border-t pt-4"><button type="button" onClick={() => setResult(null)} className="rounded border px-4 py-2 text-sm">Ajustar pedido</button><button type="button" onClick={() => onApply(result)} className="rounded bg-[#2693d2] px-4 py-2 text-sm text-white">Usar no editor</button></footer>
    </> : <form onSubmit={generate}>
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Tema"><input autoFocus maxLength={500} value={form.topic} onChange={(event) => set('topic', event.target.value)} className={inputClass} /></Field>
        <Field label="Contexto ou texto de referência"><textarea maxLength={10000} rows={5} value={form.context} onChange={(event) => set('context', event.target.value)} className={inputClass} /></Field>
        <Field label="Público"><input maxLength={200} value={form.audience} onChange={(event) => set('audience', event.target.value)} className={inputClass} /></Field>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Objetivo"><select value={form.goal} onChange={(event) => set('goal', event.target.value)} className={inputClass}><option value="educar">Educar</option><option value="divulgar">Divulgar serviço</option><option value="interagir">Gerar interação</option></select></Field><Field label="Tom de voz"><select value={form.tone} onChange={(event) => set('tone', event.target.value)} className={inputClass}><option value="profissional">Profissional</option><option value="acolhedor">Próximo e acolhedor</option><option value="direto">Direto</option></select></Field><Field label="Slides"><input type="number" min={1} max={10} required value={form.count} onChange={(event) => set('count', Number(event.target.value))} className={inputClass} /></Field></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.research} onChange={(event) => set('research', event.target.checked)} />Pesquisar fontes oficiais quando necessário</label>
        <p className="text-xs text-[#68737a]">A consulta às publicações oficiais não usa créditos de IA. A geração do texto continua sujeita aos limites da conta conectada. Revise informações tributárias antes de publicar.</p>
      </fieldset>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <footer className="mt-6 flex justify-end gap-3 border-t pt-4"><button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 text-sm">Cancelar</button><button disabled={busy || !configured} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? 'Gerando...' : 'Gerar conteúdo'}</button></footer>
    </form>}
  </Dialog>;
}
