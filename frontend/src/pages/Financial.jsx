import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, ClipboardCheck, ClipboardList, FileText, ListChecks, MessageCircle, Pencil, Plus, Search, Settings, Users, WalletCards, X } from 'lucide-react';
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

function inputDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
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
          {['Tarefas', 'Processos', 'Configurações'].map((item) => <Link key={item} to="/demandas" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>)}
        </SideMenuSection>
        <Link to="/relacionamento" className="mb-4 mt-1 flex items-center gap-2 text-[#68737a]"><MessageCircle size={16} /> Relacionamento</Link>
        <Link to="/radar-ecac" className="mb-4 flex items-center gap-2 text-[#68737a]">Radar e-CAC <b className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] text-white">NOVO</b></Link>
        <Link to="/financeiro" className="mb-4 flex items-center gap-2 rounded bg-[#dce5ef] px-3 py-2 font-semibold text-[#3f4548]"><WalletCards size={16} /> Financeiro</Link>
        <p className="mb-4 border-t pt-4 text-xs font-semibold text-[#7b858c]">CADASTROS</p>
        <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === 'clientes'} onToggle={() => toggleSection('clientes')}>
          {['Meus clientes', 'Contatos'].map((item) => <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>)}
        </SideMenuSection>
        <Link to="/formularios" className="mb-4 flex items-center gap-2 text-[#68737a]"><ClipboardList size={16} /> Formulários</Link>
        <Link to="/configuracoes" className="flex items-center gap-2 text-[#68737a]"><Settings size={16} /> Configurações</Link>
      </nav>
    </aside>
  );
}

function TransactionDrawer({ clients, onClose, onSaved }) {
  const [form, setForm] = useState({
    clientId: clients[0]?.id || '',
    description: '',
    amount: '',
    type: 'RECEITA',
    dueDate: new Date().toISOString().slice(0, 10),
    paid: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!form.clientId && clients[0]?.id) set('clientId', clients[0].id);
  }, [clients, form.clientId]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/financial/transactions', {
        ...form,
        amount: Number(String(form.amount).replace(',', '.')),
        dueDate: toIsoDate(form.dueDate),
      });
      onSaved();
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível salvar a movimentação.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <form onSubmit={save} className="absolute inset-y-0 right-0 flex w-[min(720px,92vw)] flex-col bg-white shadow-xl">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <h2 className="text-2xl font-semibold">Nova movimentação</h2>
          <button type="button" onClick={onClose}><X /></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => set('type', 'RECEITA')} className={`flex h-11 items-center justify-center gap-2 rounded border ${form.type === 'RECEITA' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-[#d8dfe3] text-[#68737a]'}`}><ArrowUpCircle size={17} /> Entrada</button>
            <button type="button" onClick={() => set('type', 'DESPESA')} className={`flex h-11 items-center justify-center gap-2 rounded border ${form.type === 'DESPESA' ? 'border-red-500 bg-red-50 text-red-700' : 'border-[#d8dfe3] text-[#68737a]'}`}><ArrowDownCircle size={17} /> Saída</button>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <label className="block text-sm"><span className="mb-1 block font-medium">Cliente</span><select required value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3">{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Valor</span><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium">Descrição</span><input required value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex.: Honorários, aluguel, taxa bancária..." className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          <div className="grid grid-cols-2 gap-5">
            <label className="block text-sm"><span className="mb-1 block font-medium">Data</span><input required type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
            <label className="mt-6 flex h-10 items-center gap-3 rounded border border-[#d8dfe3] px-3 text-sm"><input type="checkbox" checked={form.paid} onChange={(e) => set('paid', e.target.checked)} /> Já está pago/recebido</label>
          </div>
        </div>
        <footer className="flex justify-end gap-3 border-t p-4">
          <button type="button" onClick={onClose} className="px-5 py-2 text-[#16829b]">Cancelar</button>
          <button disabled={saving || clients.length === 0} className="rounded bg-[#2693d2] px-6 py-2 text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
        </footer>
      </form>
    </div>
  );
}

