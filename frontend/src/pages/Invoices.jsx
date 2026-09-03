import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_LABELS = { DRAFT: 'Rascunho', ISSUED: 'Emitida', CANCELED: 'Cancelada', ERROR: 'Erro' };
const STATUS_STYLES = {
  DRAFT: 'bg-ink/5 text-ink/60',
  ISSUED: 'bg-brand-50 text-brand-700',
  CANCELED: 'bg-red-100 text-red-700',
  ERROR: 'bg-red-100 text-red-700',
};

function NewInvoiceModal({ clients, onClose, onCreated }) {
  const [type, setType] = useState('NFSE');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unitValue: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateItem(idx, field, value) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  }

  const total = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitValue) || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/invoices', {
        type, clientId, description,
        items: items.map((i) => ({ ...i, quantity: Number(i.quantity), unitValue: Number(i.unitValue) })),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível criar a nota.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
        <h2 className="text-lg font-semibold">Nova nota fiscal</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setType('NFSE')}
            className={`py-2 rounded-lg text-sm font-medium border ${type === 'NFSE' ? 'bg-brand-500 text-white border-brand-500' : 'border-ink/15 text-ink/60'}`}>
            NFS-e (serviço)
          </button>
          <button type="button" onClick={() => setType('NFE')}
            className={`py-2 rounded-lg text-sm font-medium border ${type === 'NFE' ? 'bg-brand-500 text-white border-brand-500' : 'border-ink/15 text-ink/60'}`}>
            NF-e (produto)
          </button>
        </div>

        {clients.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Descrição geral</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Itens</label>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_70px_90px] gap-2">
              <input placeholder="Descrição do item" required value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm" />
              <input type="number" min="1" placeholder="Qtd" required value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm" />
              <input type="number" step="0.01" placeholder="Valor un." required value={item.unitValue}
                onChange={(e) => updateItem(idx, 'unitValue', e.target.value)}
                className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm" />
            </div>
          ))}
          <button type="button" onClick={() => setItems([...items, { description: '', quantity: 1, unitValue: '' }])}
            className="text-xs text-brand-600 font-medium">+ adicionar item</button>
        </div>

        <p className="text-sm font-medium text-right">Total: {money(total)}</p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-ink/60 hover:bg-ink/5">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar como rascunho'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const [invRes, clientsRes] = await Promise.all([
      api.get('/invoices'),
      user.role !== 'CLIENT' ? api.get('/clients') : Promise.resolve({ data: [] }),
    ]);
    setInvoices(invRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleIssue(id) {
    await api.patch(`/invoices/${id}/issue`);
    load();
  }

  async function handleCancel(id) {
    await api.patch(`/invoices/${id}/cancel`);
    load();
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Notas fiscais</h1>
          <p className="text-ink/50 text-sm">
            Registro interno de notas. Emissão oficial perante a SEFAZ requer um provedor homologado (ex.: eNotas, Focus NFe) — aqui o status "Emitida" é apenas o controle interno.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0">
          + Nova nota
        </button>
      </div>

      <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-ink/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Número</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-4 py-3 font-mono">{inv.number}</td>
                <td className="px-4 py-3">{inv.type === 'NFE' ? 'NF-e' : 'NFS-e'}</td>
                <td className="px-4 py-3">{inv.client?.name}</td>
                <td className="px-4 py-3 text-right font-mono">{money(inv.totalValue)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.status]}`}>{STATUS_LABELS[inv.status]}</span>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  {inv.status === 'DRAFT' && (
                    <button onClick={() => handleIssue(inv.id)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Emitir</button>
                  )}
                  {inv.status !== 'CANCELED' && (
                    <button onClick={() => handleCancel(inv.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Cancelar</button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink/40">Nenhuma nota fiscal ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <NewInvoiceModal clients={clients} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </Layout>
  );
}
