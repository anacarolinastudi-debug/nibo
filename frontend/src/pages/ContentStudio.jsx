import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Download, FilePlus2, ImagePlus, KeyRound, Plus, RefreshCw, Save, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FirmHeader from '../components/FirmHeader';
import NiboRail from '../components/NiboRail';
import ContentMenuLink from '../components/ContentMenuLink';
import { DEFAULT_CONTENT, drawContent, emptySlide } from '../utils/contentCanvas';
import { loadContentAssets } from '../utils/contentAssets';
import { AiConnectionDialog, ContentAiDialog } from '../components/ContentAiDialogs';

const inputClass = 'mt-1 w-full rounded border border-[#d8dfe3] bg-white px-3 py-2 text-sm text-[#3f4548]';
const copy = (value) => JSON.parse(JSON.stringify(value));
const templates = [['cover', 'Institucional'], ['tip', 'Informativo'], ['quote', 'Frase']];
function Field({ label, children }) { return <label className="block text-sm font-medium">{label}{children}</label>; }
function IconButton({ title, children, ...props }) { return <button type="button" title={title} aria-label={title} {...props} className="grid h-9 w-9 shrink-0 place-items-center rounded border text-[#16829b] hover:bg-[#eef8fc] disabled:opacity-40">{children}</button>; }
function ArtCanvas({ settings, index = 0, firm, logo, small = false, canvasRef }) {
  const ownRef = useRef(null);
  const ref = canvasRef || ownRef;
  useEffect(() => {
    let active = true;
    loadContentAssets().then(({ background, lightLogo }) => { if (active && ref.current) drawContent(ref.current, settings, index, firm?.name, logo, background, lightLogo); }).catch(() => {});
    return () => { active = false; };
  }, [settings, index, firm?.name, logo]);
  return <canvas ref={ref} width={small ? 216 : 1080} height={small ? 270 : 1350} aria-label={`Arte do slide ${index + 1}`} className="block h-auto w-full aspect-[4/5]" />;
}
function StudioMenu() {
  return <aside className="fixed inset-y-0 left-[46px] z-20 hidden w-[236px] flex-col border-r bg-[#f4f7fb] xl:flex">
    <div className="flex h-[58px] items-center border-b px-5 text-xl">Contador</div>
    <nav className="space-y-4 overflow-y-auto p-5 text-sm text-[#68737a]">
      <p className="text-xs">OPERAÇÃO</p>
      {[['/', 'Obrigações'], ['/demandas', 'Tarefas & Processos'], ['/relacionamento', 'Relacionamento'], ['/financeiro', 'Financeiro']].map(([to, label]) => <Link className="block px-3 py-2" key={to} to={to}>{label}</Link>)}
      <ContentMenuLink />
      <p className="border-t pt-4 text-xs">CADASTROS</p>
      <Link className="block px-3 py-2" to="/clientes">Clientes</Link><Link className="block px-3 py-2" to="/configuracoes">Configurações</Link>
    </nav>
  </aside>;
}

