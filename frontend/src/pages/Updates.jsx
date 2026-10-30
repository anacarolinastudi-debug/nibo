import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bookmark, Check, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search, Sparkles } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FirmHeader from '../components/FirmHeader';
import NiboRail from '../components/NiboRail';
import ContentMenuLink from '../components/ContentMenuLink';

const areas = { FISCAL: 'Fiscal', TRIBUTARIO: 'Tributario', TRABALHISTA: 'Trabalhista', PREVIDENCIARIO: 'Previdenciario', CONTABIL: 'Contabil', SPED: 'SPED', REFORMA_TRIBUTARIA: 'Reforma tributaria', SIMPLES_NACIONAL: 'Simples Nacional', GERAL: 'Geral' };
const scopes = { FEDERAL: 'Federal', ESTADUAL: 'Estadual', MUNICIPAL: 'Municipal', NACIONAL: 'Nacional' };
const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const empty = { q: '', area: '', uf: '', scope: '', source: '', from: '', to: '', read: 'all', bookmarked: false };
const input = 'mt-1 w-full min-w-0 rounded border border-[#d8dfe3] bg-white px-3 py-2 text-sm';
const sourceStates = { OK: 'Disponivel', EMPTY: 'Nenhum registro retornado', ERROR: 'Falha na fonte', PENDING: 'Pendente' };
function date(value, dateOnly = false) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Nao informado';
  return dateOnly ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' }) : new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
}
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function IconButton({ label, children, ...props }) {
  return <button type="button" aria-label={label} title={label} {...props} className="grid h-9 w-9 shrink-0 place-items-center rounded border border-[#d8dfe3] text-[#16829b] hover:bg-[#eef8fc] focus-visible:outline focus-visible:outline-2 disabled:opacity-40">{children}</button>;
}
function Field({ label, children }) { return <label className="min-w-0 text-sm">{label}{children}</label>; }

export default function Updates() {
  const { user } = useAuth();
  if (!['ADMIN', 'ACCOUNTANT'].includes(user?.role)) return <Navigate to="/" replace />;
  return <UpdatesHub key={user.id} />;
}

