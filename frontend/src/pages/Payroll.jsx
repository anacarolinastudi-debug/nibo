import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function NewEmployeeModal({ clients, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', cpf: '', role: '', baseSalary: '', admissionAt: '', clientId: clients[0]?.id || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/payroll/employees', {
        ...form,
        baseSalary: Number(form.baseSalary),
        admissionAt: new Date(form.admissionAt).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível cadastrar o funcionário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Novo funcionário</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Nome completo</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">CPF</label>
            <input required value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" placeholder="Somente números" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cargo</label>
            <input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Salário base (R$)</label>
            <input required type="number" step="0.01" value={form.baseSalary}
              onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Admissão</label>
            <input required type="date" value={form.admissionAt}
              onChange={(e) => setForm({ ...form, admissionAt: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm" />
          </div>
        </div>

        {clients.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Empresa-cliente</label>
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

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

export default function Payroll() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const now = new Date();
  const [refMonth, setRefMonth] = useState(now.getMonth() + 1);
  const [refYear, setRefYear] = useState(now.getFullYear());

  async function load() {
    setLoading(true);
    const [empRes, entriesRes, clientsRes] = await Promise.all([
      api.get('/payroll/employees'),
      api.get('/payroll/entries', { params: { refMonth, refYear } }),
      user.role !== 'CLIENT' ? api.get('/clients') : Promise.resolve({ data: [] }),
    ]);
    setEmployees(empRes.data);
    setEntries(entriesRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [refMonth, refYear]);

  async function handleGenerate(employeeId) {
    await api.post('/payroll/entries/generate', { employeeId, refMonth, refYear });
    load();
  }

  const entryByEmployee = Object.fromEntries(entries.map((e) => [e.employeeId, e]));

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Folha de pagamento</h1>
          <p className="text-ink/50 text-sm max-w-2xl">
            Cálculo simplificado de INSS, IRRF e FGTS para fins de demonstração. As faixas usadas precisam ser revisadas por um contador antes de qualquer uso real, já que as tabelas oficiais mudam todo ano.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0">
          + Novo funcionário
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select value={refMonth} onChange={(e) => setRefMonth(Number(e.target.value))} className="rounded-lg border border-ink/15 px-3 py-2 text-sm">
          {MONTHS.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
        </select>
        <select value={refYear} onChange={(e) => setRefYear(Number(e.target.value))} className="rounded-lg border border-ink/15 px-3 py-2 text-sm">
          {[refYear - 1, refYear, refYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-ink/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Funcionário</th>
              <th className="text-left px-4 py-3">Cargo</th>
              <th className="text-right px-4 py-3">Salário bruto</th>
              <th className="text-right px-4 py-3">INSS</th>
              <th className="text-right px-4 py-3">IRRF</th>
              <th className="text-right px-4 py-3">Líquido</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {employees.map((emp) => {
              const entry = entryByEmployee[emp.id];
              return (
                <tr key={emp.id}>
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-ink/60">{emp.role}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(emp.baseSalary)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink/60">{entry ? money(entry.inss) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink/60">{entry ? money(entry.irrf) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{entry ? money(entry.netSalary) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleGenerate(emp.id)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                      {entry ? 'Recalcular' : 'Gerar folha'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && employees.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-ink/40">Nenhum funcionário cadastrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <NewEmployeeModal clients={clients} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </Layout>
  );
}
