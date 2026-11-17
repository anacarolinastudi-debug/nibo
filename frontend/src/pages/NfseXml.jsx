import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Download, FileArchive, KeyRound, RefreshCw, Search, TriangleAlert, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FirmHeader from '../components/FirmHeader';
import NiboRail from '../components/NiboRail';
import ContentMenuLink from '../components/ContentMenuLink';
import {
  downloadNfeXml, downloadNfeZip, downloadNfseXml, downloadNfseZip, listNfeDocuments, syncNfe, listNfseClients, listNfseDocuments, removeClientCertificate, syncNfse, uploadClientCertificate,
} from '../api/nfse';

const TZ = 'America/Cuiaba';
const PAPEIS = [['', 'Todas'], ['EMITIDA', 'Emitidas'], ['RECEBIDA', 'Recebidas'], ['EVENTO', 'Eventos']];
const STATUS_CLASS = {
  SUCESSO: 'bg-emerald-100 text-emerald-700',
  ERRO: 'bg-red-100 text-red-700',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
};
const STATUS_LABEL = { SUCESSO: 'Concluída', ERRO: 'Erro', EM_ANDAMENTO: 'Buscando…' };

function previousMonth() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const money = (value) => (value === null || value === undefined ? '-' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dateBr = (value) => (value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: TZ }) : '-');
const dateTimeBr = (value) => (value ? new Date(value).toLocaleString('pt-BR', { timeZone: TZ }) : '-');
const errorText = (error, fallback) => error.response?.data?.error || fallback;

export default function NfseXml() {
  const { user } = useAuth();
  if (!['ADMIN', 'ACCOUNTANT'].includes(user?.role)) return <Navigate to="/" replace />;
  return <NfseHub />;
}

