import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-ink/10">
      <p className="text-xs text-ink/50 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-display font-semibold mt-2 ${accent || 'text-ink'}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [demands, setDemands] = useState([]);
  const [clients, setClients] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [demandsRes, clientsRes, financialRes] = await Promise.all([
        api.get('/demands'),
        user.role !== 'CLIENT' ? api.get('/clients') : Promise.resolve({ data: [] }),
        api.get('/financial/summary'),
      ]);
      setDemands(demandsRes.data);
      setClients(clientsRes.data);
      setFinancialSummary(financialRes.data);
      setLoading(false);
    }
    load();
  }, []);

  const pending = demands.filter((d) => d.status === 'PENDING').length;
  const urgent = demands.filter((d) => d.priority === 'URGENT' && d.status !== 'DONE').length;
  const overdue = demands.filter((d) => d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'DONE').length;
  const done = demands.filter((d) => d.status === 'DONE').length;

  return (
    <Layout>
      <h1 className="text-2xl font-semibold mb-1">Olá, {user?.name?.split(' ')[0]}</h1>
      <p className="text-ink/50 mb-6">Aqui está o resumo das demandas em andamento.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Pendentes" value={loading ? '—' : pending} />
        <StatCard label="Urgentes" value={loading ? '—' : urgent} accent="text-amber-500" />
        <StatCard label="Atrasadas" value={loading ? '—' : overdue} accent="text-red-600" />
        <StatCard label="Concluídas" value={loading ? '—' : done} accent="text-brand-500" />
      </div>

      {user.role !== 'CLIENT' && (
        <div className="bg-white rounded-xl border border-ink/10 p-5 mb-8">
          <p className="text-sm font-medium mb-1">Empresas-cliente ativas</p>
          <p className="text-2xl font-display font-semibold">{loading ? '—' : clients.length}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Receitas do mês" value={loading ? '—' : money(financialSummary?.receitasMes)} accent="text-brand-600" />
        <StatCard label="Despesas do mês" value={loading ? '—' : money(financialSummary?.despesasMes)} accent="text-red-600" />
        <StatCard label="Saldo em contas" value={loading ? '—' : money(financialSummary?.saldoTotal)} />
      </div>

      <div className="bg-white rounded-xl border border-ink/10 p-5">
        <p className="text-sm font-medium mb-3">Próximos vencimentos</p>
        {loading ? (
          <p className="text-sm text-ink/40">Carregando...</p>
        ) : demands.filter((d) => d.status !== 'DONE').length === 0 ? (
          <p className="text-sm text-ink/40">Nenhuma demanda pendente. Tudo em dia.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {demands
              .filter((d) => d.status !== 'DONE')
              .slice(0, 6)
              .map((d) => (
                <li key={d.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span>{d.title}</span>
                  <span className="text-ink/40">
                    {d.dueDate ? new Date(d.dueDate).toLocaleDateString('pt-BR') : 'sem prazo'}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
