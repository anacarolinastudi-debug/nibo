import React, { useEffect, useMemo, useState } from 'react';
import { FileSignature, Plus, Settings, TriangleAlert, X } from 'lucide-react';
import api from '../api/client';

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateBr = (value) => (value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-');
const errorText = (error, fallback) => error.response?.data?.details?.[0]?.mensagem || error.response?.data?.error || fallback;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
// Aceita "1.320,00", "1320,50" ou "1320.50".
function parseMoney(value) {
  const text = String(value || '').replace(/[^\d,.-]/g, '');
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function Field({ label, value, onChange, type = 'text', required, placeholder, className = '' }) {
  return <label className={`block text-sm ${className}`}>
    <span className="mb-1 block font-medium">{label}{required && <b className="ml-1 text-red-600">*</b>}</span>
    <input type={type} value={value ?? ''} required={required} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3 outline-none focus:border-[#16829b]" />
  </label>;
}

function Drawer({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 bg-black/40" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="absolute inset-y-0 right-0 flex w-[min(900px,94vw)] flex-col bg-white shadow-xl">
      <header className="flex h-16 items-center justify-between border-b px-6"><h2 className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Fechar"><X /></button></header>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
      {footer && <footer className="flex justify-end gap-3 border-t px-6 py-4">{footer}</footer>}
    </div>
  </div>;
}

// A janela é aberta no clique (antes de esperar o servidor) para não ser bloqueada como pop-up.
async function openPdf(id, win = window.open('', '_blank')) {
  try {
    const response = await api.get(`/contracts/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    if (win) win.location.href = url; else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (win) win.close();
    throw error;
  }
}

function SettingsDrawer({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/contracts/settings', { ...form, avisoPrevioDias: Number(form.avisoPrevioDias) || 30 });
      onSaved(data);
    } catch (err) {
      setError(errorText(err, 'Não foi possível salvar.'));
    } finally {
      setSaving(false);
    }
  }
  return <Drawer title="Dados do escritório para contratos" onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded border px-5 py-2">Cancelar</button><button type="button" disabled={saving} onClick={save} className="rounded bg-[#2693d2] px-5 py-2 text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button></>}>
    <p className="mb-5 text-sm text-[#68737a]">Preencha uma vez. Razão social, CNPJ e endereço do escritório vêm de Configurações › Escritório.</p>
    <div className="grid grid-cols-2 gap-5">
      <Field required label="Representante do escritório" value={form.representanteNome} onChange={(v) => set('representanteNome', v)} placeholder="Nome completo" />
      <Field label="Qualificação" value={form.representanteQualificacao} onChange={(v) => set('representanteQualificacao', v)} placeholder="brasileira, contadora" />
      <Field label="CPF do representante" value={form.representanteCpf} onChange={(v) => set('representanteCpf', v)} />
      <Field label="Registro no CRC" value={form.crc} onChange={(v) => set('crc', v)} placeholder="CRC-MT 000000/O-0" />
      <Field label="Estado do CRC" value={form.crcUf} onChange={(v) => set('crcUf', v)} placeholder="Mato Grosso" />
      <Field label="Cidade de assinatura" value={form.cidadeAssinatura} onChange={(v) => set('cidadeAssinatura', v)} />
      <Field label="UF de assinatura" value={form.ufAssinatura} onChange={(v) => set('ufAssinatura', v.toUpperCase().slice(0, 2))} />
      <Field label="Foro (comarca)" value={form.foro} onChange={(v) => set('foro', v)} />
      <Field label="Dias de vencimento dos honorários" value={form.diasPagamento} onChange={(v) => set('diasPagamento', v)} />
      <Field label="Prazo de entrega dos documentos (dia)" value={form.prazoDocumentos} onChange={(v) => set('prazoDocumentos', v)} />
      <Field type="number" label="Aviso prévio para rescisão (dias)" value={form.avisoPrevioDias} onChange={(v) => set('avisoPrevioDias', v)} />
      <label className="flex items-center gap-3 self-end pb-2 text-sm"><input type="checkbox" checked={Boolean(form.honorarioAnual)} onChange={(e) => set('honorarioAnual', e.target.checked)} /> Cobrar honorário adicional anual (dezembro)</label>
    </div>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
  </Drawer>;
}

function NewContractDrawer({ services, onClose, onSaved }) {
  const [cnpj, setCnpj] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [monthlyFee, setMonthlyFee] = useState('');
  const [selected, setSelected] = useState([]);
  const [contratante, setContratante] = useState(null);
  const [info, setInfo] = useState(null);
  const [lookup, setLookup] = useState({ status: 'idle', message: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const digits = cnpj.replace(/\D/g, '');
  const setC = (key, value) => setContratante((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (digits.length !== 14) { setContratante(null); setInfo(null); setLookup({ status: 'idle', message: '' }); return undefined; }
    let active = true;
    setLookup({ status: 'loading', message: 'Buscando os dados do contratante na Receita Federal…' });
    api.get(`/contracts/prefill/${digits}`)
      .then(({ data }) => {
        if (!active) return;
        setCnpj(data.cnpj);
        setContratante(data.contratante);
        setInfo(data);
        const situation = data.situation && data.situation.toUpperCase() !== 'ATIVA' ? ` Atenção: situação na Receita "${data.situation}".` : '';
        setLookup({ status: situation ? 'warn' : 'ok', message: `Dados preenchidos pela Receita Federal${data.client ? ` (cliente ${data.client.code ? `${data.client.code} - ` : ''}${data.client.name})` : ''}. Confira antes de gerar.${situation}` });
      })
      .catch((err) => { if (active) { setContratante({ razaoSocial: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', representanteNome: '', representanteQualificacao: '', representanteCpf: '' }); setLookup({ status: 'error', message: `${errorText(err, 'Não foi possível consultar o CNPJ.')} Preencha os dados abaixo.` }); } });
    return () => { active = false; };
  }, [digits]);

  const toggle = (key) => setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  async function generate() {
    setError('');
    if (digits.length !== 14) { setError('Informe o CNPJ do cliente.'); return; }
    if (parseMoney(monthlyFee) <= 0) { setError('Informe o valor mensal.'); return; }
    if (!selected.length) { setError('Selecione pelo menos um serviço.'); return; }
    setSaving(true);
    const win = window.open('', '_blank');
    try {
      const { data } = await api.post('/contracts', { cnpj, startDate, monthlyFee: parseMoney(monthlyFee), services: selected, contratante });
      await openPdf(data.id, win);
      onSaved();
    } catch (err) {
      if (win && !win.closed) win.close();
      setError(errorText(err, 'Não foi possível gerar o contrato.'));
    } finally {
      setSaving(false);
    }
  }

  const status = { ok: 'bg-emerald-50 text-emerald-800', warn: 'bg-amber-50 text-amber-800', error: 'bg-red-50 text-red-700', loading: 'bg-[#f4f7fb] text-[#68737a]' }[lookup.status];

  return <Drawer title="Novo contrato" onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded border px-5 py-2">Cancelar</button><button type="button" disabled={saving || lookup.status === 'loading'} onClick={generate} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2 text-white disabled:opacity-50"><FileSignature size={16} aria-hidden="true" />{saving ? 'Gerando…' : 'Gerar contrato'}</button></>}>
    <section className="grid grid-cols-3 gap-5 rounded bg-[#fafafa] p-5">
      <Field required label="CNPJ do cliente" value={cnpj} onChange={setCnpj} placeholder="00.000.000/0000-00" />
      <Field required type="date" label="Data de início" value={startDate} onChange={setStartDate} />
      <Field required label="Valor mensal (R$)" value={monthlyFee} onChange={setMonthlyFee} placeholder="1.320,00" />
      {lookup.message && <p role="status" aria-live="polite" className={`col-span-3 rounded px-3 py-2 text-sm ${status}`}>{lookup.message}</p>}
    </section>

    <section className="mt-6">
      <h3 className="mb-3 font-semibold">Serviços prestados <b className="text-red-600">*</b></h3>
      <div className="grid grid-cols-2 gap-3">
        {services.map((item) => <label key={item.key} className={`flex cursor-pointer items-center gap-3 rounded border px-4 py-3 text-sm ${selected.includes(item.key) ? 'border-[#2693d2] bg-[#eef7fd]' : 'border-[#dfe5e8]'}`}>
          <input type="checkbox" checked={selected.includes(item.key)} onChange={() => toggle(item.key)} />{item.label}
        </label>)}
      </div>
    </section>

    {contratante && <section className="mt-6">
      <h3 className="mb-1 font-semibold">Contratante (preenchido pela Receita)</h3>
      <p className="mb-3 text-xs text-[#78838a]">Ajuste se precisar. O CPF do representante não é público: preencha se quiser que saia no contrato.</p>
      <div className="grid grid-cols-4 gap-4">
        <Field className="col-span-4" required label="Razão social" value={contratante.razaoSocial} onChange={(v) => setC('razaoSocial', v)} />
        <Field label="CEP" value={contratante.cep} onChange={(v) => setC('cep', v)} />
        <Field className="col-span-2" label="Logradouro" value={contratante.logradouro} onChange={(v) => setC('logradouro', v)} />
        <Field label="Número" value={contratante.numero} onChange={(v) => setC('numero', v)} />
        <Field label="Complemento" value={contratante.complemento} onChange={(v) => setC('complemento', v)} />
        <Field label="Bairro" value={contratante.bairro} onChange={(v) => setC('bairro', v)} />
        <Field label="Município" value={contratante.cidade} onChange={(v) => setC('cidade', v)} />
        <Field label="UF" value={contratante.uf} onChange={(v) => setC('uf', v.toUpperCase().slice(0, 2))} />
        <label className="col-span-2 block text-sm"><span className="mb-1 block font-medium">Representante</span>
          {info?.partners?.length > 1
            ? <select value={contratante.representanteNome} onChange={(e) => { const p = info.partners.find((item) => item.name === e.target.value); setContratante((c) => ({ ...c, representanteNome: e.target.value, representanteQualificacao: p?.role ? p.role.toLowerCase() : c.representanteQualificacao })); }} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3">{info.partners.map((p) => <option key={p.name} value={p.name}>{p.name}{p.role ? ` (${p.role})` : ''}</option>)}</select>
            : <input value={contratante.representanteNome || ''} onChange={(e) => setC('representanteNome', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" />}
        </label>
        <Field label="Qualificação" value={contratante.representanteQualificacao} onChange={(v) => setC('representanteQualificacao', v)} />
        <Field label="CPF do representante" value={contratante.representanteCpf} onChange={(v) => setC('representanteCpf', v)} />
      </div>
    </section>}
    {error && <p role="alert" className="mt-5 flex gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
  </Drawer>;
}

export default function ContractsTab() {
  const [contracts, setContracts] = useState([]);
  const [config, setConfig] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => Promise.all([api.get('/contracts'), api.get('/contracts/settings')])
    .then(([list, settings]) => { setContracts(list.data); setConfig(settings.data); })
    .catch((err) => setNotice(errorText(err, 'Não foi possível carregar os contratos.')));
  useEffect(() => { load(); }, []);

  const labels = useMemo(() => Object.fromEntries((config?.services || []).map((item) => [item.key, item.label])), [config]);
  const visible = contracts.filter((item) => `${item.number} ${item.cnpj} ${item.contratante?.razaoSocial || ''}`.toLowerCase().includes(query.toLowerCase()));
  const ativos = contracts.filter((item) => item.status === 'ATIVO');

  async function setStatus(item, status) {
    if (status === 'ENCERRADO' && !window.confirm(`Marcar o contrato ${item.number} de ${item.contratante?.razaoSocial} como encerrado?`)) return;
    await api.patch(`/contracts/${item.id}/status`, { status });
    load();
  }

  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-6 text-sm">
        <p><span className="block text-[#78838a]">Contratos ativos</span><b className="text-lg">{ativos.length}</b></p>
        <p><span className="block text-[#78838a]">Honorários mensais (ativos)</span><b className="text-lg">{money(ativos.reduce((sum, item) => sum + item.monthlyFee, 0))}</b></p>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => setDrawer('settings')} className="inline-flex items-center gap-2 rounded border border-[#dfe5e8] px-4 py-2.5 text-sm text-[#16829b]"><Settings size={16} aria-hidden="true" /> Dados do escritório</button>
        <button type="button" disabled={!config} onClick={() => setDrawer(config?.configured ? 'new' : 'settings-then-new')} className="inline-flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50"><Plus size={17} aria-hidden="true" /> Novo contrato</button>
      </div>
    </div>
    {config && !config.configured && <p className="mb-4 flex gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"><TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />Antes do primeiro contrato, preencha os dados do escritório (representante, CPF, CRC e foro). É só uma vez.</p>}
    {notice && <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{notice}</p>}
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por número, cliente ou CNPJ" aria-label="Buscar contrato" className="mb-4 h-10 w-full max-w-sm rounded border border-[#d8dfe3] px-3 text-sm" />
    <div className="overflow-x-auto rounded border">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-[#f3f3f3]"><tr><th className="px-4 py-3">Nº</th><th className="px-4 py-3">Contratante</th><th className="px-4 py-3">Início</th><th className="px-4 py-3">Serviços</th><th className="px-4 py-3 text-right">Valor mensal</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>
          {visible.map((item) => <tr key={item.id} className="border-t align-top">
            <td className="px-4 py-3">{String(item.number).padStart(4, '0')}</td>
            <td className="px-4 py-3"><b>{item.contratante?.razaoSocial}</b><small className="block text-[#78838a]">{item.cnpj}</small></td>
            <td className="px-4 py-3">{dateBr(item.startDate)}</td>
            <td className="px-4 py-3 text-xs">{item.services.map((key) => labels[key] || key).join(', ')}</td>
            <td className="px-4 py-3 text-right">{money(item.monthlyFee)}</td>
            <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${item.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#eceff1] text-[#68737a]'}`}>{item.status === 'ATIVO' ? 'Ativo' : 'Encerrado'}</span></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-3 text-[#16829b]">
              <button type="button" onClick={() => openPdf(item.id).catch(() => setNotice('Não foi possível abrir o PDF.'))} className="hover:underline">PDF</button>
              {item.status === 'ATIVO' ? <button type="button" onClick={() => setStatus(item, 'ENCERRADO')} className="hover:underline">Encerrar</button> : <button type="button" onClick={() => setStatus(item, 'ATIVO')} className="hover:underline">Reativar</button>}
            </div></td>
          </tr>)}
          {visible.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#78838a]">Nenhum contrato ainda.</td></tr>}
        </tbody>
      </table>
    </div>
    {drawer?.startsWith('settings') && config && <SettingsDrawer initial={config.settings} onClose={() => setDrawer(null)} onSaved={(data) => { setConfig((c) => ({ ...c, ...data })); setDrawer(drawer === 'settings-then-new' && data.configured ? 'new' : null); }} />}
    {drawer === 'new' && config && <NewContractDrawer services={config.services} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />}
  </div>;
}
