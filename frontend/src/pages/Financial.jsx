import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, BarChart3, ClipboardCheck, ClipboardList, FileText, ListChecks, MessageCircle, Pencil, Plus, Repeat, Search, Settings, Trash2, Users, WalletCards, X } from 'lucide-react';
import api from '../api/client';
import FirmHeader from '../components/FirmHeader';
import NiboRail from '../components/NiboRail';
import ContentMenuLink from '../components/ContentMenuLink';
import SideMenuSection from '../components/SideMenuSection';
import { buildMonthlyTransactions, summarizeTransactions, buildFinancialChart } from '../utils/financialProjection.mjs';
import { DEFAULT_RECEIPT_NOTES } from '../utils/receiptDefaults';

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

function SettlementDrawer({ transaction, onClose, onSaved }) {
  const [paidAt, setPaidAt] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const incoming = transaction.type === 'RECEITA';
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const date = new Date(transaction.dueDate);
      await api.patch(`/financial/transactions/${transaction.sourceId || transaction.id}/pay`, {
        paidAt: `${paidAt}T12:00:00.000Z`,
        ...(transaction.projected ? { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 } : {}),
      });
      await onSaved();
    } catch (failure) {
      setError(failure.response?.data?.error || 'Nao foi possivel registrar a baixa. Tente novamente.');
    } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <form onSubmit={save} className="w-full max-w-md rounded bg-white shadow-xl">
      <header className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-semibold">{incoming ? 'Baixar recebimento' : 'Baixar pagamento'}</h2><button type="button" disabled={saving} onClick={onClose} title="Fechar"><X /></button></header>
      <div className="space-y-4 p-5"><p>{transaction.description}</p><p>{transaction.client?.name}</p><strong className="block text-xl">{money(transaction.amount)}</strong><p className="text-sm">Vencimento: {datePt(transaction.dueDate)}</p>
        <label className="block text-sm">{incoming ? 'Data do recebimento *' : 'Data do pagamento *'}<input required type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="mt-1 h-10 w-full rounded border px-3" /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>
      <footer className="flex justify-end gap-3 border-t p-4"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button disabled={saving} className="rounded bg-[#2693d2] px-4 py-2 text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar baixa'}</button></footer>
    </form>
  </div>;
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
        <ContentMenuLink />
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