export default function ContentStudio() {
  const { user } = useAuth();
  const [firm, setFirm] = useState(null);
  const [logo, setLogo] = useState(null);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('editor');
  const [record, setRecord] = useState({ id: null, title: 'Novo conteúdo', status: 'DRAFT', settings: copy(DEFAULT_CONTENT) });
  const [saved, setSaved] = useState('');
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [studio, setStudio] = useState({ configured: false, customKey: false, logoUrl: null });
  const [assetsReady, setAssetsReady] = useState(false);
  const canvasRef = useRef(null);
  const logoFileRef = useRef(null);
  const dirty = saved ? JSON.stringify(record) !== saved : JSON.stringify(record) !== JSON.stringify({ id: null, title: 'Novo conteúdo', status: 'DRAFT', settings: DEFAULT_CONTENT });
  const settings = record.settings;
  const slide = settings.slides[current];
  const allowed = user?.role !== 'CLIENT';

  async function loadProjects() { const { data } = await api.get('/content'); setProjects(data); }
  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    let active = true;
    Promise.all([api.get('/firm'), api.get('/content')]).then(([office, library]) => {
      if (active) { setFirm(office.data); setProjects(library.data); }
    }).catch(() => { if (active) setError('Não foi possível carregar os conteúdos.'); }).finally(() => { if (active) setLoading(false); });
    api.get('/content/settings').then(({ data }) => { if (active) setStudio(data); }).catch(() => {});
    return () => { active = false; };
  }, [allowed]);
  useEffect(() => {
    let active = true;
    loadContentAssets().then(() => { if (active) setAssetsReady(true); }).catch(() => { if (active) setError('Não foi possível carregar as fontes ou o fundo das artes. Atualize a página para tentar novamente.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    setLogo(null);
    const source = studio.logoUrl || firm?.logoUrl;
    if (!source) return;
    let active = true;
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => { if (active) setLogo(image); };
    image.onerror = () => { if (active) setError('Não foi possível carregar a logo do escritório.'); };
    const origin = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
    image.src = /^(data:|https?:)/.test(source) ? source : origin + source;
    return () => { active = false; };
  }, [firm?.logoUrl, studio.logoUrl]);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    const guardNavigation = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!dirty || !link || event.defaultPrevented) return;
      const target = new URL(link.href, window.location.href);
      if (target.protocol !== window.location.protocol || target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
      if (!window.confirm('Sair sem salvar as alterações deste conteúdo?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('click', guardNavigation, true);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('click', guardNavigation, true); };
  }, [dirty]);

  function setSettings(values) { setRecord((old) => ({ ...old, settings: { ...old.settings, ...values } })); }
  function setSlide(key, value) { setSettings({ slides: settings.slides.map((item, index) => index === current ? { ...item, [key]: value } : item) }); }
  function openProject(project) {
    if (busy) return;
    if (dirty && !window.confirm('Descartar as alterações não salvas?')) return;
    const next = copy(project); setRecord(next); setSaved(JSON.stringify(next)); setCurrent(0); setView('editor'); setError('');
  }
  function newProject() {
    if (busy) return;
    if (dirty && !window.confirm('Descartar as alterações não salvas?')) return;
    setRecord({ id: null, title: 'Novo conteúdo', status: 'DRAFT', settings: copy(DEFAULT_CONTENT) }); setSaved(''); setCurrent(0); setView('editor'); setError('');
  }
  function resizeSlides(count) {
    if (count < settings.slides.length && !window.confirm('Remover os slides excedentes?')) return;
    setSettings({ slides: Array.from({ length: count }, (_, index) => settings.slides[index] || emptySlide()) });
    setCurrent((index) => Math.min(index, count - 1));
  }
  function moveSlide(direction) {
    const destination = current + direction;
    if (destination < 0 || destination >= settings.slides.length) return;
    const slides = [...settings.slides]; [slides[current], slides[destination]] = [slides[destination], slides[current]];
    setSettings({ slides }); setCurrent(destination);
  }
  async function saveProject() {
    if (busy) return;
    if (!record.title.trim()) { setError('Preencha o nome do conteúdo.'); return; }
    setBusy(true); setError('');
    try {
      const payload = { title: record.title, status: record.status, settings };
      const { data } = record.id ? await api.put(`/content/${record.id}`, payload) : await api.post('/content', payload);
      setRecord(data); setSaved(JSON.stringify(data)); setProjects((items) => [data, ...items.filter((item) => item.id !== data.id)]);
    } catch (failure) { setError(failure.response?.data?.error || 'Não foi possível salvar o conteúdo.'); }
    finally { setBusy(false); }
  }
  async function deleteProject(project) {
    if (busy) return;
    if (!window.confirm(`Excluir o conteúdo "${project.title}"?`)) return;
    setBusy(true);
    try { await api.delete(`/content/${project.id}`); await loadProjects(); if (record.id === project.id) { setRecord({ id: null, title: 'Novo conteúdo', status: 'DRAFT', settings: copy(DEFAULT_CONTENT) }); setSaved(''); setCurrent(0); } }
    catch { setError('Não foi possível excluir o conteúdo.'); }
    finally { setBusy(false); }
  }
  async function download(all) {
    if (busy) return;
    if ((studio.logoUrl || firm?.logoUrl) && !logo) { setError('Aguarde o carregamento da logo do escritório antes de exportar.'); return; }
    setBusy(true); setError('');
    try {
      const { background, lightLogo } = await loadContentAssets();
      const name = record.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase() || 'conteudo';
      let blob;
      if (all && settings.slides.length > 1) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (let index = 0; index < settings.slides.length; index += 1) {
          const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
          drawContent(canvas, settings, index, firm?.name, logo, background, lightLogo);
          zip.file(`${name}-${String(index + 1).padStart(2, '0')}.png`, await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')));
        }
        blob = await zip.generateAsync({ type: 'blob' });
      } else { drawContent(canvasRef.current, settings, current, firm?.name, logo, background, lightLogo); blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png')); }
      if (!blob) throw new Error('Imagem indisponivel');
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = all && settings.slides.length > 1 ? `${name}.zip` : `${name}-slide-${current + 1}.png`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError('Não foi possível exportar. Confira a logo e tente novamente.'); }
    finally { setBusy(false); }
  }
  async function uploadStudioLogo(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('A logo deve ter no máximo 2 MB.'); return; }
    setBusy(true); setError('');
    try { const form = new FormData(); form.append('file', file); const { data } = await api.post('/content/settings/logo', form); setStudio((current) => ({ ...current, logoUrl: data.logoUrl })); }
    catch (failure) { setError(failure.response?.data?.error || 'Não foi possível atualizar a logo dos conteúdos.'); }
    finally { setBusy(false); }
  }
  if (!allowed) return <div className="p-8">Esta área está disponível para a equipe do escritório. <Link to="/">Voltar</Link></div>;

  return <div className="min-h-screen bg-white text-[#3f4548]">
    <NiboRail /><StudioMenu />
    <main className="ml-[46px] xl:ml-[282px]">
      <FirmHeader className="px-6" />
      <div className="flex h-12 gap-10 border-b px-6 text-sm">{[['editor', 'Criar conteúdo'], ['library', 'Biblioteca']].map(([value, label]) => <button key={value} onClick={() => setView(value)} className={`border-b-2 px-1 ${view === value ? 'border-[#003f82] font-semibold' : 'border-transparent'}`}>{label}</button>)}</div>
      <section className="p-3 md:p-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Conteúdos</h1><div className="flex items-center gap-3"><button onClick={newProject} disabled={busy} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><FilePlus2 size={16} /> Novo conteúdo</button>{view === 'editor' && <button onClick={saveProject} disabled={busy || loading} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-4 py-2 text-sm text-white disabled:opacity-50"><Save size={16} />{busy ? 'Aguarde...' : 'Salvar'}</button>}</div></header>
        {error && <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button title="Fechar aviso" onClick={() => setError('')}><X size={16} /></button></div>}
        {view === 'editor' ? <>
          <div className="mb-5 flex flex-wrap items-end gap-4"><Field label="Nome do conteúdo *"><input disabled={busy} maxLength={160} value={record.title} onChange={(event) => setRecord({ ...record, title: event.target.value })} className={`${inputClass} min-w-[220px]`} /></Field><Field label="Status"><select disabled={busy} value={record.status} onChange={(event) => setRecord({ ...record, status: event.target.value })} className={inputClass}><option value="DRAFT">Rascunho</option><option value="READY">Pronto para publicar</option></select></Field><span role="status" className="pb-2 text-xs text-[#68737a]">{!record.id ? 'Ainda não salvo' : dirty ? 'Alterações não salvas' : 'Salvo no sistema'}</span></div>
          <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <fieldset disabled={busy} className="min-w-0 space-y-5 border-y border-[#dfe5e8] bg-[#f8fafb] p-4 lg:max-h-[780px] lg:overflow-y-auto">
              <div className="flex gap-1 rounded border bg-white p-1">{[[1, 'Post único'], [5, 'Carrossel']].map(([count, label]) => <button key={count} onClick={() => resizeSlides(count)} aria-pressed={count === 1 ? settings.slides.length === 1 : settings.slides.length > 1} className={`flex-1 rounded px-2 py-2 text-sm ${(count === 1) === (settings.slides.length === 1) ? 'bg-[#dce5ef] font-semibold' : ''}`}>{label}</button>)}</div>
              {settings.slides.length > 1 && <Field label="Quantidade de slides"><input type="number" min={2} max={10} value={settings.slides.length} onChange={(event) => { const count = Number(event.target.value); if (count >= 2 && count <= 10) resizeSlides(count); }} className={inputClass} /></Field>}
              <Field label="Modelo visual"><select value={settings.template} onChange={(event) => setSettings({ template: event.target.value })} className={inputClass}>{templates.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Fundo"><select value={settings.background || 'organic'} onChange={(event) => setSettings({ background: event.target.value })} className={inputClass}><option value="organic">Orgânico azul</option><option value="plain">Azul liso</option><option value="white">Branco editorial</option></select></Field>
              {settings.background === 'white' && <Field label="Perfil da empresa"><input maxLength={100} value={settings.profileHandle ?? '@youngcontabil'} onChange={(event) => setSettings({ profileHandle: event.target.value })} className={inputClass} /></Field>}
              <button onClick={() => setAiOpen(true)} className="inline-flex w-full items-center justify-center gap-2 rounded bg-[#2693d2] px-3 py-2 text-sm text-white"><Sparkles size={16} /> Gerar com IA</button>
              {user?.role === 'ADMIN' && <div className="flex flex-wrap gap-3 text-xs text-[#16829b]"><button onClick={() => setConnectionOpen(true)} className="inline-flex items-center gap-1"><KeyRound size={14} /> Configurar IA</button><button onClick={() => logoFileRef.current?.click()} className="inline-flex items-center gap-1"><Upload size={14} /> Atualizar logo</button><input ref={logoFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp" className="hidden" onChange={uploadStudioLogo} /></div>}
              <div className="border-t pt-4"><b className="text-sm">Slide {current + 1}</b></div>
              <Field label="Etiqueta"><input value={slide.eyebrow} maxLength={60} onChange={(event) => setSlide('eyebrow', event.target.value)} className={inputClass} /></Field>
              <Field label="Título do slide"><textarea value={slide.headline} maxLength={200} onChange={(event) => setSlide('headline', event.target.value)} rows={3} className={inputClass} /></Field>
              <Field label="Palavras em destaque"><input value={slide.highlight || ''} maxLength={100} onChange={(event) => setSlide('highlight', event.target.value)} className={inputClass} /></Field>
              <Field label="Texto de apoio"><textarea value={slide.body} maxLength={800} onChange={(event) => setSlide('body', event.target.value)} rows={4} className={inputClass} /></Field>
              <Field label="Rodapé"><input value={slide.footer} maxLength={100} onChange={(event) => setSlide('footer', event.target.value)} className={inputClass} /></Field>
              <Field label="Cor de destaque"><input type="color" value={settings.accent} onChange={(event) => setSettings({ accent: event.target.value })} className="mt-2 h-9 w-full cursor-pointer rounded border bg-white p-1" /></Field>
              <Field label={`Tamanho do título · ${settings.fontSize}`}><input type="range" min={48} max={112} step={2} value={settings.fontSize} onChange={(event) => setSettings({ fontSize: Number(event.target.value) })} className="mt-3 w-full accent-[#16829b]" /></Field>
            </fieldset>
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm"><b>Slide {current + 1} de {settings.slides.length}</b><span className="text-[#68737a]">1080 × 1350 · 4:5</span><div className="flex gap-2"><IconButton title="Mover slide para a esquerda" disabled={current === 0 || busy} onClick={() => moveSlide(-1)}><ArrowLeft size={16} /></IconButton><IconButton title="Mover slide para a direita" disabled={current === settings.slides.length - 1 || busy} onClick={() => moveSlide(1)}><ArrowRight size={16} /></IconButton><IconButton title="Duplicar slide" disabled={settings.slides.length >= 10 || busy} onClick={() => { const slides = [...settings.slides]; slides.splice(current + 1, 0, { ...slide }); setSettings({ slides }); setCurrent(current + 1); }}><Copy size={16} /></IconButton><IconButton title="Excluir slide" disabled={settings.slides.length === 1 || busy} onClick={() => { if (window.confirm('Excluir este slide?')) { setSettings({ slides: settings.slides.filter((_, index) => index !== current) }); setCurrent(Math.max(0, current - 1)); } }}><Trash2 size={16} /></IconButton></div></div>
              <div className="flex justify-center border bg-[#eef2f5] p-3"><div className="w-full max-w-[420px]"><ArtCanvas settings={settings} index={current} firm={firm} logo={logo} canvasRef={canvasRef} /></div></div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{settings.slides.map((_, index) => <button key={index} aria-label={`Selecionar slide ${index + 1}`} aria-pressed={current === index} onClick={() => setCurrent(index)} className={`w-[68px] shrink-0 border-2 ${current === index ? 'border-[#2693d2]' : 'border-transparent'}`}><ArtCanvas small settings={settings} index={index} firm={firm} logo={logo} /><span className="block py-1 text-xs">{index + 1}</span></button>)}</div>
              <div className="mt-3 flex flex-wrap gap-3"><button onClick={() => download(false)} disabled={busy || loading || !assetsReady} className="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm text-[#16829b] disabled:opacity-50"><Download size={16} /> Baixar PNG</button>{settings.slides.length > 1 && <button onClick={() => download(true)} disabled={busy || loading || !assetsReady} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-4 py-2 text-sm text-white disabled:opacity-50"><Download size={16} /> Baixar carrossel ZIP</button>}</div>
              <div className="mt-6"><Field label="Legenda da publicação"><textarea disabled={busy} maxLength={5000} rows={4} value={settings.caption} onChange={(event) => setSettings({ caption: event.target.value })} className={inputClass} /></Field></div>
              {settings.reviewNotes && <div className="mt-4 border-l-2 border-amber-400 bg-amber-50 p-3 text-sm"><b>Pontos para revisar</b><p className="mt-1 whitespace-pre-wrap">{settings.reviewNotes}</p></div>}
              {settings.sources?.length > 0 && <div className="mt-4 text-sm"><b>Fontes consultadas</b>{settings.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-words text-[#16829b] underline">{source.title}</a>)}</div>}
            </div>
          </div>
        </> : <>
          <div className="mb-5 flex items-center gap-3"><label className="flex h-10 flex-1 items-center gap-2 rounded border px-3"><Search size={16} /><input aria-label="Buscar conteúdo" placeholder="Buscar conteúdo" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 outline-none" /></label><IconButton title="Atualizar biblioteca" onClick={() => loadProjects().catch(() => setError('Não foi possível atualizar a biblioteca.'))}><RefreshCw size={16} /></IconButton></div>
          {loading ? <p role="status">Carregando...</p> : <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{projects.filter((project) => project.title.toLowerCase().includes(search.toLowerCase())).map((project) => <article key={project.id} className="flex gap-4 rounded border p-4"><button onClick={() => openProject(project)} className="w-24 shrink-0" aria-label={`Abrir ${project.title}`}><ArtCanvas small settings={project.settings} firm={firm} logo={logo} /></button><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{project.title}</h2><p className="mt-2 text-xs text-[#68737a]">{project.settings.slides.length} slide(s) · {project.status === 'READY' ? 'Pronto' : 'Rascunho'}</p><p className="mt-1 text-xs text-[#68737a]">{new Date(project.updatedAt).toLocaleDateString('pt-BR')}</p><div className="mt-4 flex gap-3"><button onClick={() => openProject(project)} className="text-sm text-[#16829b]">Editar</button><IconButton title={`Excluir ${project.title}`} onClick={() => deleteProject(project)}><Trash2 size={16} /></IconButton></div></div></article>)}</div>}
          {!loading && projects.length === 0 && <div className="border-y py-12 text-center"><ImagePlus className="mx-auto mb-3 text-[#16829b]" /><p>Nenhum conteúdo salvo.</p><button onClick={newProject} className="mt-4 inline-flex items-center gap-2 text-[#16829b]"><Plus size={16} /> Criar conteúdo</button></div>}
        </>}
      </section>
    </main>
    {aiOpen && <ContentAiDialog provider={studio.provider} count={settings.slides.length} configured={studio.configured} canConfigure={user?.role === 'ADMIN'} onConnect={() => { setAiOpen(false); setConnectionOpen(true); }} onClose={() => setAiOpen(false)} onApply={(result) => { setRecord((current) => ({ ...current, title: result.title, settings: { ...current.settings, slides: result.slides, caption: result.caption, sources: result.sources, reviewNotes: result.reviewNotes } })); setCurrent(0); setAiOpen(false); }} />}
    {connectionOpen && <AiConnectionDialog provider={studio.provider} customKey={studio.customKey} onClose={() => setConnectionOpen(false)} onConfigured={(configured, customKey, provider) => { setStudio((current) => ({ ...current, configured, customKey, provider })); setConnectionOpen(false); }} />}
  </div>;
}
