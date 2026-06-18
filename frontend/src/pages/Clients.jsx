import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';

const REGIME_LABELS = {
  MEI: 'MEI',
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
};

function NewClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', cnpj: '', taxRegime: 'SIMPLES_NACIONAL', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/clients', form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível cadastrar o cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Nova empresa-cliente</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Razão social</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">CNPJ</label>
          <input required value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" placeholder="Somente números" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Regime tributário</label>
          <select value={form.taxRegime} onChange={(e) => setForm({ ...form, taxRegime: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
            {Object.entries(REGIME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">E-mail de contato</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-ink/60 hover:bg-ink/5">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/clients');
    setClients(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-ink/50 text-sm">Empresas atendidas pelo escritório.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
          + Novo cliente
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink/40">Carregando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-ink/50 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Razão social</th>
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-left px-4 py-3">Regime</th>
                <th className="text-left px-4 py-3">Demandas abertas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-ink/60">{c.cnpj}</td>
                  <td className="px-4 py-3">{REGIME_LABELS[c.taxRegime]}</td>
                  <td className="px-4 py-3">{c._count?.demands ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <NewClientModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </Layout>
  );
}
