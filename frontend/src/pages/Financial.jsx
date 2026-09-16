import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, FileText, ListChecks, MessageCircle, Plus, Search, Settings, Users, WalletCards, X } from 'lucide-react';
import api from '../api/client';
import FirmHeader from '../components/FirmHeader';
import NiboRail from '../components/NiboRail';
import SideMenuSection from '../components/SideMenuSection';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function datePt(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function toIsoDate(value) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function FinancialMenu() {
  const [openSection, setOpenSection] = useState('financeiro');
  const toggleSection = (key) => setOpenSection((current) => (current === key ? null : key));

  return (
    <aside className="fixed inset-y-0 left-[46px] z-20 flex w-[236px] flex-col border-r border-[#dfe5e8] bg-[#f4f7fb]">
      <div className="flex h-[58px] shrink-0 items-center border-b border-[#dfe5e8] px-5 text-xl">Contador</div>
      <nav className="flex-1 overflow-y-auto px-5 py-5 text-sm">
        <p className="mb-4 text-xs font-semibold text-[#7b858c]">OPERAÇÃO</p>
        <Link to="/" className="mb-4 flex items-center gap-2 text-[#68737a]"><ClipboardCheck size={16} /> Obrigações</Link>
        <SideMenuSection icon={ListChecks} label="Tarefas & Processos" to="/demandas" open={openSection === 'tarefas'} onToggle={() => toggleSection('tarefas')}>
          {['Tarefas', 'Processos', 'Configurações'].map((item) => (
            <Link key={item} to="/demandas" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <Link to="/relacionamento" className="mb-4 mt-1 flex items-center gap-2 text-[#68737a]"><MessageCircle size={16} /> Relacionamento</Link>
        <Link to="/radar-ecac" className="mb-4 flex items-center gap-2 text-[#68737a]">Radar e-CAC <b className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] text-white">NOVO</b></Link>
        <Link to="/financeiro" className="mb-4 flex items-center gap-2 rounded bg-[#dce5ef] px-3 py-2 font-semibold text-[#3f4548]"><WalletCards size={16} /> Financeiro</Link>
        <p className="mb-4 border-t pt-4 text-xs font-semibold text-[#7b858c]">CADASTROS</p>
        <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === 'clientes'} onToggle={() => toggleSection('clientes')}>
          {['Meus clientes', 'Contatos'].map((item) => (
            <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <Link to="/formularios" className="mb-4 flex items-center gap-2 text-[#68737a]"><ClipboardList size={16} /> Formulários</Link>
        <Link to="/configuracoes" className="flex items-center gap-2 text-[#68737a]"><Settings size={16} /> Configurações</Link>
      </nav>
    </aside>
  );
}

function ReceiptDrawer({ clients, onClose, onSaved }) {
  const [form, setForm] = useState({
    clientId: clients[0]?.id || '',
    description: 'HONORÁRIOS CONTÁBEIS',
    amount: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    paymentDate: '',
    paymentMethod: '',
    notes: 'Obrigado por fazer negócios conosco.',
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/financial/receipts', {
        ...form,
        amount: Number(String(form.amount).replace(',', '.')),
        issueDate: toIsoDate(form.issueDate),
        dueDate: toIsoDate(form.dueDate),
        paymentDate: toIsoDate(form.paymentDate),
      });
      onSaved(response.data);
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível salvar o recibo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <form onSubmit={save} className="absolute inset-y-0 right-0 flex w-[min(820px,92vw)] flex-col bg-white shadow-xl">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <h2 className="text-2xl font-semibold">Novo recibo</h2>
          <button type="button" onClick={onClose}><X /></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-5">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Cliente</span>
              <select required value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3">
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Valor</span>
              <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3 outline-none focus:border-[#16829b]" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Descrição do serviço</span>
            <input required value={form.description} onChange={(e) => set('description', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3 outline-none focus:border-[#16829b]" />
          </label>
          <div className="grid grid-cols-3 gap-5">
            <label className="block text-sm"><span className="mb-1 block font-medium">Data de emissão</span><input required type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Vencimento</span><input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Pagamento</span><input type="date" value={form.paymentDate} onChange={(e) => set('paymentDate', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Forma de pagamento</span>
            <input value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} placeholder="Pix, boleto, transferência..." className="h-10 w-full rounded border border-[#d8dfe3] px-3 outline-none focus:border-[#16829b]" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Observações</span>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={4} className="w-full rounded border border-[#d8dfe3] px-3 py-2 outline-none focus:border-[#16829b]" />
          </label>
        </div>
        <footer className="flex justify-end gap-3 border-t p-4">
          <button type="button" onClick={onClose} className="px-5 py-2 text-[#16829b]">Cancelar</button>
          <button disabled={saving || clients.length === 0} className="rounded bg-[#2693d2] px-6 py-2 text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar recibo'}</button>
        </footer>
      </form>
    </div>
  );
}

export default function Financial() {
  const [clients, setClients] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [clientsRes, receiptsRes] = await Promise.all([
      api.get('/clients'),
      api.get('/financial/receipts'),
    ]);
    setClients(clientsRes.data.filter((client) => client.active));
    setReceipts(receiptsRes.data);
    setLoading(false);
  }

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const visibleReceipts = useMemo(() => receipts.filter((receipt) => {
    const text = `${receipt.number} ${receipt.client?.name || ''} ${receipt.client?.cnpj || ''} ${receipt.description}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }), [receipts, query]);

  const total = useMemo(() => visibleReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0), [visibleReceipts]);

  async function openReceipt(receipt) {
    try {
      const response = await api.get(`/financial/receipts/${receipt.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível emitir o recibo.');
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <FinancialMenu />
      <main className="ml-[282px]">
        <FirmHeader className="px-6" />
        <div className="flex h-[45px] items-end gap-14 border-b px-6 text-sm">
          <b className="border-b-2 border-[#003f82] pb-3">Financeiro</b>
        </div>
        <section className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Financeiro</h1>
              <p className="mt-1 text-sm text-[#68737a]">Cadastre valores por cliente e emita recibos em PDF.</p>
            </div>
            <button onClick={() => setDrawer(true)} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white">
              <Plus size={17} /> Novo recibo
            </button>
          </div>

          <div className="mb-6 grid grid-cols-[minmax(320px,480px)_180px_180px] gap-4">
            <label className="block text-sm">
              <span className="mb-1 block">Buscar por</span>
              <span className="flex h-10 items-center gap-2 rounded border px-3">
                <Search size={16} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full outline-none" placeholder="Cliente, CNPJ, número ou descrição" />
              </span>
            </label>
            <div className="rounded border bg-[#fbfcfd] px-4 py-2">
              <p className="text-xs text-[#78838a]">Recibos</p>
              <strong>{visibleReceipts.length}</strong>
            </div>
            <div className="rounded border bg-[#fbfcfd] px-4 py-2">
              <p className="text-xs text-[#78838a]">Total listado</p>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#f3f3f3]">
                <tr>
                  <th className="px-5 py-3">Número</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">Emissão</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="w-36 px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visibleReceipts.map((receipt) => (
                  <tr key={receipt.id} className="border-t">
                    <td className="px-5 py-4 font-semibold text-[#16829b]">{receipt.number}</td>
                    <td className="px-5 py-4">{receipt.client?.name}<small className="block text-[#68737a]">{receipt.client?.cnpj}</small></td>
                    <td className="px-5 py-4">{receipt.description}</td>
                    <td className="px-5 py-4">{datePt(receipt.issueDate)}</td>
                    <td className="px-5 py-4">{datePt(receipt.dueDate)}</td>
                    <td className="px-5 py-4 text-right font-semibold">{money(receipt.amount)}</td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => openReceipt(receipt)} className="inline-flex items-center gap-2 rounded bg-[#eef8fc] px-3 py-2 text-[#16829b] hover:bg-[#dff1f8]">
                        <FileText size={16} /> Emitir
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && visibleReceipts.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-[#78838a]">Nenhum recibo cadastrado ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {drawer && <ReceiptDrawer clients={clients} onClose={() => setDrawer(false)} onSaved={(receipt) => { setDrawer(false); load(); openReceipt(receipt); }} />}
    </div>
  );
}
