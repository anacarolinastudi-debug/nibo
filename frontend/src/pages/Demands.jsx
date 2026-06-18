import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const COLUMNS = [
  { key: 'PENDING', label: 'Pendente' },
  { key: 'IN_PROGRESS', label: 'Em andamento' },
  { key: 'WAITING_CLIENT', label: 'Aguardando cliente' },
  { key: 'DONE', label: 'Concluída' },
];

const PRIORITY_STYLES = {
  LOW: 'bg-ink/5 text-ink/60',
  MEDIUM: 'bg-brand-50 text-brand-700',
  HIGH: 'bg-amber-500/15 text-amber-500',
  URGENT: 'bg-red-100 text-red-700',
};

const PRIORITY_LABELS = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' };
const CATEGORY_LABELS = {
  FISCAL: 'Fiscal',
  CONTABIL: 'Contábil',
  FOLHA_PAGAMENTO: 'Folha de pagamento',
  SOCIETARIO: 'Societário',
  FINANCEIRO: 'Financeiro',
  DOCUMENTACAO: 'Documentação',
  OUTROS: 'Outros',
};

function NewDemandModal({ clients, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'DOCUMENTACAO', priority: 'MEDIUM', dueDate: '', clientId: clients[0]?.id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/demands', {
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível criar a demanda.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Nova demanda</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Título</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            placeholder="Ex.: Enviar nota fiscal de Junho"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            rows={2}
          />
        </div>

        {clients.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prioridade</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
            >
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Prazo</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-ink/60 hover:bg-ink/5">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Criar demanda'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DemandCard({ demand, onAdvance }) {
  const isOverdue = demand.dueDate && new Date(demand.dueDate) < new Date() && demand.status !== 'DONE';

  return (
    <div className="bg-white rounded-xl border border-ink/10 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{demand.title}</p>
        <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${PRIORITY_STYLES[demand.priority]}`}>
          {PRIORITY_LABELS[demand.priority]}
        </span>
      </div>
      <p className="text-xs text-ink/50">{demand.client?.name}</p>
      <div className="flex items-center justify-between pt-1">
        <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-ink/40'}`}>
          {demand.dueDate ? new Date(demand.dueDate).toLocaleDateString('pt-BR') : 'sem prazo'}
        </span>
        {demand.status !== 'DONE' && (
          <button onClick={() => onAdvance(demand)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            Avançar →
          </button>
        )}
      </div>
    </div>
  );
}

export default function Demands() {
  const { user } = useAuth();
  const [demands, setDemands] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const [demandsRes, clientsRes] = await Promise.all([
      api.get('/demands'),
      user.role !== 'CLIENT' ? api.get('/clients') : Promise.resolve({ data: [] }),
    ]);
    setDemands(demandsRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdvance(demand) {
    const order = COLUMNS.map((c) => c.key);
    const nextStatus = order[order.indexOf(demand.status) + 1];
    if (!nextStatus) return;
    await api.patch(`/demands/${demand.id}/status`, { status: nextStatus });
    load();
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Demandas</h1>
          <p className="text-ink/50 text-sm">Acompanhe as solicitações entre escritório e clientes.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
        >
          + Nova demanda
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink/40">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                {col.label} · {demands.filter((d) => d.status === col.key).length}
              </p>
              <div className="space-y-3">
                {demands.filter((d) => d.status === col.key).map((d) => (
                  <DemandCard key={d.id} demand={d} onAdvance={handleAdvance} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NewDemandModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  );
}
