import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleHelp, FileText, LogOut, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Barra azul fixa de navegação principal. É o mesmo componente em todas as
// páginas para não "pular" visualmente ao trocar de tela.
export default function NiboRail() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[46px] flex-col items-center bg-[#003f82] text-white">
      <b className="mt-4 text-2xl">n</b>
      <div className="flex-1" />
      <div className="relative mb-4 flex flex-col items-center gap-3">
        <CircleHelp size={18} title="Ajuda" />
        <button onClick={() => setShowMenu((current) => !current)} className="grid h-8 w-8 place-items-center rounded-full border border-white/70 text-xs">
          AC
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute bottom-12 left-10 z-50 w-64 rounded-lg bg-white text-[#3f4548] shadow-xl">
              <div className="border-b border-[#eef0f2] px-4 py-3">
                <p className="font-semibold leading-tight">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-[#78838a]">{user?.email}</p>
              </div>
              <nav className="py-1 text-sm">
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#f4f7fb]"><ShieldCheck size={15} /> Meus dados e segurança</button>
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#f4f7fb]"><Bell size={15} /> Minhas notificações</button>
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-[#f4f7fb]"><FileText size={15} /> Minhas faturas</button>
              </nav>
              <div className="border-t border-[#eef0f2] py-1 text-sm">
                <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-red-600 hover:bg-[#f4f7fb]"><LogOut size={15} /> Sair</button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