function UpdatesHub() {
  const [view, setView] = useState('NEWS');
  const [draft, setDraft] = useState(empty);
  const [filters, setFilters] = useState(empty);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ items: [], total: 0, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [online, setOnline] = useState(null);
  const [onlineError, setOnlineError] = useState('');
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [actionError, setActionError] = useState('');
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [statusEpoch, setStatusEpoch] = useState(0);
  const [pollPaused, setPollPaused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [pending, setPending] = useState(null);
  const listSequence = useRef(0);
  const actionLock = useRef(false);
  const refreshLock = useRef(false);
  const life = useRef(null);
  const kind = view === 'LEGISLATION' ? 'LEGISLATION' : 'NEWS';

  useEffect(() => {
    const controller = new AbortController(); life.current = controller;
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++listSequence.current;
    setLoading(true); setListError(''); setOnline(null); setOnlineError(''); setSearchingOnline(false);
    const params = { ...filters, kind, page };
    Object.keys(params).forEach(key => { if (params[key] === '' || params[key] === false) delete params[key]; });
    async function load() {
      let { data } = await api.get('/updates/articles', { params, signal: controller.signal });
      if (controller.signal.aborted || sequence !== listSequence.current) return;
      if (data.online) setOnline(data.online);
      const eligible = !data.total && !data.online && page === 1 && view !== 'SOURCES' && filters.q.trim().length >= 2 && !filters.bookmarked && filters.read !== 'read';
      if (eligible) {
        setSearchingOnline(true);
        try {
          const response = await api.post('/updates/search', params, { signal: controller.signal, timeout: 95000 });
          if (controller.signal.aborted || sequence !== listSequence.current) return;
          setOnline(response.data);
          if (response.data.discovered || response.data.status === 'LOCAL') data = (await api.get('/updates/articles', { params, signal: controller.signal })).data;
        } catch (error) {
          if (!controller.signal.aborted && sequence === listSequence.current) setOnlineError(error.response?.data?.error || 'Nao foi possivel atualizar o acervo. Tente novamente mais tarde.');
        } finally { if (!controller.signal.aborted && sequence === listSequence.current) setSearchingOnline(false); }
      }
      if (controller.signal.aborted || sequence !== listSequence.current) return;
      const pages = Math.max(1, Math.ceil(data.total / (data.pageSize || 20)));
      if (page > pages) { setPage(pages); return; }
      setResult(data);
    }
    load().catch(() => {
      if (!controller.signal.aborted && sequence === listSequence.current) setListError('Nao foi possivel carregar as atualizacoes.');
    }).finally(() => { if (!controller.signal.aborted && sequence === listSequence.current) setLoading(false); });
    return () => controller.abort();
  }, [filters, kind, view, page, revision]);

  useEffect(() => {
    const controller = new AbortController();
    let timer, attempts = 0, wasRunning = false;
    setStatusError(''); setPollPaused(false);
    async function check() {
      try {
        const { data } = await api.get('/updates/status', { signal: controller.signal });
        if (controller.signal.aborted) return;
        setStatus(data);
        if (data.state === 'RUNNING') {
          wasRunning = true;
          if (++attempts < 30) timer = window.setTimeout(check, 2000);
          else setPollPaused(true);
        } else if (wasRunning) setRevision(value => value + 1);
      } catch {
        if (!controller.signal.aborted) setStatusError('Nao foi possivel consultar as fontes.');
      }
    }
    check();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [statusEpoch]);

  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const timer = window.setTimeout(() => setCooldownUntil(0), Math.max(0, cooldownUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [cooldownUntil]);

  async function refresh() {
    if (refreshLock.current || cooldownUntil || status?.state === 'RUNNING') return;
    refreshLock.current = true; setRefreshing(true); setActionError('');
    const signal = life.current.signal;
    try {
      const { data } = await api.post('/updates/refresh', {}, { signal });
      if (signal.aborted) return;
      setStatus(old => ({ ...old, state: data.state }));
    } catch (error) {
      if (signal.aborted) return;
      if (error.response?.status === 429) {
        const retry = error.response.headers?.['retry-after'];
        const seconds = Number(retry);
        const wait = retry && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now();
        setCooldownUntil(Date.now() + (Number.isFinite(wait) && wait > 0 ? Math.min(wait, 86400000) : 60000));
        setActionError(error.response?.data?.error || 'Aguarde para atualizar novamente.');
      } else setActionError('Nao foi possivel solicitar a atualizacao. Tente novamente.');
    } finally {
      if (!signal.aborted) {
        refreshLock.current = false; setRefreshing(false);
        setRevision(value => value + 1); setStatusEpoch(value => value + 1);
      }
    }
  }

  async function toggle(article, field) {
    if (actionLock.current) return;
    actionLock.current = true; setPending(article.id); setActionError('');
    ++listSequence.current;
    const signal = life.current.signal;
    try {
      const { data } = await api.patch(`/updates/articles/${encodeURIComponent(article.id)}/state`, { [field]: !article[field] }, { signal });
      if (!signal.aborted) setResult(old => ({ ...old, items: old.items.map(item => item.id === article.id ? { ...item, read: data.read, bookmarked: data.bookmarked } : item) }));
    } catch { if (!signal.aborted) setActionError('Nao foi possivel salvar sua marcacao. Tente novamente.'); }
    finally { if (!signal.aborted) { actionLock.current = false; setPending(null); setRevision(value => value + 1); } }
  }

  function changeView(next) { setView(next); setPage(1); }
  function apply(event) { event.preventDefault(); setFilters({ ...draft }); setPage(1); }
  function select(key, label, values) {
    return <Field label={label}><select aria-label={label} className={input} value={draft[key]} onChange={event => setDraft(old => ({ ...old, [key]: event.target.value }))}><option value="">Todas</option>{Object.entries(values).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>;
  }
  const sources = status?.sources || [];
  const totalPages = Math.max(1, Math.ceil(result.total / (result.pageSize || 20)));
  return <div className="min-h-screen bg-white text-[#3f4548]">
    <NiboRail />
    <aside className="fixed inset-y-0 left-[46px] hidden w-[236px] flex-col border-r bg-[#f4f7fb] xl:flex">
      <div className="flex h-[58px] items-center border-b px-5 text-xl">Contador</div>
      <nav aria-label="Menu do escritorio" className="overflow-y-auto p-5 text-sm text-[#68737a]">
        <p className="mb-4 text-xs">OPERACAO</p>
        {[['/', 'Obrigacoes'], ['/demandas', 'Tarefas & Processos'], ['/relacionamento', 'Relacionamento'], ['/financeiro', 'Financeiro']].map(([to, label]) => <Link key={to} to={to} className="mb-4 block px-3 py-2">{label}</Link>)}
        <ContentMenuLink /><Link to="/clientes" className="block px-3 py-2">Clientes</Link><Link to="/configuracoes" className="block px-3 py-2">Configuracoes</Link>
      </nav>
    </aside>
    <main className="ml-[46px] min-w-0 xl:ml-[282px]">
      <FirmHeader />
      <section className="min-w-0 p-3 md:p-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div><Link to="/" className="mb-2 inline-block text-sm text-[#16829b] xl:hidden">Voltar para obrigacoes</Link><h1 className="text-2xl font-semibold">Atualizacoes contabeis</h1><p className="mt-1 text-sm text-[#68737a]">Noticias e legislacao de portais contabeis e orgaos oficiais</p></div>
          <button type="button" onClick={refresh} disabled={refreshing || !!cooldownUntil || status?.state === 'RUNNING'} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={16} className={refreshing || status?.state === 'RUNNING' ? 'animate-spin' : ''} /> Atualizar fontes</button>
        </header>
        <div className="mb-4 space-y-1 border-y bg-[#f8fafb] px-3 py-3 text-xs text-[#68737a]" aria-live="polite">
          <p>Ultima tentativa: {date(status?.lastAttemptAt)} · Ultima conclusao: {date(status?.lastCompletedAt)}</p>
          <p>Proxima coleta: {status?.nextSchedule === '07:00' ? 'Diariamente as 07:00' : date(status?.nextSchedule)} · {status?.timeZone || 'America/Cuiaba'}</p>
          {!status && !statusError && <p>Consultando fontes...</p>}
          {status?.state === 'RUNNING' && <p>Atualizacao em andamento</p>}
          {['ERROR', 'FAILED'].includes(status?.state) && <p className="text-red-700">A ultima atualizacao falhou. O historico foi preservado.</p>}
          {status?.state === 'PARTIAL' && <p className="text-amber-800">Atualizacao parcial. Algumas fontes falharam; o historico foi preservado.</p>}
          {(status?.state === 'COOLDOWN' || cooldownUntil > 0) && <p className="text-amber-800">Intervalo entre atualizacoes. {cooldownUntil ? `Disponivel apos ${date(cooldownUntil)}.` : 'Aguarde antes de solicitar novamente.'}</p>}
          {pollPaused && <p>A consulta automatica foi pausada. <button onClick={() => setStatusEpoch(value => value + 1)} className="underline">Consultar andamento</button></p>}
        </div>
        {(actionError || statusError) && <div role="alert" className="mb-4 border-l-2 border-red-400 bg-red-50 p-3 text-sm text-red-800">{actionError && <p>{actionError}</p>}{statusError && <p>{statusError} <button className="underline" onClick={() => setStatusEpoch(value => value + 1)}>Consultar novamente</button></p>}</div>}
        <div role="tablist" aria-label="Atualizacoes" className="mb-5 flex border-b text-sm">
          {[['NEWS', 'Noticias'], ['LEGISLATION', 'Legislacao'], ['SOURCES', 'Fontes']].map(([value, label]) => <button key={value} id={`tab-${value}`} role="tab" aria-selected={view === value} aria-controls="updates-panel" onClick={() => changeView(value)} className={`border-b-2 px-3 py-3 ${view === value ? 'border-[#16829b] font-semibold text-[#16829b]' : 'border-transparent'}`}>{label}</button>)}
        </div>
        <div id="updates-panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
          {view === 'SOURCES' ? <>
            <h2 className="mb-2 text-lg font-semibold">Cobertura e situacao das fontes</h2>
            <p className="mb-4 text-sm text-[#68737a]">Cobertura limitada as fontes listadas. Nao representa monitoramento completo de estados ou municipios.</p>
            {!sources.length && <p className="py-6 text-sm">{status ? 'Nenhuma fonte informada.' : 'Aguardando situacao das fontes.'}</p>}
            <div className="divide-y border-y">{sources.map(source => <section key={source.id} className="py-4 text-sm [overflow-wrap:anywhere]">
              <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{source.name}</h3><span className={source.status === 'ERROR' ? 'text-red-700' : source.status === 'OK' ? 'text-emerald-700' : 'text-[#68737a]'}>{sourceStates[source.status] || source.status}</span></div>
              <p className="mt-1 text-[#68737a]">{scopes[source.scope] || source.scope} {source.uf || ''} · {source.articlesCount ?? 0} registros</p>
              <p className="mt-2 text-xs">Ultima verificacao: {date(source.lastCheckedAt)} · Ultimo sucesso: {date(source.lastSuccessAt)}</p>
              {source.status === 'ERROR' && <p className="mt-2 text-red-700">{source.errorMessage || 'Nao foi possivel consultar esta fonte.'} O historico permanece disponivel.</p>}
              {safeUrl(source.url) && <a href={safeUrl(source.url)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[#16829b]">Visitar fonte <ExternalLink size={14} /></a>}
            </section>)}</div>
          </> : <>
            <form onSubmit={apply} className="mb-5 border-b pb-5">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Busca"><input className={input} value={draft.q} maxLength={200} onChange={event => setDraft(old => ({ ...old, q: event.target.value }))} type="search" /></Field>
                {select('area', 'Area', areas)}{select('uf', 'UF', Object.fromEntries(ufs.map(uf => [uf, uf])))}{select('scope', 'Abrangencia', scopes)}
                {select('source', 'Fonte', Object.fromEntries(sources.map(source => [source.id, source.name])))}
                <Field label="De"><input className={input} type="date" value={draft.from} max={draft.to || undefined} onChange={event => setDraft(old => ({ ...old, from: event.target.value }))} /></Field>
                <Field label="Ate"><input className={input} type="date" value={draft.to} min={draft.from || undefined} onChange={event => setDraft(old => ({ ...old, to: event.target.value }))} /></Field>
                <Field label="Leitura"><select aria-label="Leitura" className={input} value={draft.read} onChange={event => setDraft(old => ({ ...old, read: event.target.value }))}><option value="all">Todas</option><option value="unread">Nao lidas</option><option value="read">Lidas</option></select></Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.bookmarked} onChange={event => setDraft(old => ({ ...old, bookmarked: event.target.checked }))} />Somente favoritos</label><button type="submit" className="inline-flex items-center gap-2 rounded bg-[#16829b] px-3 py-2 text-white"><Search size={16} /> Aplicar filtros</button><button type="button" onClick={() => { setDraft(empty); setFilters(empty); setPage(1); }}>Limpar filtros</button></div>
            </form>
            {onlineError && <div role="alert" className="mb-4 border-l-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"><p>{onlineError}</p></div>}
            {online && <div className="mb-4 border-y py-3 text-sm text-[#68737a]" role="status">
              {online.status === 'COOLDOWN' ? 'O acervo foi consultado. Aguarde um minuto para atualizar as fontes novamente.' : online.status === 'UNSUPPORTED' ? 'Nenhuma fonte cadastrada atende a selecao.' : online.status === 'LOCAL' ? 'Foram encontradas materias ja salvas.' : online.status === 'SKIPPED' ? 'A pesquisa manteve apenas suas marcacoes pessoais.' : <>{online.cached ? 'Consulta recente ao acervo' : 'Consulta as fontes concluida'}: {online.discovered} materia(s) correspondente(s). {online.status === 'PARTIAL' && 'Algumas fontes estao indisponiveis.'}</>}
            </div>}
            {loading ? <p role="status" className="py-8 text-sm">{searchingOnline ? 'Consultando diretamente as fontes cadastradas...' : 'Carregando atualizacoes...'}</p> : listError ? <div role="alert" className="py-6 text-sm text-red-700">{listError} <button onClick={() => setRevision(value => value + 1)} className="underline">Tentar novamente</button></div> : <>
              <p className="mb-3 text-xs text-[#68737a]">{result.total} registros encontrados</p>
              {!result.items.length && <p className="border-y py-10 text-sm text-[#68737a]">Nenhuma atualizacao encontrada para estes filtros.</p>}
              <div className="divide-y border-y">{result.items.map(article => <article key={article.id} className="min-w-0 py-4 [overflow-wrap:anywhere]">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#68737a]"><span>{article.source?.name}</span><span>· {areas[article.area] || article.area}</span><span>· {scopes[article.scope] || article.scope} {(article.ufs || []).join(', ')}</span></div>
                <h2 className={`text-base ${article.read ? 'font-medium text-[#68737a]' : 'font-semibold'}`}>{article.title}</h2>
                <p className="mt-2 text-sm leading-relaxed">{article.summary ? String(article.summary).slice(0, 600) : 'Resumo nao disponibilizado pela fonte.'}</p>
                <p className="mt-2 text-xs text-[#68737a]">{article.publishedAt ? `Publicacao: ${date(article.publishedAt, true)}` : 'Data de publicacao nao informada'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link to={`/conteudos?noticia=${encodeURIComponent(article.id)}`} aria-label={`Criar conteudo com IA: ${article.title}`} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-[#16829b] hover:bg-[#eef8fc]"><Sparkles size={16} />Criar conteudo com IA</Link>
                  <IconButton label={article.read ? 'Marcar como nao lido' : 'Marcar como lido'} aria-pressed={!!article.read} disabled={pending !== null} onClick={() => toggle(article, 'read')}><Check size={16} strokeWidth={article.read ? 3 : 1.5} /></IconButton>
                  <IconButton label={article.bookmarked ? 'Remover favorito' : 'Salvar favorito'} aria-pressed={!!article.bookmarked} disabled={pending !== null} onClick={() => toggle(article, 'bookmarked')}><Bookmark size={16} fill={article.bookmarked ? 'currentColor' : 'none'} /></IconButton>
                  {safeUrl(article.url) ? <a href={safeUrl(article.url)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir original: ${article.title}`} className="ml-1 inline-flex items-center gap-1 text-sm text-[#16829b]">Abrir original <ExternalLink size={14} /></a> : <span className="text-xs text-[#68737a]">Link original indisponivel</span>}
                </div>
              </article>)}</div>
              <nav aria-label="Paginacao" className="mt-4 flex items-center justify-end gap-3 text-sm"><IconButton label="Pagina anterior" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} /></IconButton><span>Pagina {page} de {totalPages}</span><IconButton label="Proxima pagina" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}><ChevronRight size={16} /></IconButton></nav>
            </>}
          </>}
        </div>
      </section>
    </main>
  </div>;
}
