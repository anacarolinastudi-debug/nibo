import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Painel', icon: '◧' },
  { to: '/demandas', label: 'Demandas', icon: '☑' },
  { to: '/clientes', label: 'Clientes', icon: '⛁' },
  { to: '/financeiro', label: 'Financeiro', icon: '$' },
  { to: '/notas-fiscais', label: 'Notas fiscais', icon: '▤' },
  { to: '/folha-pagamento', label: 'Folha de pagamento', icon: '♟' },
  { to: '/documentos', label: 'Documentos', icon: '⎙' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-ink text-white flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-white/10">
        <p className="font-display font-semibold text-lg leading-tight">Contábil<span className="text-brand-400">Gestão</span></p>
        <p className="text-xs text-white/50 mt-1">Demandas &amp; finanças em um só lugar</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-brand-600 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span aria-hidden="true">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-sm font-medium truncate">{user?.name}</p>
        <p className="text-xs text-white/50 truncate">{user?.role === 'CLIENT' ? 'Portal do cliente' : user?.role}</p>
        <button
          onClick={logout}
          className="mt-3 w-full text-left text-sm text-white/60 hover:text-white transition-colors"
        >
          Sair da conta
        </button>
      </div>
    </aside>
  );
}
