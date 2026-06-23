import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, CircleHelp, ClipboardCheck } from 'lucide-react';

// Barra azul fixa de navegação principal. É o mesmo componente em todas as
// páginas para não "pular" visualmente ao trocar de tela.
export default function NiboRail() {
  const { pathname } = useLocation();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[46px] flex-col items-center bg-[#003f82] text-white">
      <b className="mt-4 text-2xl">n</b>
      <div className="mt-6 flex flex-1 flex-col gap-2">
        <Link to="/" title="Obrigações" className={`grid h-9 w-9 place-items-center rounded ${pathname === '/' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
          <ClipboardCheck size={18} />
        </Link>
        <span title="Relatórios" className="grid h-9 w-9 place-items-center rounded text-white/50">
          <BarChart3 size={18} />
        </span>
      </div>
      <div className="mb-4 flex flex-col items-center gap-3">
        <CircleHelp size={18} title="Ajuda" />
        <span className="grid h-8 w-8 place-items-center rounded-full border border-white/70 text-xs">AC</span>
      </div>
    </aside>
  );
}
