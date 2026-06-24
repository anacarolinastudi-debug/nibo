import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, ListChecks, MessageCircle, RefreshCw, TriangleAlert, Users } from 'lucide-react';
import { getStatus, getLatestByClient, syncClient } from '../api/ecac';
import NiboRail from '../components/NiboRail';
import SideMenuSection from '../components/SideMenuSection';

function RadarMenu() {
  const [openSection, setOpenSection] = useState(null);
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
        <p className="mb-4 flex items-center gap-2 font-semibold">
          Radar e-CAC <b className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] text-white">NOVO</b>
        </p>
        <p className="mb-4 border-t pt-4 text-xs font-semibold text-[#7b858c]">CADASTROS</p>
        <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === 'clientes'} onToggle={() => toggleSection('clientes')}>
          {['Meus clientes', 'Contatos'].map((item) => (
            <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <Link to="/formularios" className="flex items-center gap-2 text-[#68737a]"><ClipboardList size={16} /> Formulários</Link>
      </nav>
    </aside>
  );
}

const situationColor = {
  SUCESSO: 'bg-emerald-100 text-emerald-700',
  ERRO: 'bg-red-100 text-red-700',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
};

export default function RadarEcac() {
  const [configured, setConfigured] = useState(true);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([getStatus(), getLatestByClient()])
      .then(([status, latest]) => {
        setConfigured(status.configured);
        setRows(latest);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSync(clientId) {
    setSyncingId(clientId);
    try {
      await syncClient(clientId);
      window.setTimeout(load, 4000);
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível iniciar a sincronização.');
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="nibo-ui min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <RadarMenu />
      <main className="ml-[282px] min-h-screen">
        <header className="flex h-[58px] items-center justify-between border-b border-[#dfe5e8] px-5">
          <div className="text-base text-[#60666b]">52.107.544 ANA CAROLINA CARPINE AGUIAR</div>
        </header>
        <section className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Radar e-CAC</h1>
            <button onClick={load} className="flex items-center gap-2 rounded border border-[#dfe5e8] px-4 py-2 text-[#16829b]">
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>

          {!configured && (
            <div className="mb-5 flex items-start gap-3 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" />
              <div>
                <b>Certificado digital não configurado.</b> A tela funciona normalmente para visualizar o histórico, mas a sincronização com o e-CAC só roda depois de configurar <code>RECEITA_CERT_PFX_BASE64</code> e <code>RECEITA_CERT_PASSPHRASE</code> no servidor, com seu certificado e-CNPJ e a procuração eletrônica de cada cliente já outorgada.
              </div>
            </div>
          )}

          <p className="mb-4 text-sm text-[#68737a]">
            Consulta automática de pendências fiscais no e-CAC, todos os dias às 6h, para os clientes ativos. Você também pode sincronizar um cliente específico manualmente.
          </p>

          {!loading && rows.length === 0 && <p className="py-10 text-center text-[#78838a]">Nenhum cliente ativo cadastrado.</p>}

          {rows.length > 0 && (
            <div className="overflow-hidden rounded border border-[#dfe5e8]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f3f3f3]">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Última verificação</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pendências encontradas</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ client, check }) => (
                    <tr key={client.id} className="border-t border-[#dfe5e8] align-top">
                      <td className="px-4 py-3">
                        <b>{client.name}</b>
                        <p className="text-xs text-[#78838a]">{client.cnpj}</p>
                      </td>
                      <td className="px-4 py-3">{check ? new Date(check.startedAt).toLocaleString('pt-BR') : 'Nunca verificado'}</td>
                      <td className="px-4 py-3">
                        {check ? (
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${situationColor[check.status]}`}>{check.status}</span>
                        ) : (
                          <span className="text-xs text-[#9aa5ad]">-</span>
                        )}
                        {check?.status === 'ERRO' && <p className="mt-1 text-xs text-red-600">{check.errorMessage}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {check?.pendencies?.length ? (
                          <ul className="space-y-1">
                            {check.pendencies.map((item) => (
                              <li key={item.id} className="text-xs">
                                <b>{item.type}</b> — {item.description} {item.amount ? `(R$ ${Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-[#9aa5ad]">{check?.status === 'SUCESSO' ? 'Nenhuma pendência' : '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleSync(client.id)}
                          disabled={syncingId === client.id}
                          className="rounded bg-[#2693d2] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                        >
                          {syncingId === client.id ? 'Sincronizando…' : 'Sincronizar agora'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
