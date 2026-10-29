import React from 'react';
import { NavLink } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function NewsMenuLink() {
  const { user } = useAuth();
  if (!['ADMIN', 'ACCOUNTANT'].includes(user?.role)) return null;
  return <NavLink to="/atualizacoes" className={({ isActive }) => `mb-4 flex items-center gap-2 rounded px-3 py-2 ${isActive ? 'bg-[#dce5ef] font-semibold text-[#3f4548]' : 'text-[#68737a] hover:bg-white'}`}><Newspaper aria-hidden="true" size={16} /> Atualizacoes</NavLink>;
}
