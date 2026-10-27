import React from 'react';
import { NavLink } from 'react-router-dom';
import { Images } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ContentMenuLink() {
  const { user } = useAuth();
  if (user?.role === 'CLIENT') return null;
  return <NavLink to="/conteudos" className={({ isActive }) => `mb-4 flex items-center gap-2 rounded px-3 py-2 ${isActive ? 'bg-[#dce5ef] font-semibold text-[#3f4548]' : 'text-[#68737a] hover:bg-white'}`}><Images size={16} /> Conteúdos</NavLink>;
}
