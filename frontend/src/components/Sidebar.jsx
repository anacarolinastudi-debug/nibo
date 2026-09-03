import React from 'react';
import { NavLink } from 'react-router-dom';
import { BadgeDollarSign, ClipboardCheck, ClipboardList, Files, LayoutDashboard, ReceiptText, Users, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Painel', icon: LayoutDashboard },
  { to: '/demandas', label: 'Tarefas & Processos', icon: ClipboardList },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/financeiro', label: 'Financeiro', icon: WalletCards },
  { to: '/notas-fiscais', label: 'Notas fiscais', icon: ReceiptText },
  { to: '/folha-pagamento', label: 'Folha de pagamento', icon: BadgeDollarSign },
  { to: '/documentos', label: 'Documentos', icon: Files },
  { to: '/formularios', label: 'Formulários', icon: ClipboardCheck },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-ink text-white">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="font-display text-lg font-semibold leading-tight">Contábil<span className="text-brand-400">Gestão</span></p>
        <p className="mt-1 text-xs text-white/50">Demandas &amp; finanças em um só lugar</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const Icon = link.icon;
          return <NavLink key={link.to} to={link.to} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? 'bg-brand-600 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}><Icon aria-hidden="true" size={18} strokeWidth={1.8} />{link.label}</NavLink>;
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-medium">{user?.name}</p>
        <p className="truncate text-xs text-white/50">{user?.role === 'CLIENT' ? 'Portal do cliente' : user?.role}</p>
        <button onClick={logout} className="mt-3 w-full text-left text-sm text-white/60 transition-colors hover:text-white">Sair da conta</button>
      </div>
    </aside>
  );
}
