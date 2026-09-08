import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ firmName: '', firmCnpj: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register-firm', form);
      await login(form.adminEmail, form.adminPassword);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível criar a conta. Confira os dados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f2e52] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-semibold text-white">
            Contábil<span className="text-[#57b9f6]">Gestão</span>
          </h1>
          <p className="text-white/50 text-sm mt-1">Crie a conta do seu escritório</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-7 shadow-xl">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-ink/80 mb-1">Nome do escritório</label>
            <input required value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2693d2]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink/80 mb-1">CNPJ do escritório</label>
            <input required value={form.firmCnpj} onChange={(e) => setForm({ ...form, firmCnpj: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2693d2]" placeholder="Somente números" />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink/80 mb-1">Seu nome</label>
            <input required value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2693d2]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink/80 mb-1">Seu e-mail</label>
            <input required type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2693d2]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink/80 mb-1">Senha</label>
            <input required type="password" minLength={6} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2693d2]" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[#003f82] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0d4b86] disabled:opacity-60">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>

          <p className="text-xs text-ink/40 text-center pt-1">
            Já tem conta? <Link to="/login" className="text-[#003f82] hover:underline">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