function NfseHub() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [certFor, setCertFor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [nfeFor, setNfeFor] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => listNfseClients().then(setClients).finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  const busy = clients.some((client) => client.config?.lastSyncStatus === 'EM_ANDAMENTO' || client.config?.nfe?.lastSyncStatus === 'EM_ANDAMENTO');
  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [busy, load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => `${client.name} ${client.cnpj} ${client.code || ''}`.toLowerCase().includes(term));
  }, [clients, query]);

  async function handleSync(client, refazer = false) {
    setNotice('');
    if (refazer && !window.confirm(`Baixar de novo todas as NFS-e de ${client.name} desde o início? As notas não serão duplicadas; os XMLs que faltarem serão recuperados.`)) return;
    try {
      await syncNfse(client.id, { refazer });
      setClients((rows) => rows.map((row) => (row.id === client.id ? { ...row, config: { ...row.config, lastSyncStatus: 'EM_ANDAMENTO', lastSyncError: null } } : row)));
    } catch (error) {
      setNotice(errorText(error, 'Não foi possível iniciar a busca.'));
    }
  }

  async function handleNfeSync(client) {
    setNotice('');
    try {
      await syncNfe(client.id);
      setClients((rows) => rows.map((row) => (row.id === client.id ? { ...row, config: { ...row.config, nfe: { ...row.config.nfe, lastSyncStatus: 'EM_ANDAMENTO', lastSyncError: null } } } : row)));
    } catch (error) {
      setNotice(errorText(error, 'Não foi possível iniciar a busca de NF-e.'));
    }
  }

  const withCert = clients.filter((client) => client.config).length;

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
    <main className="ml-[46px] flex min-h-screen min-w-0 flex-col xl:ml-[282px]">
      <FirmHeader />
      <section className="min-w-0 flex-1 p-3 md:p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/" className="mb-2 inline-block text-sm text-[#16829b] xl:hidden">Voltar para obrigacoes</Link>
            <h1 className="text-2xl font-semibold">XML de NFS-e</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#68737a]">
              Busca as NFS-e emitidas e recebidas de cada empresa direto no Ambiente de Dados Nacional, com o certificado digital da própria empresa. Roda sozinho todo dia às 5h e não pede captcha.
            </p>
          </div>
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-[#16829b] hover:bg-[#f4f7fb]"><RefreshCw size={16} aria-hidden="true" /> Atualizar</button>
        </header>

        {notice && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative block w-full max-w-sm">
            <span className="sr-only">Buscar cliente</span>
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa5ad]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, CNPJ ou código" className="w-full rounded border border-[#d8dfe3] py-2 pl-9 pr-3 text-sm" />
          </label>
          <span className="text-sm text-[#68737a]">{withCert} de {clients.length} empresas com certificado cadastrado</span>
        </div>

        {loading ? <p className="py-10 text-center text-[#78838a]">Carregando…</p> : (
          <div className="overflow-x-auto rounded border border-[#dfe5e8]">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#f3f3f3]">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Certificado</th>
                  <th className="px-4 py-3">Última busca</th>
                  <th className="px-4 py-3">XMLs NFS-e</th>
                  <th className="px-4 py-3">NF-e recebidas</th>
                  <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => <ClientRow key={client.id} client={client} onCert={() => setCertFor(client)} onSync={() => handleSync(client)} onRedo={() => handleSync(client, true)} onOpen={() => setSelected(client)} onNfeSync={() => handleNfeSync(client)} onNfeOpen={() => setNfeFor(client)} />)}
                {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#78838a]">Nenhuma empresa encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
    {certFor && <CertificateDialog client={certFor} onClose={() => setCertFor(null)} onSaved={() => { setCertFor(null); load(); }} />}
    {selected && <DocumentsDialog client={selected} onClose={() => setSelected(null)} />}
    {nfeFor && <NfeDialog client={nfeFor} onClose={() => setNfeFor(null)} />}
  </div>;
}

function ClientRow({ client, onCert, onSync, onRedo, onOpen, onNfeSync, onNfeOpen }) {
  const nfe = client.config?.nfe;
  const config = client.config;
  const status = config?.lastSyncStatus;
  return <tr className="border-t border-[#dfe5e8] align-top">
    <td className="px-4 py-3">
      <b>{client.code ? `${client.code} - ` : ''}{client.name}</b>
      <p className="text-xs text-[#78838a]">{client.cnpj}</p>
    </td>
    <td className="px-4 py-3">
      {!config && <span className="text-xs text-[#9aa5ad]">Não cadastrado</span>}
      {config && <>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${config.expired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{config.expired ? 'Vencido' : 'Válido'}</span>
        <p className="mt-1 text-xs text-[#78838a]">até {dateBr(config.validUntil)}</p>
      </>}
    </td>
    <td className="px-4 py-3">
      {status ? <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status] || ''}`}>{STATUS_LABEL[status] || status}</span> : <span className="text-xs text-[#9aa5ad]">Nunca buscado</span>}
      {config?.lastSyncAt && <p className="mt-1 text-xs text-[#78838a]">{dateTimeBr(config.lastSyncAt)}{status === 'SUCESSO' ? ` · ${config.lastSyncCount || 0} novo(s)` : ''}</p>}
      {status === 'ERRO' && <p className="mt-1 max-w-sm text-xs text-red-600">{config.lastSyncError}</p>}
    </td>
    <td className="px-4 py-3">{client.documents}</td>
    <td className="px-4 py-3">
      {nfe?.lastSyncStatus ? <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[nfe.lastSyncStatus] || ''}`}>{STATUS_LABEL[nfe.lastSyncStatus] || nfe.lastSyncStatus}</span> : <span className="text-xs text-[#9aa5ad]">Nunca buscado</span>}
      <p className="mt-1 text-xs text-[#78838a]">{client.nfeDocuments} doc(s){nfe?.lastSyncAt ? ` · ${dateTimeBr(nfe.lastSyncAt)}` : ''}</p>
      {nfe?.lastSyncError && <p className={`mt-1 max-w-xs text-xs ${nfe.lastSyncStatus === 'ERRO' ? 'text-red-600' : 'text-amber-700'}`}>{nfe.lastSyncError}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onNfeSync} disabled={!client.config || client.config.expired || nfe?.lastSyncStatus === 'EM_ANDAMENTO'} className="rounded bg-[#2693d2] px-2 py-1 text-xs text-white disabled:opacity-50">Buscar NF-e</button>
        <button type="button" onClick={onNfeOpen} disabled={!client.nfeDocuments} className="rounded border border-[#2693d2] px-2 py-1 text-xs text-[#16829b] disabled:opacity-50">Ver NF-e</button>
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCert} className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-[#f4f7fb]"><KeyRound size={14} aria-hidden="true" /> {config ? 'Trocar certificado' : 'Enviar certificado'}</button>
        <button type="button" onClick={onSync} disabled={!config || config.expired || status === 'EM_ANDAMENTO'} className="rounded bg-[#2693d2] px-3 py-1.5 text-xs text-white disabled:opacity-50">{status === 'EM_ANDAMENTO' ? 'Buscando…' : 'Buscar agora'}</button>
        <button type="button" onClick={onOpen} disabled={!client.documents} className="rounded border border-[#2693d2] px-3 py-1.5 text-xs text-[#16829b] disabled:opacity-50">Ver notas</button>
      </div>
      {config && client.documents > 0 && !config.expired && status !== 'EM_ANDAMENTO' && (
        <div className="mt-1 text-right"><button type="button" onClick={onRedo} className="text-xs text-[#16829b] hover:underline">Baixar tudo de novo</button></div>
      )}
    </td>
  </tr>;
}