function ReceiptDrawer({ clients, receipt, onClose, onSaved }) {
  const [form, setForm] = useState({
    clientId: receipt?.client?.id || receipt?.clientId || clients[0]?.id || '',
    description: receipt?.description || 'HONORÁRIOS CONTÁBEIS',
    amount: receipt?.amount ? String(receipt.amount) : '',
    issueDate: inputDate(receipt?.issueDate) || new Date().toISOString().slice(0, 10),
    dueDate: inputDate(receipt?.dueDate),
    paymentDate: inputDate(receipt?.paymentDate),
    paymentMethod: receipt?.paymentMethod || '',
    notes: receipt?.notes || 'Obrigado por fazer negócios conosco.',
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!form.clientId && clients[0]?.id) set('clientId', clients[0].id);
  }, [clients, form.clientId]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(String(form.amount).replace(',', '.')), issueDate: toIsoDate(form.issueDate), dueDate: toIsoDate(form.dueDate), paymentDate: toIsoDate(form.paymentDate) };
      const response = receipt ? await api.put(`/financial/receipts/${receipt.id}`, payload) : await api.post('/financial/receipts', payload);
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
        <header className="flex h-16 items-center justify-between border-b px-6"><h2 className="text-2xl font-semibold">{receipt ? 'Editar recibo' : 'Novo recibo'}</h2><button type="button" onClick={onClose}><X /></button></header>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-5">
            <label className="block text-sm"><span className="mb-1 block font-medium">Cliente</span><select required value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3">{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Valor</span><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium">Descrição do serviço</span><input required value={form.description} onChange={(e) => set('description', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          <div className="grid grid-cols-3 gap-5">
            <label className="block text-sm"><span className="mb-1 block font-medium">Data de emissão</span><input required type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Vencimento</span><input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Pagamento</span><input type="date" value={form.paymentDate} onChange={(e) => set('paymentDate', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium">Forma de pagamento</span><input value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} placeholder="Pix, boleto, transferência..." className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          <label className="block text-sm"><span className="mb-1 block font-medium">Observações</span><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={4} className="w-full rounded border border-[#d8dfe3] px-3 py-2" /></label>
        </div>
        <footer className="flex justify-end gap-3 border-t p-4"><button type="button" onClick={onClose} className="px-5 py-2 text-[#16829b]">Cancelar</button><button disabled={saving || clients.length === 0} className="rounded bg-[#2693d2] px-6 py-2 text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar recibo'}</button></footer>
      </form>
    </div>
  );
}

export default function Financial() {
  const [tab, setTab] = useState('Movimentações');
  const [clients, setClients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ type: '', status: '', clientId: '', month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });
  const [drawer, setDrawer] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadClients() {
    const { data } = await api.get('/clients');
    setClients(data.filter((client) => client.active));
  }

  async function loadTransactions() {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const { data } = await api.get('/financial/transactions', { params });
    setTransactions(data);
  }

  async function loadReceipts() {
    const { data } = await api.get('/financial/receipts');
    setReceipts(data);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadClients(), loadTransactions(), loadReceipts()]).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadTransactions().catch(() => setTransactions([])); }, [filters]);

  const filteredTransactions = useMemo(() => transactions.filter((item) => `${item.description} ${item.client?.name || ''} ${item.category?.name || ''}`.toLowerCase().includes(query.toLowerCase())), [transactions, query]);
  const filteredReceipts = useMemo(() => receipts.filter((item) => `${item.number} ${item.client?.name || ''} ${item.client?.cnpj || ''} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [receipts, query]);
  const summary = useMemo(() => {
    const entradas = filteredTransactions.filter((item) => item.type === 'RECEITA').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const saidas = filteredTransactions.filter((item) => item.type === 'DESPESA').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendentes = filteredTransactions.filter((item) => item.status !== 'PAID').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { entradas, saidas, saldo: entradas - saidas, pendentes };
  }, [filteredTransactions]);

  async function markPaid(transaction) {
    await api.patch(`/financial/transactions/${transaction.id}/pay`);
    loadTransactions();
  }

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

  const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Date(2026, index, 1).toLocaleDateString('pt-BR', { month: 'long' }) }));

  return (
    <div className="min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <FinancialMenu />
      <main className="ml-[282px]">
        <FirmHeader className="px-6" />
        <div className="flex h-[45px] items-end gap-14 border-b px-6 text-sm">
          {['Movimentações', 'Recibos'].map((item) => <button key={item} onClick={() => setTab(item)} className={`h-full border-b-2 px-1 ${tab === item ? 'border-[#003f82] font-semibold' : 'border-transparent'}`}>{item}</button>)}
        </div>
        <section className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div><h1 className="text-2xl font-semibold">Financeiro</h1><p className="mt-1 text-sm text-[#68737a]">Controle entradas, saídas, pendências e recibos por cliente.</p></div>
            <div className="flex gap-3">
              <button disabled={clients.length === 0} onClick={() => setDrawer({ type: 'transaction' })} className="flex items-center gap-2 rounded border border-[#2693d2] px-5 py-2.5 text-[#16829b] disabled:opacity-50"><Plus size={17} /> Nova movimentação</button>
              <button disabled={clients.length === 0} onClick={() => setDrawer({ type: 'receipt-new' })} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50"><Plus size={17} /> Novo recibo</button>
            </div>
          </div>

          {tab === 'Movimentações' && (
            <>
              <div className="mb-6 grid grid-cols-4 gap-4">
                <SummaryCard label="Entradas" value={money(summary.entradas)} tone="green" />
                <SummaryCard label="Saídas" value={money(summary.saidas)} tone="red" />
                <SummaryCard label="Saldo" value={money(summary.saldo)} tone={summary.saldo >= 0 ? 'blue' : 'red'} />
                <SummaryCard label="Pendentes" value={money(summary.pendentes)} tone="amber" />
              </div>
              <div className="mb-5 grid grid-cols-[minmax(260px,1fr)_160px_170px_220px_140px_120px] gap-3">
                <SearchBox value={query} onChange={setQuery} placeholder="Cliente, descrição ou categoria" />
                <Select value={filters.type} onChange={(value) => setFilters((current) => ({ ...current, type: value }))} options={[['', 'Todos os tipos'], ['RECEITA', 'Entradas'], ['DESPESA', 'Saídas']]} />
                <Select value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={[['', 'Todos os status'], ['PENDING', 'Pendente'], ['PAID', 'Pago']]} />
                <Select value={filters.clientId} onChange={(value) => setFilters((current) => ({ ...current, clientId: value }))} options={[['', 'Todos os clientes'], ...clients.map((c) => [c.id, c.name])]} />
                <Select value={filters.month} onChange={(value) => setFilters((current) => ({ ...current, month: value }))} options={monthOptions.map((m) => [m.value, m.label])} />
                <input value={filters.year} onChange={(e) => setFilters((current) => ({ ...current, year: e.target.value }))} className="h-10 rounded border border-[#dfe5e8] px-3 text-sm" />
              </div>
              <div className="overflow-x-auto rounded border">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-[#f3f3f3]"><tr><th className="px-5 py-3">Data</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Categoria</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Valor</th><th className="w-36 px-5 py-3"></th></tr></thead>
                  <tbody>
                    {filteredTransactions.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-5 py-4">{datePt(item.dueDate)}</td><td className="px-5 py-4">{item.client?.name || '-'}</td><td className="px-5 py-4">{item.description}</td><td className="px-5 py-4">{item.category?.name || '-'}</td>
                        <td className="px-5 py-4"><span className={`rounded px-2 py-1 text-xs ${item.type === 'RECEITA' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.type === 'RECEITA' ? 'Entrada' : 'Saída'}</span></td>
                        <td className="px-5 py-4">{item.status === 'PAID' ? 'Pago' : 'Pendente'}</td>
                        <td className={`px-5 py-4 text-right font-semibold ${item.type === 'RECEITA' ? 'text-emerald-700' : 'text-red-700'}`}>{item.type === 'RECEITA' ? '+' : '-'} {money(item.amount)}</td>
                        <td className="px-5 py-4 text-right">{item.status !== 'PAID' && <button onClick={() => markPaid(item)} className="rounded bg-[#eef8fc] px-3 py-2 text-[#16829b]">Baixar</button>}</td>
                      </tr>
                    ))}
                    {!loading && filteredTransactions.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-[#78838a]">Nenhuma movimentação encontrada.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'Recibos' && (
            <>
              <div className="mb-5 grid grid-cols-[minmax(320px,520px)_180px_180px] gap-4">
                <SearchBox value={query} onChange={setQuery} placeholder="Cliente, CNPJ, número ou descrição" />
                <SummaryMini label="Recibos" value={filteredReceipts.length} />
                <SummaryMini label="Total listado" value={money(filteredReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0))} />
              </div>
              <div className="overflow-x-auto rounded border">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-[#f3f3f3]"><tr><th className="px-5 py-3">Número</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Emissão</th><th className="px-5 py-3">Vencimento</th><th className="px-5 py-3 text-right">Valor</th><th className="w-48 px-5 py-3"></th></tr></thead>
                  <tbody>
                    {filteredReceipts.map((receipt) => (
                      <tr key={receipt.id} className="border-t"><td className="px-5 py-4 font-semibold text-[#16829b]">{receipt.number}</td><td className="px-5 py-4">{receipt.client?.name}<small className="block text-[#68737a]">{receipt.client?.cnpj}</small></td><td className="px-5 py-4">{receipt.description}</td><td className="px-5 py-4">{datePt(receipt.issueDate)}</td><td className="px-5 py-4">{datePt(receipt.dueDate)}</td><td className="px-5 py-4 text-right font-semibold">{money(receipt.amount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setDrawer({ type: 'receipt-edit', receipt })} className="inline-flex items-center gap-2 rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b]"><Pencil size={16} /> Editar</button><button onClick={() => openReceipt(receipt)} className="inline-flex items-center gap-2 rounded bg-[#eef8fc] px-3 py-2 text-[#16829b]"><FileText size={16} /> Emitir</button></div></td></tr>
                    ))}
                    {!loading && filteredReceipts.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[#78838a]">Nenhum recibo cadastrado ainda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
      {drawer?.type === 'transaction' && <TransactionDrawer clients={clients} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); loadTransactions(); }} />}
      {drawer?.type?.startsWith('receipt') && <ReceiptDrawer clients={clients} receipt={drawer.receipt} onClose={() => setDrawer(null)} onSaved={(saved) => { setDrawer(null); loadReceipts(); if (drawer.type === 'receipt-new') openReceipt(saved); }} />}
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const colors = { green: 'text-emerald-700 bg-emerald-50', red: 'text-red-700 bg-red-50', blue: 'text-[#0b4f8f] bg-[#eef8fc]', amber: 'text-amber-700 bg-amber-50' };
  return <div className={`rounded border border-[#dfe5e8] p-4 ${colors[tone] || 'bg-white'}`}><p className="text-xs uppercase text-[#68737a]">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></div>;
}

function SummaryMini({ label, value }) {
  return <div className="rounded border bg-[#fbfcfd] px-4 py-2"><p className="text-xs text-[#78838a]">{label}</p><strong>{value}</strong></div>;
}

function SearchBox({ value, onChange, placeholder }) {
  return <label className="block text-sm"><span className="mb-1 block">Buscar por</span><span className="flex h-10 items-center gap-2 rounded border px-3"><Search size={16} /><input value={value} onChange={(e) => onChange(e.target.value)} className="w-full outline-none" placeholder={placeholder} /></span></label>;
}

function Select({ value, onChange, options }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-5 h-10 rounded border border-[#dfe5e8] bg-white px-3 text-sm">{options.map(([optionValue, label]) => <option key={optionValue || label} value={optionValue}>{label}</option>)}</select>;
}
