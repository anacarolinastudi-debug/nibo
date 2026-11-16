import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FirmHeader from '../components/FirmHeader';
import NiboRail from '../components/NiboRail';
import ContentMenuLink from '../components/ContentMenuLink';

// Cronograma de estudos da reforma tributária. O conteúdo é uma página estática
// em /public/estudos, revisada diariamente; o progresso fica salvo no navegador.
const STUDY_PAGE = '/estudos/reforma-tributaria.html';
const CLAUDE_VERSION = 'https://claude.ai/artifact/3ux8RaTESwJLEEgsBA2JuR';

export default function Studies() {
  const { user } = useAuth();
  if (!['ADMIN', 'ACCOUNTANT'].includes(user?.role)) return <Navigate to="/" replace />;
  return <div className="min-h-screen bg-white text-[#3f4548]">
    <NiboRail />
    <aside className="fixed inset-y-0 left-[46px] hidden w-[236px] flex-col border-r bg-[#f4f7fb] xl:flex">
      <div className="flex h-[58px] items-center border-b px-5 text-xl">Contador</div>
      <nav aria-label="Menu do escritorio" className="overflow-y-auto p-5 text-sm text-[#68737a]">
        <p className="mb-4 text-xs">OPERACAO</p>
        {[['/', 'Obrigacoes'], ['/demandas', 'Tarefas & Processos'], ['/relacionamento', 'Relacionamento'], ['/financeiro', 'Financeiro']].map(([to, label]) => <Link key={to} to={to} className="mb-4 block px-3 py-2">{label}</Link>)}
        <ContentMenuLink /><Link to="/clientes" className="block px-3 py-2">Clientes</Link><Link to="/configuracoes" className="block px-3 py-2">Configuracoes</Link>
      </nav>
    </aside>
    <main className="ml-[46px] flex min-h-screen min-w-0 flex-col xl:ml-[282px]">
      <FirmHeader />
      <section className="flex min-w-0 flex-1 flex-col p-3 md:p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/" className="mb-2 inline-block text-sm text-[#16829b] xl:hidden">Voltar para obrigacoes</Link>
            <h1 className="text-2xl font-semibold">Estudos</h1>
            <p className="mt-1 text-sm text-[#68737a]">Cronograma da reforma tributária com foco fiscal, revisado diariamente. O progresso marcado aqui fica salvo neste navegador.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={STUDY_PAGE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-[#f4f7fb]"><ExternalLink size={16} aria-hidden="true" /> Abrir em tela cheia</a>
            <a href={CLAUDE_VERSION} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-[#f4f7fb]"><ExternalLink size={16} aria-hidden="true" /> Abrir no Claude</a>
          </div>
        </header>
        <iframe title="Cronograma de estudos da reforma tributária" src={STUDY_PAGE} className="min-h-[75vh] w-full flex-1 rounded border border-[#d8dfe3] bg-white" />
      </section>
    </main>
  </div>;
}