function Dialog({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`mt-10 w-full rounded bg-white shadow-xl ${wide ? 'max-w-5xl' : 'max-w-md'}`}>
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 hover:bg-[#f4f7fb]"><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>;
}

function CertificateDialog({ client, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!file || !passphrase) { setError('Escolha o arquivo .pfx e informe a senha.'); return; }
    setSaving(true);
    setError('');
    try {
      await uploadClientCertificate(client.id, file, passphrase);
      onSaved();
    } catch (err) {
      setError(errorText(err, 'Não foi possível salvar o certificado.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remover o certificado de ${client.name}? Os XMLs já baixados continuam salvos.`)) return;
    await removeClientCertificate(client.id);
    onSaved();
  }

  return <Dialog title={`Certificado de ${client.name}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4 p-5 text-sm">
      <p className="text-[#68737a]">Use o certificado e-CNPJ (A1, arquivo .pfx) <b>da própria empresa</b>. Ele e a senha ficam guardados criptografados e só são usados para consultar o ADN.</p>
      {client.config && <p className="rounded bg-[#f4f7fb] px-3 py-2 text-xs">Atual: {client.config.subject} · válido até {dateBr(client.config.validUntil)}</p>}
      <label className="block">
        <span className="mb-1 block font-medium">Arquivo do certificado (.pfx ou .p12)</span>
        <input type="file" accept=".pfx,.p12" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Senha do certificado</span>
        <input type="password" autoComplete="off" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className="w-full rounded border border-[#d8dfe3] px-3 py-2" />
      </label>
      {error && <p role="alert" className="flex gap-2 rounded bg-red-50 px-3 py-2 text-red-700"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
      <div className="flex items-center justify-between gap-2 pt-2">
        {client.config ? <button type="button" onClick={remove} className="text-xs text-red-600 hover:underline">Remover certificado</button> : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded bg-[#2693d2] px-4 py-2 text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </form>
  </Dialog>;
}

function DocumentsDialog({ client, onClose }) {
  const [mes, setMes] = useState(previousMonth());
  const [papel, setPapel] = useState('');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    listNfseDocuments(client.id, { mes, papel: papel || undefined })
      .then(setDocs)
      .catch((err) => setError(errorText(err, 'Não foi possível carregar as notas.')))
      .finally(() => setLoading(false));
  }, [client.id, mes, papel]);

  const notas = docs.filter((doc) => doc.tipoDocumento === 'NFSE');
  const totalOf = (papelNota) => notas.filter((doc) => doc.papel === papelNota && !doc.cancelada).reduce((sum, doc) => sum + (doc.valorServico || 0), 0);
  const emitidas = notas.filter((doc) => doc.papel === 'EMITIDA');
  const recebidas = notas.filter((doc) => doc.papel === 'RECEBIDA');

  async function zip() {
    setError('');
    try { await downloadNfseZip(client.id, { mes, papel: papel || undefined }, client.name); } catch (err) {
      if (err.response?.status === 404) setError('Nenhum XML para esse filtro.');
      else if (err.response?.status === 410) setError('Os XMLs deste mês não estão mais no armazenamento. Feche e use "Baixar tudo de novo" na linha da empresa.');
      else setError('Não foi possível gerar o ZIP.');
    }
  }

  return <Dialog title={`NFS-e de ${client.name}`} onClose={onClose} wide>
    <div className="p-5 text-sm">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label><span className="mb-1 block text-xs font-medium">Competência</span><input type="month" value={mes} onChange={(event) => setMes(event.target.value)} className="rounded border border-[#d8dfe3] px-3 py-2" /></label>
        <label><span className="mb-1 block text-xs font-medium">Tipo</span>
          <select value={papel} onChange={(event) => setPapel(event.target.value)} className="rounded border border-[#d8dfe3] px-3 py-2">
            {PAPEIS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" onClick={zip} disabled={!docs.length} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-4 py-2 text-white disabled:opacity-50"><FileArchive size={16} aria-hidden="true" /> Baixar ZIP do mês</button>
        <div className="ml-auto text-right text-[#68737a]">
          {emitidas.length > 0 && <p>Emitidas: {emitidas.length} · <b className="text-[#3f4548]">{money(totalOf('EMITIDA'))}</b></p>}
          {recebidas.length > 0 && <p>Recebidas: {recebidas.length} · <b className="text-[#3f4548]">{money(totalOf('RECEBIDA'))}</b></p>}
          {notas.some((doc) => doc.cancelada) && <p className="text-xs">Totais sem as canceladas</p>}
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      <div className="max-h-[60vh] overflow-auto rounded border border-[#dfe5e8]">
        <table className="w-full min-w-[760px] text-left">
          <thead className="sticky top-0 bg-[#f3f3f3]">
            <tr><th className="px-3 py-2">Nº</th><th className="px-3 py-2">Emissão</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Contraparte</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2"><span className="sr-only">XML</span></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#78838a]">Carregando…</td></tr>}
            {!loading && docs.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#78838a]">Nenhum documento nessa competência.</td></tr>}
            {!loading && docs.map((doc) => {
              const other = doc.papel === 'EMITIDA' ? [doc.tomadorNome, doc.tomadorDoc] : [doc.emitenteNome, doc.emitenteDoc];
              return <tr key={doc.id} className={`border-t border-[#dfe5e8] ${doc.cancelada ? 'text-[#9aa5ad] line-through' : ''}`}>
                <td className="px-3 py-2">{doc.numero || '-'}</td>
                <td className="px-3 py-2">{dateBr(doc.dataEmissao)}</td>
                <td className="px-3 py-2 no-underline">{doc.tipoDocumento === 'EVENTO' ? doc.eventoDescricao : doc.papel === 'EMITIDA' ? 'Emitida' : doc.papel === 'RECEBIDA' ? 'Recebida' : 'Intermediário'}{doc.cancelada && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] text-red-700">cancelada</span>}</td>
                <td className="px-3 py-2">{doc.tipoDocumento === 'EVENTO' ? <span className="text-xs">{doc.chaveAcesso}</span> : <>{other[0] || '-'}<span className="block text-xs text-[#78838a]">{other[1] || ''}</span></>}</td>
                <td className="px-3 py-2 text-right">{doc.tipoDocumento === 'EVENTO' ? '' : money(doc.valorServico)}</td>
                <td className="px-3 py-2 text-right"><button type="button" onClick={() => downloadNfseXml(doc.id, `${doc.chaveAcesso}.xml`)} aria-label={`Baixar XML da nota ${doc.numero || doc.chaveAcesso}`} className="rounded p-1 text-[#16829b] hover:bg-[#f4f7fb]"><Download size={16} /></button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  </Dialog>;
}

const CIENCIA_LABEL = { PENDENTE: 'aguardando Ciência', ENVIADA: 'Ciência registrada, XML completo na próxima busca', ERRO: 'Ciência recusada' };

function NfeDialog({ client, onClose }) {
  const [mes, setMes] = useState(previousMonth());
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    listNfeDocuments(client.id, { mes })
      .then(setDocs)
      .catch((err) => setError(errorText(err, 'Não foi possível carregar as NF-e.')))
      .finally(() => setLoading(false));
  }, [client.id, mes]);

  // Quando a nota completa já chegou, o resumo da mesma chave não precisa aparecer.
  const completas = new Set(docs.filter((doc) => doc.tipo === 'NFE').map((doc) => doc.chaveAcesso));
  const visiveis = docs.filter((doc) => !(doc.tipo === 'RESUMO' && completas.has(doc.chaveAcesso)));
  const notas = visiveis.filter((doc) => doc.tipo !== 'EVENTO');
  const total = notas.filter((doc) => !doc.cancelada).reduce((sum, doc) => sum + (doc.valorTotal || 0), 0);
  const resumos = notas.filter((doc) => doc.tipo === 'RESUMO').length;

  async function zip() {
    setError('');
    try { await downloadNfeZip(client.id, { mes }, client.name); } catch (err) {
      setError(err.response?.status === 404 ? 'Nenhuma NF-e completa nesse mês (resumos não entram no ZIP).' : 'Não foi possível gerar o ZIP.');
    }
  }

  return <Dialog title={`NF-e recebidas de ${client.name}`} onClose={onClose} wide>
    <div className="p-5 text-sm">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label><span className="mb-1 block text-xs font-medium">Mês de emissão</span><input type="month" value={mes} onChange={(event) => setMes(event.target.value)} className="rounded border border-[#d8dfe3] px-3 py-2" /></label>
        <button type="button" onClick={zip} disabled={!notas.length} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-4 py-2 text-white disabled:opacity-50"><FileArchive size={16} aria-hidden="true" /> Baixar ZIP do mês</button>
        <div className="ml-auto text-right text-[#68737a]">
          <p>{notas.length} nota(s) · <b className="text-[#3f4548]">{money(total)}</b></p>
          {resumos > 0 && <p className="text-xs">{resumos} ainda só em resumo</p>}
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      <div className="max-h-[60vh] overflow-auto rounded border border-[#dfe5e8]">
        <table className="w-full min-w-[760px] text-left">
          <thead className="sticky top-0 bg-[#f3f3f3]">
            <tr><th className="px-3 py-2">Nº</th><th className="px-3 py-2">Emissão</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2"><span className="sr-only">XML</span></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#78838a]">Carregando…</td></tr>}
            {!loading && visiveis.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#78838a]">Nenhuma NF-e nesse mês.</td></tr>}
            {!loading && visiveis.map((doc) => <tr key={doc.id} className={`border-t border-[#dfe5e8] ${doc.cancelada ? 'text-[#9aa5ad] line-through' : ''}`}>
              <td className="px-3 py-2">{doc.numero || '-'}</td>
              <td className="px-3 py-2">{dateBr(doc.dataEmissao)}</td>
              <td className="px-3 py-2">{doc.tipo === 'EVENTO' ? <span className="text-xs">{doc.chaveAcesso}</span> : <>{doc.emitenteNome || '-'}<span className="block text-xs text-[#78838a]">{doc.emitenteDoc || ''}</span></>}</td>
              <td className="px-3 py-2 text-xs">
                {doc.tipo === 'EVENTO' ? doc.eventoDescricao : doc.tipo === 'NFE' ? 'XML completo' : (CIENCIA_LABEL[doc.ciencia] || 'Resumo')}
                {doc.ciencia === 'ERRO' && doc.cienciaErro && <span className="block text-red-600">{doc.cienciaErro}</span>}
                {doc.cancelada && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] text-red-700">cancelada</span>}
              </td>
              <td className="px-3 py-2 text-right">{doc.tipo === 'EVENTO' ? '' : money(doc.valorTotal)}</td>
              <td className="px-3 py-2 text-right"><button type="button" onClick={() => downloadNfeXml(doc.id, `${doc.chaveAcesso}.xml`)} aria-label={`Baixar XML da NF-e ${doc.numero || doc.chaveAcesso}`} className="rounded p-1 text-[#16829b] hover:bg-[#f4f7fb]"><Download size={16} /></button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[#78838a]">A SEFAZ entrega primeiro um resumo. O sistema registra a Ciência da Operação (não é confirmação da compra) e o XML completo chega na busca seguinte. Notas emitidas pela própria empresa não vêm por aqui.</p>
    </div>
  </Dialog>;
}
