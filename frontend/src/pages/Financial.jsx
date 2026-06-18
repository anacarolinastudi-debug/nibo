import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function NewTransactionModal({ clients, accounts, categories, onClose, onCreated }) {
  const [form, setForm] = useState({
    description: '', amount: '', type: 'DESPESA', dueDate: '',
    clientId: clients[0]?.id || '', accountId: accounts[0]?.id || '', categoryId: categories[0]?.id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/financial/transactions', {
        ...form,
        amount: Number(form.amount),
        dueDate: new Date(form.dueDate).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível salvar o lançamento.');
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories = categories.filter((c) => c.type === form.type);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Novo lançamento</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setForm({ ...form, type: 'RECEITA' })}
            className={`py-2 rounded-lg text-sm font-medium border ${form.type === 'RECEITA' ? 'bg-brand-500 text-white border-brand-500' : 'border-ink/15 text-ink/60'}`}>
            Receita
          </button>
          <button type="button" onClick={() => setForm({ ...form, type: 'DESPESA' })}
            className={`py-2 rounded-lg text-sm font-medium border ${form.type === 'DESPESA' ? 'bg-red-500 text-white border-red-500' : 'border-ink/15 text-ink/60'}`}>
            Despesa
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Valor (R$)</label>
            <input required type="number" step="0.01" min="0.01" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vencimento</label>
            <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
        </div>

        {clients.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Conta</label>
            <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
              {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-ink/60 hover:bg-ink/5">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar lançamento'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Financial() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const [summaryRes, txRes, accRes, catRes, clientsRes] = await Promise.all([
      api.get('/financial/summary'),
      api.get('/financial/transactions'),
      api.get('/financial/accounts'),
      api.get('/financial/categories'),
      user.role !== 'CLIENT' ? api.get('/clients') : Promise.resolve({ data: [] }),
    ]);
    setSummary(summaryRes.data);
    setTransactions(txRes.data);
    setAccounts(accRes.data);
    setCategories(catRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleMarkPaid(id) {
    await api.patch(`/financial/transactions/${id}/pay`);
    load();
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-ink/50 text-sm">Contas, lançamentos e conciliação.</p>
        </div>
        <button onClick={() => setShowModal(true)} disabled={accounts.length === 0 || categories.length === 0}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg disabled:opacity-50">
          + Novo lançamento
        </button>
      </div>

      {!loading && (accounts.length === 0 || categories.length === 0) && (
        <p className="text-sm text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2 mb-6">
          Cadastre ao menos uma conta bancária e uma categoria (plano de contas) pela API para começar a lançar — telas de cadastro rápido podem ser adicionadas depois.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-ink/10">
          <p className="text-xs text-ink/50 uppercase tracking-wide">Receitas do mês</p>
          <p className="text-2xl font-display font-semibold mt-2 text-brand-600">{loading ? '—' : money(summary?.receitasMes)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-ink/10">
          <p className="text-xs text-ink/50 uppercase tracking-wide">Despesas do mês</p>
          <p className="text-2xl font-display font-semibold mt-2 text-red-600">{loading ? '—' : money(summary?.despesasMes)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-ink/10">
          <p className="text-xs text-ink/50 uppercase tracking-wide">Saldo em contas</p>
          <p className="text-2xl font-display font-semibold mt-2">{loading ? '—' : money(summary?.saldoTotal)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-ink/10">
          <p className="text-xs text-ink/50 uppercase tracking-wide">A vencer</p>
          <p className="text-2xl font-display font-semibold mt-2 text-amber-500">{loading ? '—' : summary?.pendentesAVencer}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-ink/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Descrição</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-left px-4 py-3">Vencimento</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3 text-ink/60">{t.category?.name}</td>
                <td className="px-4 py-3 text-ink/60">{new Date(t.dueDate).toLocaleDateString('pt-BR')}</td>
                <td className={`px-4 py-3 text-right font-mono ${t.type === 'RECEITA' ? 'text-brand-600' : 'text-red-600'}`}>
                  {t.type === 'RECEITA' ? '+' : '-'} {money(t.amount)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'PAID' ? 'bg-brand-50 text-brand-700' : 'bg-amber-500/15 text-amber-500'}`}>
                    {t.status === 'PAID' ? 'Pago' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {t.status === 'PENDING' && (
                    <button onClick={() => handleMarkPaid(t.id)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && transactions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink/40">Nenhum lançamento ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <NewTransactionModal
          clients={clients} accounts={accounts} categories={categories}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  );
}
