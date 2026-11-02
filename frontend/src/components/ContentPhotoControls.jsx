import React, { useEffect, useRef, useState } from 'react';
import { Search, Upload, RefreshCw, Check } from 'lucide-react';
import api from '../api/client';
import { compressPhoto } from '../utils/contentPhoto';

export default function ContentPhotoControls({ settings, onChange, onBusyChange, disabled = false }) {
  const topic = settings.slides[0]?.headline?.trim().slice(0, 200) || '';
  const [query, setQuery] = useState(topic);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null), request = useRef(0), alive = useRef(true), controller = useRef(null);
  const callbacks = useRef({ onChange, onBusyChange, disabled }); callbacks.current = { onChange, onBusyChange, disabled };
  const manual = useRef(false);
  const photoRef = useRef(settings.coverPhoto); photoRef.current = settings.coverPhoto;
  function setPending(value) { if (alive.current) { setBusy(value); callbacks.current.onBusyChange(value); } }
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current++; controller.current?.abort(); callbacks.current.onBusyChange(false); }; }, []);
  function begin() { controller.current?.abort(); controller.current = new AbortController(); const id = ++request.current; setPending(true); setError(''); return { id, signal: controller.current.signal }; }
  const latest = id => alive.current && request.current === id;
  const current = id => latest(id) && !callbacks.current.disabled;
  async function select(item, mode = 'manual', term = query, task = null) {
    if (callbacks.current.disabled) return;
    if (mode === 'manual') manual.current = true;
    const active = task || begin();
    try {
      const { data } = await api.post('/content/images/select', { token: item.token }, { signal: active.signal, timeout: 25000 });
      const dataUrl = await compressPhoto(data.dataUrl);
      if (current(active.id)) callbacks.current.onChange({ coverPhoto: { ...data, dataUrl, mode, query: term }, photoX: 50, photoY: 50 });
    } catch (failure) { if (current(active.id) && !active.signal.aborted) setError(failure.response?.data?.error || failure.message || 'Não foi possível carregar a imagem.'); }
    finally { if (latest(active.id)) setPending(false); }
  }
  async function search(term, mode = 'manual') {
    if (callbacks.current.disabled || term.trim().length < 2) return;
    if (mode === 'manual') manual.current = true;
    const active = begin(); setQuery(term);
    try {
      const { data } = await api.get('/content/images/search', { params: { q: term, automatic: mode === 'auto' ? 'true' : 'false' }, signal: active.signal, timeout: 20000 });
      if (!current(active.id)) return;
      setItems(data.items);
      if (data.items.length) await select(data.items[0], mode, term, active);
      else setError('Nenhuma imagem encontrada para esta busca.');
    } catch (failure) { if (current(active.id) && !active.signal.aborted) setError(failure.response?.data?.error || 'A busca de imagens está indisponível.'); }
    finally { if (latest(active.id)) setPending(false); }
  }
  useEffect(() => {
    const photo = photoRef.current;
    if (disabled || !topic || manual.current || (photo && (photo.mode !== 'auto' || photo.query === topic))) return undefined;
    const timer = window.setTimeout(() => { if (!manual.current) search(topic, 'auto'); }, 1000);
    return () => { window.clearTimeout(timer); if (!manual.current) { controller.current?.abort(); request.current++; setPending(false); } };
  }, [topic, disabled]);
  async function upload(event) {
    if (callbacks.current.disabled) return;
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    manual.current = true;
    const active = begin();
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Envie uma foto PNG, JPG ou WebP de até 10 MB.');
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const compressed = await compressPhoto(dataUrl);
      if (current(active.id)) callbacks.current.onChange({ coverPhoto: { dataUrl: compressed, title: file.name.slice(0, 200), creator: '', license: '', sourceUrl: '', licenseUrl: '', mode: 'manual', query: '' }, photoX: 50, photoY: 50 });
    } catch (failure) { if (current(active.id)) setError(failure.message || 'Não foi possível abrir a foto.'); }
    finally { if (latest(active.id)) setPending(false); }
  }
  return <section className="space-y-3 border-y py-4 text-sm" aria-label="Imagem da capa">
    <b>Imagem da capa</b>
    <div className="flex gap-2"><input aria-label="Buscar imagem" maxLength={200} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(query); } }} className="min-w-0 flex-1 rounded border px-2 py-2" /><button type="button" title="Buscar imagem" aria-label="Buscar imagem" onClick={() => search(query)} className="grid h-9 w-9 shrink-0 place-items-center rounded border text-[#16829b]"><Search size={16} /></button></div>
    <div className="flex flex-wrap gap-3 text-[#16829b]"><button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1"><Upload size={15} />Enviar foto</button>{items.length > 1 && <button type="button" disabled={busy} onClick={() => { const index = items.findIndex(item => item.sourceUrl === settings.coverPhoto?.sourceUrl); select(items[(index + 1) % items.length]); }} className="inline-flex items-center gap-1"><RefreshCw size={15} />Outra imagem</button>}<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Enviar foto da capa" className="hidden" onChange={upload} /></div>
    {busy && <p role="status" className="text-xs text-[#68737a]">Buscando e preparando imagem...</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {items.length > 0 && <div className="grid grid-cols-3 gap-2">{items.map(item => <button type="button" key={item.id} title={item.title} aria-label={`Usar imagem: ${item.title}`} disabled={busy} onClick={() => select(item)} className="relative aspect-square overflow-hidden rounded border bg-white disabled:opacity-60"><img src={item.url} alt={item.title} loading="lazy" className="h-full w-full object-cover" />{settings.coverPhoto?.sourceUrl === item.sourceUrl && <Check size={18} className="absolute right-1 top-1 bg-white text-[#16829b]" />}</button>)}</div>}
    {settings.coverPhoto && <>
      <label className="flex items-center gap-2"><input type="checkbox" checked={settings.photoMono ?? true} onChange={e => onChange({ photoMono: e.target.checked })} />Preto e branco</label>
      <label className="block text-xs">Posição horizontal<input aria-label="Posição horizontal da foto" type="range" min={0} max={100} value={settings.photoX ?? 50} onChange={e => onChange({ photoX: Number(e.target.value) })} className="mt-2 w-full" /></label>
      <label className="block text-xs">Posição vertical<input aria-label="Posição vertical da foto" type="range" min={0} max={100} value={settings.photoY ?? 50} onChange={e => onChange({ photoY: Number(e.target.value) })} className="mt-2 w-full" /></label>
      {settings.coverPhoto.sourceUrl ? <p className="break-words text-xs text-[#68737a]">Foto: {settings.coverPhoto.creator} · <a href={settings.coverPhoto.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Wikimedia Commons</a> · {settings.coverPhoto.license}</p> : <label className="block text-xs">Crédito da foto<input value={settings.coverPhoto.creator} maxLength={120} onChange={e => onChange({ coverPhoto: { ...settings.coverPhoto, creator: e.target.value } })} className="mt-1 w-full rounded border px-2 py-2" /></label>}
    </>}
  </section>;
}
