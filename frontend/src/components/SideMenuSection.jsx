import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

// Item de menu lateral com cabeçalho clicável (seta gira e os sub-itens
// deslizam para baixo). O próprio <nav> que envolve isso deve ter
// overflow-y-auto para rolar internamente quando uma seção abre.
export default function SideMenuSection({ icon: Icon, label, to, active, open, onToggle, children }) {
  return (
    <div className="mb-1">
      <div className={`flex items-center rounded ${active ? 'text-[#2f3a42]' : 'text-[#69747b]'}`}>
        <Link to={to} className={`flex flex-1 items-center gap-2 py-2 ${active ? 'font-semibold' : ''}`}>
          {Icon && <Icon size={16} />} {label}
        </Link>
        <button type="button" onClick={onToggle} className="px-2 py-2" aria-label={open ? 'Recolher' : 'Expandir'}>
          <ChevronDown size={15} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className={`ml-5 overflow-hidden transition-[max-height] duration-200 ${open ? 'max-h-96' : 'max-h-0'}`}>
        <div className="space-y-1 py-1">{children}</div>
      </div>
    </div>
  );
}