function TransactionDrawer({ clients, transaction, onClose, onSaved, onCreateReceipt }) {
  const [form, setForm] = useState({
    clientId: transaction?.clientId || transaction?.client?.id || clients[0]?.id || '',
    description: transaction?.description || '',
    amount: transaction?.amount ? String(transaction.amount) : '',
    type: transaction?.type || 'RECEITA',
    dueDate: inputDate(transaction?.dueDate) || new Date().toISOString().slice(0, 10),
    paid: transaction?.status === 'PAID',
    notes: transaction?.notes || '',
    recurrence: transaction?.recurrence || (transaction?.recurrenceInfinite ? 'MONTHLY_INDEFINITE' : 'NONE'),
    recurrenceCount: transaction?.recurrenceCount || 2,
    createReceipt: false,
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
      const payload = {
        ...form,
        amount: Number(String(form.amount).replace(',', '.')),
        dueDate: toIsoDate(form.dueDate),
        recurrenceCount: Number(form.recurrenceCount || 1),
      };
      const response = transaction
        ? await api.put(`/financial/transactions/${transaction.id}`, payload)
        : await api.post('/financial/transactions', payload);
      const saved = Array.isArray(response.data) ? response.data[0] : response.data;
      onSaved();
      if (!transaction && form.createReceipt && saved && form.type === 'RECEITA') {
        onCreateReceipt(saved);
      }
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
          <h2 className="text-2xl font-semibold">{transaction ? 'Editar movimentação' : 'Nova movimentação'}</h2>
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
          <div className="grid grid-cols-2 gap-5 rounded border border-[#dfe5e8] bg-[#fbfcfd] p-4">
            <label className="block text-sm"><span className="mb-1 flex items-center gap-2 font-medium"><Repeat size={15} /> Recorrência</span><select value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3"><option value="NONE">Sem recorrência</option><option value="MONTHLY">Mensal com quantidade</option><option value="MONTHLY_INDEFINITE">Mensal indeterminada</option></select></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Quantidade</span><input type="number" min="1" max="60" disabled={form.recurrence !== 'MONTHLY'} value={form.recurrenceCount} onChange={(e) => set('recurrenceCount', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3 disabled:bg-[#f3f3f3]" /></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium">Anotação do status</span><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Campo livre para preencher quando necessário" className="w-full rounded border border-[#d8dfe3] px-3 py-2" /></label>
          {!transaction && form.type === 'RECEITA' && (
            <label className="flex items-center gap-3 rounded border border-[#d8dfe3] px-3 py-3 text-sm"><input type="checkbox" checked={form.createReceipt} onChange={(e) => set('createReceipt', e.target.checked)} /> Criar recibo a partir desta entrada</label>
          )}
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
    transactionId: receipt?.transactionId || receipt?.transaction?.id || '',
    recurrenceSourceId: receipt?.recurrenceSourceId,
    recurrenceYear: receipt?.recurrenceYear,
    recurrenceMonth: receipt?.recurrenceMonth,
    description: receipt?.description || 'HONORÁRIOS CONTÁBEIS',
    amount: receipt?.amount ? String(receipt.amount) : '',
    issueDate: inputDate(receipt?.issueDate) || new Date().toISOString().slice(0, 10),
    dueDate: inputDate(receipt?.dueDate),
    paymentDate: inputDate(receipt?.paymentDate),
    paymentMethod: receipt?.paymentMethod || '',
    notes: receipt?.id ? (receipt.notes || '') : (receipt?.notes ?? DEFAULT_RECEIPT_NOTES),
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
      const payload = { ...form, transactionId: form.transactionId || null, amount: Number(String(form.amount).replace(',', '.')), issueDate: toIsoDate(form.issueDate), dueDate: toIsoDate(form.dueDate), paymentDate: toIsoDate(form.paymentDate) };
      const response = receipt?.id ? await api.put(`/financial/receipts/${receipt.id}`, payload) : await api.post('/financial/receipts', payload);
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
        <header className="flex h-16 items-center justify-between border-b px-6"><h2 className="text-2xl font-semibold">{receipt?.id ? 'Editar recibo' : 'Novo recibo'}</h2><button type="button" onClick={onClose}><X /></button></header>
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

function BudgetDrawer({ clients, budget, onClose, onSaved }) {
  const initialItems = Array.isArray(budget?.items) && budget.items.length
    ? budget.items
    : [{ service: budget?.description || '', amount: budget?.amount ? String(budget.amount) : '' }];
  const initialClientMode = budget?.client?.id || budget?.clientId ? 'registered' : 'external';
  const [form, setForm] = useState({
    clientMode: initialClientMode,
    clientId: budget?.client?.id || budget?.clientId || '',
    clientName: budget?.clientName || '',
    description: budget?.description || '',
    items: initialItems.map((item) => ({ service: item.service || '', amount: item.amount ? String(item.amount) : '' })),
    type: budget?.type || 'RECEITA',
    status: budget?.status || 'DRAFT',
    validUntil: inputDate(budget?.validUntil),
    notes: budget?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const budgetTotal = form.items.reduce((sum, item) => sum + Number(String(item.amount || 0).replace(',', '.')), 0);
  const updateItem = (index, key, value) => set('items', form.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  const addItem = () => set('items', [...form.items, { service: '', amount: '' }]);
  const removeItem = (index) => set('items', form.items.filter((_, itemIndex) => itemIndex !== index));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        clientId: form.clientMode === 'registered' ? form.clientId : null,
        clientName: form.clientMode === 'external' ? form.clientName.trim() : '',
        description: form.items.map((item) => item.service.trim()).filter(Boolean).join(', '),
        amount: budgetTotal,
        items: form.items.map((item) => ({
          service: item.service.trim(),
          amount: Number(String(item.amount).replace(',', '.')),
        })),
        validUntil: toIsoDate(form.validUntil),
      };
      const response = budget
        ? await api.put(`/financial/budgets/${budget.id}`, payload)
        : await api.post('/financial/budgets', payload);
      onSaved(response.data);
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível salvar o orçamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <form onSubmit={save} className="absolute inset-y-0 right-0 flex w-[min(780px,92vw)] flex-col bg-white shadow-xl">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <h2 className="text-2xl font-semibold">{budget ? 'Editar orçamento' : 'Novo orçamento'}</h2>
          <button type="button" onClick={onClose}><X /></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm((current) => ({ ...current, clientMode: 'registered', clientName: '' }))} className={`h-10 rounded border text-sm ${form.clientMode === 'registered' ? 'border-[#2693d2] bg-[#eef8fc] text-[#16829b]' : 'border-[#d8dfe3] text-[#68737a]'}`}>Cliente cadastrado</button>
              <button type="button" onClick={() => setForm((current) => ({ ...current, clientMode: 'external', clientId: '' }))} className={`h-10 rounded border text-sm ${form.clientMode === 'external' ? 'border-[#2693d2] bg-[#eef8fc] text-[#16829b]' : 'border-[#d8dfe3] text-[#68737a]'}`}>Cliente avulso</button>
            </div>
            {form.clientMode === 'registered' ? (
              <label className="block text-sm"><span className="mb-1 block font-medium">Cliente</span><select required value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3"><option value="">Selecione...</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            ) : (
              <label className="block text-sm"><span className="mb-1 block font-medium">Nome do cliente</span><input required value={form.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Digite o nome do cliente" className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
            )}
          </section>
          <section className="rounded border border-[#dfe5e8]">
            <div className="flex items-center justify-between border-b bg-[#f6f8fa] px-4 py-3">
              <h3 className="font-semibold">Serviços do orçamento</h3>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-2 rounded border border-[#2693d2] px-3 py-1.5 text-sm text-[#16829b]"><Plus size={15} /> Adicionar linha</button>
            </div>
            <div className="space-y-3 p-4">
              {form.items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_160px_42px] gap-3">
                  <label className="block text-sm"><span className="mb-1 block font-medium">Serviço</span><input required value={item.service} onChange={(e) => updateItem(index, 'service', e.target.value)} placeholder="Ex.: Honorários mensais" className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
                  <label className="block text-sm"><span className="mb-1 block font-medium">Valor</span><input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(e) => updateItem(index, 'amount', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
                  <button type="button" disabled={form.items.length === 1} onClick={() => removeItem(index)} title="Remover linha" className="mt-6 h-10 rounded border border-[#dfe5e8] text-[#16829b] disabled:opacity-40"><Trash2 className="mx-auto" size={16} /></button>
                </div>
              ))}
              <div className="flex justify-end border-t pt-3 text-sm">
                <span className="mr-3 text-[#68737a]">Total do orçamento</span>
                <strong className="text-lg">{money(budgetTotal)}</strong>
              </div>
            </div>
          </section>
          <div className="grid grid-cols-3 gap-5">
            <label className="block text-sm"><span className="mb-1 block font-medium">Tipo</span><select value={form.type} onChange={(e) => set('type', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3"><option value="RECEITA">Entrada</option><option value="DESPESA">Saída</option></select></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Status</span><select value={form.status} onChange={(e) => set('status', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] bg-white px-3"><option value="DRAFT">Rascunho</option><option value="SENT">Enviado</option><option value="APPROVED">Aprovado</option><option value="REJECTED">Reprovado</option></select></label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Validade</span><input type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className="h-10 w-full rounded border border-[#d8dfe3] px-3" /></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium">Observações</span><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={5} placeholder="Condições, escopo do serviço, forma de pagamento..." className="w-full rounded border border-[#d8dfe3] px-3 py-2" /></label>
        </div>
        <footer className="flex justify-end gap-3 border-t p-4">
          <button type="button" onClick={onClose} className="px-5 py-2 text-[#16829b]">Cancelar</button>
          <button disabled={saving || clients.length === 0} className="rounded bg-[#2693d2] px-6 py-2 text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar orçamento'}</button>
        </footer>
      </form>
    </div>
  );
}

export default function Financial() {
  const [tab, setTab] = useState('Movimentações');
  const [clients, setClients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [projectionTransactions, setProjectionTransactions] = useState([]);
  const [chartRange, setChartRange] = useState('month');
  const [projectionError, setProjectionError] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ type: '', status: '', clientId: '', month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });
  const [drawer, setDrawer] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadClients() {
    const { data } = await api.get('/clients');
    setClients(data.filter((client) => client.active));
  }

  async function loadTransactions() {
    const params = Object.fromEntries(Object.entries({
      type: filters.type,
      clientId: filters.clientId,
      month: filters.month,
      year: filters.year,
      includeRecurring: '1',
    }).filter(([, value]) => value));
    const { data } = await api.get('/financial/transactions', { params });
    setTransactions(data);
  }

  async function loadReceipts() {
    const { data } = await api.get('/financial/receipts');
    setReceipts(data);
  }

  async function loadBudgets() {
    const { data } = await api.get('/financial/budgets');
    setBudgets(data);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadClients(), loadReceipts(), loadBudgets()]).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    let active = true;
    const params = { type: filters.type || undefined, clientId: filters.clientId || undefined, month: filters.month, year: filters.year, includeRecurring: '1' };
    setTransactions([]);
    api.get('/financial/transactions', { params }).then(({ data }) => {
      if (active) setTransactions(data);
    }).catch(() => { if (active) setTransactions([]); });
    return () => { active = false; };
  }, [filters.type, filters.clientId, filters.month, filters.year]);

  useEffect(() => {
    if (chartRange !== 'year') return;
    let active = true;
    setProjectionTransactions([]);
    setProjectionError('');
    api.get('/financial/transactions', { params: {
      year: filters.year, throughYear: Number(filters.year) + 1, includeRecurring: '1',
      type: filters.type || undefined, clientId: filters.clientId || undefined,
    } }).then(({ data }) => { if (active) setProjectionTransactions(data); })
      .catch(() => { if (active) setProjectionError('Nao foi possivel carregar as projecoes.'); });
    return () => { active = false; };
  }, [chartRange, filters.year, filters.type, filters.clientId, transactions]);

  const monthlyTransactions = useMemo(() => buildMonthlyTransactions(transactions, filters), [transactions, filters]);
  const filteredTransactions = useMemo(() => monthlyTransactions
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => `${item.description} ${item.client?.name || ''} ${item.category?.name || ''}`.toLowerCase().includes(query.toLowerCase())),
  [monthlyTransactions, filters.status, query]);
  const filteredReceipts = useMemo(() => receipts.filter((item) => `${item.number} ${item.client?.name || ''} ${item.client?.cnpj || ''} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [receipts, query]);
  const filteredBudgets = useMemo(() => budgets.filter((item) => `${item.number} ${item.client?.name || item.clientName || ''} ${item.client?.cnpj || ''} ${item.description} ${budgetStatusLabel(item.status)}`.toLowerCase().includes(query.toLowerCase())), [budgets, query]);
  const budgetSummary = useMemo(() => {
    const total = filteredBudgets.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const open = filteredBudgets.filter((item) => ['DRAFT', 'SENT'].includes(item.status)).length;
    const approved = filteredBudgets.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { total, open, approved, count: filteredBudgets.length };
  }, [filteredBudgets]);
  const summary = useMemo(() => summarizeTransactions(filteredTransactions), [filteredTransactions]);
  const chartRows = useMemo(() => buildFinancialChart(chartRange === 'year' ? projectionTransactions : transactions, {
    ...filters, range: chartRange, query,
  }), [transactions, projectionTransactions, filters, chartRange, query]);

  async function markPaid(transaction) {
    setDrawer({ type: 'settlement', transaction });
  }

  async function removeTransaction(transaction) {
    const linkedText = transaction.receipt ? ' Essa movimentação tem um recibo vinculado, que também será excluído.' : '';
    if (!window.confirm(`Excluir a movimentação "${transaction.description}"?${linkedText}`)) return;
    await api.delete(`/financial/transactions/${transaction.id}`);
    loadTransactions();
    loadReceipts();
  }

  async function removeReceipt(receipt) {
    if (!window.confirm(`Excluir o recibo ${receipt.number}? A movimentação vinculada também será excluída.`)) return;
    await api.delete(`/financial/receipts/${receipt.id}`);
    loadReceipts();
    loadTransactions();
  }

  async function removeBudget(budget) {
    if (!window.confirm(`Excluir o orçamento ${budget.number}?`)) return;
    await api.delete(`/financial/budgets/${budget.id}`);
    loadBudgets();
  }

  async function openBudgetPdf(budget) {
    try {
      const response = await api.get(`/financial/budgets/${budget.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      let message = error.response?.data?.error;
      if (!message && error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          message = JSON.parse(text).error;
        } catch {
          message = '';
        }
      }
      window.alert(message || 'Não foi possível emitir o orçamento.');
    }
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

  function receiptFromTransaction(transaction) {
    if (transaction.receipt) {
      setTab('Recibos');
      setQuery(transaction.receipt.number);
      return;
    }
    setTab('Recibos');
    setQuery('');
    setDrawer({
      type: 'receipt-new',
      receipt: {
        clientId: transaction.clientId || transaction.client?.id,
        client: transaction.client,
        description: transaction.description,
        transactionId: transaction.projected ? '' : transaction.id,
        ...(transaction.projected ? {
          recurrenceSourceId: transaction.sourceId,
          recurrenceYear: new Date(transaction.dueDate).getUTCFullYear(),
          recurrenceMonth: new Date(transaction.dueDate).getUTCMonth() + 1,
        } : {}),
        amount: transaction.amount,
        issueDate: new Date().toISOString(),
        dueDate: transaction.dueDate,
        paymentDate: transaction.status === 'PAID' ? (transaction.paidAt || new Date().toISOString()) : null,
        notes: DEFAULT_RECEIPT_NOTES,
      },
    });
  }

  const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Date(2026, index, 1).toLocaleDateString('pt-BR', { month: 'long' }) }));

  return (
    <div className="min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <FinancialMenu />
      <main className="ml-[282px]">
        <FirmHeader className="px-6" />
        <div className="flex h-[45px] items-end gap-14 border-b px-6 text-sm">
          {['Movimentações', 'Recibos', 'Orçamento'].map((item) => <button key={item} onClick={() => { setTab(item); setQuery(''); }} className={`h-full border-b-2 px-1 ${tab === item ? 'border-[#003f82] font-semibold' : 'border-transparent'}`}>{item}</button>)}
        </div>
        <section className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div><h1 className="text-2xl font-semibold">Financeiro</h1><p className="mt-1 text-sm text-[#68737a]">Controle entradas, saídas, pendências e recibos por cliente.</p></div>
            <div className="flex gap-3">
              {tab === 'Movimentações' && <button disabled={clients.length === 0} onClick={() => setDrawer({ type: 'transaction' })} className="flex items-center gap-2 rounded border border-[#2693d2] px-5 py-2.5 text-[#16829b] disabled:opacity-50"><Plus size={17} /> Nova movimentação</button>}
              {tab !== 'Orçamento' && <button disabled={clients.length === 0} onClick={() => setDrawer({ type: 'receipt-new' })} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50"><Plus size={17} /> Novo recibo</button>}
              {tab === 'Orçamento' && <button disabled={clients.length === 0} onClick={() => setDrawer({ type: 'budget' })} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50"><Plus size={17} /> Novo orçamento</button>}
            </div>
          </div>

          {tab === 'Movimentações' && (
            <>
              <div className="mb-6 grid grid-cols-4 gap-4">
                <SummaryCard label="Entradas" value={money(summary.entradas)} tone="green" />
                <SummaryCard label="Saídas" value={money(summary.saidas)} tone="red" />
                <SummaryCard label="Saldo" value={money(summary.saldo)} tone={summary.saldo >= 0 ? 'blue' : 'red'} />
                <div className="rounded border border-[#dfe5e8] bg-amber-50 p-4 text-sm">
                  <p className="mb-2 text-xs uppercase text-[#68737a]">Pendências</p>
                  <div className="flex flex-wrap justify-between gap-1"><span>A receber</span><strong className="text-emerald-700">+ {money(summary.aReceber)}</strong></div>
                  <div className="mt-1 flex flex-wrap justify-between gap-1"><span>A pagar</span><strong className="text-red-700">- {money(summary.aPagar)}</strong></div>
                  <div className="mt-2 flex flex-wrap justify-between gap-1 border-t border-amber-200 pt-2"><span>Saldo pendente</span><strong className={summary.saldoPendente < 0 ? 'text-red-700' : 'text-emerald-700'}>{money(summary.saldoPendente)}</strong></div>
                </div>
              </div>
              <MonthlyProjection rows={chartRows} range={chartRange} onRangeChange={setChartRange} error={projectionError} period={`${monthOptions.find((month) => month.value === filters.month)?.label || ''}/${filters.year}`} />
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
                  <thead className="bg-[#f3f3f3]"><tr><th className="px-5 py-3">Data</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Categoria</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Valor</th><th className="w-72 px-5 py-3"></th></tr></thead>
                  <tbody>
                    {filteredTransactions.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-5 py-4">{datePt(item.dueDate)}</td><td className="px-5 py-4">{item.client?.name || '-'}</td><td className="px-5 py-4">{item.description}{item.projected && <small className="ml-2 rounded bg-[#eef8fc] px-2 py-0.5 text-[11px] text-[#16829b]">Recorrência</small>}{item.notes && <small className="mt-1 block text-[#68737a]">{item.notes}</small>}</td><td className="px-5 py-4">{item.category?.name || '-'}</td>
                        <td className="px-5 py-4"><span className={`rounded px-2 py-1 text-xs ${item.type === 'RECEITA' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{item.type === 'RECEITA' ? 'Entrada' : 'Saída'}</span></td>
                        <td className="px-5 py-4">{item.status === 'PAID' ? (item.type === 'RECEITA' ? 'Recebido' : 'Pago') : 'Pendente'}{item.paidAt && <small className="mt-1 block text-[#68737a]">{datePt(item.paidAt)}</small>}</td>
                        <td className={`px-5 py-4 text-right font-semibold ${item.type === 'RECEITA' ? 'text-emerald-700' : 'text-red-700'}`}>{item.type === 'RECEITA' ? '+' : '-'} {money(item.amount)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
                            {item.projected ? <button onClick={() => markPaid(item)} className="rounded bg-[#eef8fc] px-3 py-2 text-[#16829b]">{item.type === 'RECEITA' ? 'Receber' : 'Pagar'}</button> : (
                              <>
                                {item.status !== 'PAID' && <button onClick={() => markPaid(item)} className="rounded bg-[#eef8fc] px-3 py-2 text-[#16829b]">{item.type === 'RECEITA' ? 'Receber' : 'Pagar'}</button>}
                                <button onClick={() => setDrawer({ type: 'transaction', transaction: item })} title="Editar" className="rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b]"><Pencil size={16} /></button>
                                <button onClick={() => removeTransaction(item)} title="Excluir" className="rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b] hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                              </>
                            )}
                            <button onClick={() => receiptFromTransaction(item)} title={item.receipt ? 'Ver recibo na aba Recibos' : 'Gerar recibo na aba Recibos'} className="inline-flex items-center gap-1 rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b]"><FileText size={16} />{item.receipt ? 'Ver recibo' : 'Gerar recibo'}</button>
                          </div>
                        </td>
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
                  <thead className="bg-[#f3f3f3]"><tr><th className="px-5 py-3">Número</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Descrição</th><th className="px-5 py-3">Emissão</th><th className="px-5 py-3">Vencimento</th><th className="px-5 py-3 text-right">Valor</th><th className="w-56 px-5 py-3"></th></tr></thead>
                  <tbody>
                    {filteredReceipts.map((receipt) => (
                      <tr key={receipt.id} className="border-t"><td className="px-5 py-4 font-semibold text-[#16829b]">{receipt.number}</td><td className="px-5 py-4">{receipt.client?.name}<small className="block text-[#68737a]">{receipt.client?.cnpj}</small></td><td className="px-5 py-4">{receipt.description}</td><td className="px-5 py-4">{datePt(receipt.issueDate)}</td><td className="px-5 py-4">{datePt(receipt.dueDate)}</td><td className="px-5 py-4 text-right font-semibold">{money(receipt.amount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setDrawer({ type: 'receipt-edit', receipt })} className="inline-flex items-center gap-2 rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b]"><Pencil size={16} /> Editar</button><button onClick={() => openReceipt(receipt)} className="inline-flex items-center gap-2 rounded bg-[#eef8fc] px-3 py-2 text-[#16829b]"><FileText size={16} /> Emitir</button><button onClick={() => removeReceipt(receipt)} title="Excluir" className="rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b] hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div></td></tr>
                    ))}
                    {!loading && filteredReceipts.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[#78838a]">Nenhum recibo cadastrado ainda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'Orçamento' && (
            <>
              <div className="mb-5 grid grid-cols-[minmax(320px,520px)_180px_180px_180px] gap-4">
                <SearchBox value={query} onChange={setQuery} placeholder="Cliente, CNPJ, número ou status" />
                <SummaryMini label="Orçamentos" value={budgetSummary.count} />
                <SummaryMini label="Em aberto" value={budgetSummary.open} />
                <SummaryMini label="Aprovados" value={money(budgetSummary.approved)} />
              </div>
              <div className="mb-4 rounded border border-[#dfe5e8] bg-[#fbfcfd] px-4 py-3 text-sm">
                <span className="text-[#68737a]">Total listado: </span><strong>{money(budgetSummary.total)}</strong>
              </div>
              <div className="overflow-x-auto rounded border">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-[#f3f3f3]"><tr><th className="px-5 py-3">Número</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Serviços</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Validade</th><th className="px-5 py-3 text-right">Valor</th><th className="w-64 px-5 py-3"></th></tr></thead>
                  <tbody>
                    {filteredBudgets.map((budget) => (
                      <tr key={budget.id} className="border-t">
                        <td className="px-5 py-4 font-semibold text-[#16829b]">{budget.number}</td>
                        <td className="px-5 py-4">{budget.client?.name || budget.clientName}<small className="block text-[#68737a]">{budget.client?.cnpj || (budget.client ? '' : 'Cliente avulso')}</small></td>
                        <td className="px-5 py-4">{Array.isArray(budget.items) && budget.items.length ? `${budget.items.length} serviço(s)` : '1 serviço'}</td>
                        <td className="px-5 py-4"><BudgetStatus status={budget.status} /></td>
                        <td className="px-5 py-4">{datePt(budget.validUntil)}</td>
                        <td className="px-5 py-4 text-right font-semibold">{money(budget.amount)}</td>
                        <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openBudgetPdf(budget)} className="inline-flex items-center gap-2 rounded bg-[#eef8fc] px-3 py-2 text-[#16829b]"><FileText size={16} /> PDF</button><button onClick={() => setDrawer({ type: 'budget', budget })} className="inline-flex items-center gap-2 rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b]"><Pencil size={16} /> Editar</button><button onClick={() => removeBudget(budget)} title="Excluir" className="rounded border border-[#dfe5e8] px-3 py-2 text-[#16829b] hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div></td>
                      </tr>
                    ))}
                    {!loading && filteredBudgets.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-[#78838a]">Nenhum orçamento cadastrado ainda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
      {drawer?.type === 'settlement' && <SettlementDrawer transaction={drawer.transaction} onClose={() => setDrawer(null)} onSaved={async () => { await Promise.all([loadTransactions(), loadReceipts()]); setDrawer(null); }} />}
      {drawer?.type === 'transaction' && <TransactionDrawer clients={clients} transaction={drawer.transaction} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); loadTransactions(); }} onCreateReceipt={receiptFromTransaction} />}
      {drawer?.type?.startsWith('receipt') && <ReceiptDrawer clients={clients} receipt={drawer.receipt} onClose={() => setDrawer(null)} onSaved={(saved) => { setDrawer(null); loadReceipts(); loadTransactions(); setTab('Recibos'); setQuery(saved.number); }} />}
      {drawer?.type === 'budget' && <BudgetDrawer clients={clients} budget={drawer.budget} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); loadBudgets(); }} />}
    </div>
  );
}

function budgetStatusLabel(status) {
  const labels = {
    DRAFT: 'Rascunho',
    SENT: 'Enviado',
    APPROVED: 'Aprovado',
    REJECTED: 'Reprovado',
  };
  return labels[status] || status || '-';
}

function BudgetStatus({ status }) {
  const colors = {
    DRAFT: 'bg-zinc-100 text-zinc-700',
    SENT: 'bg-blue-50 text-blue-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-red-50 text-red-700',
  };
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${colors[status] || 'bg-zinc-100 text-zinc-700'}`}>{budgetStatusLabel(status)}</span>;
}

function SummaryCard({ label, value, tone }) {
  const colors = { green: 'text-emerald-700 bg-emerald-50', red: 'text-red-700 bg-red-50', blue: 'text-[#0b4f8f] bg-[#eef8fc]', amber: 'text-amber-700 bg-amber-50' };
  return <div className={`rounded border border-[#dfe5e8] p-4 ${colors[tone] || 'bg-white'}`}><p className="text-xs uppercase text-[#68737a]">{label}</p><strong className="mt-2 block text-2xl">{value}</strong></div>;
}

function MonthlyProjection({ rows, period, range, onRangeChange, error }) {
  return (
    <section className="mb-6 rounded border border-[#dfe5e8] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><BarChart3 size={18} className="shrink-0 text-[#16829b]" /><h2 className="font-semibold">{range === 'year' ? 'Projeção de entradas e saídas · 12 meses a partir de' : 'Entradas e saídas por dia ·'} {period}</h2></div>
        <div className="inline-flex shrink-0 rounded border p-0.5 text-xs" role="group" aria-label="Periodo do grafico">
          {[['month', 'Mês selecionado'], ['year', 'Próximos 12 meses']].map(([value, label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => onRangeChange(value)} className={`rounded px-3 py-2 ${range === value ? 'bg-[#eef8fc] font-semibold text-[#16829b]' : 'text-[#68737a]'}`}>{label}</button>)}
        </div>
      </div>
      {error && range === 'year' && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto"><div className={`grid gap-1 ${range === 'year' ? 'min-w-[600px]' : 'min-w-[900px]'}`} style={{ gridTemplateColumns: `repeat(${rows.length || 1}, minmax(0, 1fr))` }}>
        {rows.map((row) => (
          <div key={row.key} className="min-w-0">
            <div className="mb-2 flex h-28 items-end gap-1 rounded bg-[#f6f8fa] px-2 py-2">
              <ChartBar realized={row.recebido} forecast={row.aReceber} max={row.max} income label={row.label} />
              <ChartBar realized={row.pago} forecast={row.aPagar} max={row.max} label={row.label} />
            </div>
            <p className="text-center text-xs capitalize text-[#68737a]">{row.label}</p>
          </div>
        ))}
      </div></div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#68737a]">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded bg-emerald-500" /> Recebido</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded bg-red-400" /> Pago</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded border border-dashed border-emerald-600 bg-emerald-100" /> A receber (projeção)</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded border border-dashed border-red-500 bg-red-100" /> A pagar (projeção)</span>
      </div>
    </section>
  );
}

function ChartBar({ realized, forecast, max, income, label }) {
  const total = realized + forecast;
  return <div role="img" aria-label={`${label}: ${income ? 'Recebido' : 'Pago'} ${money(realized)}; ${income ? 'A receber' : 'A pagar'} ${money(forecast)}`} title={`${income ? 'Recebido' : 'Pago'}: ${money(realized)}\n${income ? 'A receber (projeção)' : 'A pagar (projeção)'}: ${money(forecast)}`} className="flex w-1/2 flex-col justify-end" style={{ height: `${total ? Math.max(3, total / max * 100) : 0}%` }}>
    {forecast > 0 && <span className={`block min-h-px rounded-t border border-dashed ${income ? 'border-emerald-600 bg-emerald-100' : 'border-red-500 bg-red-100'}`} style={{ flex: forecast }} />}
    {realized > 0 && <span className={`block min-h-px ${income ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ flex: realized }} />}
  </div>;
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
