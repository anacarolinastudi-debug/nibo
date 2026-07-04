import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Nao foi possivel entrar. Confira seus dados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="relative flex min-h-screen items-center overflow-hidden px-6 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(62,156,124,0.32),transparent_32%),linear-gradient(135deg,#142019_0%,#142019_48%,#175E46_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
              <ShieldCheck size={15} strokeWidth={1.9} />
              Gestao contabil segura
            </div>

            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Contabil<span className="text-brand-400">Gestao</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/65">
              Centralize demandas, clientes, financeiro e documentos em um painel feito para a rotina do escritorio.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {['Demandas em dia', 'Clientes organizados', 'Financeiro claro'].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                  <CheckCircle2 className="mb-3 text-brand-400" size={20} strokeWidth={1.8} />
                  <p className="text-sm font-medium text-white/85">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="w-full justify-self-center lg:max-w-md">
            <div className="mb-6 text-center lg:text-left">
              <p className="text-sm font-medium uppercase text-brand-400">Acesso ao sistema</p>
              <h2 className="mt-2 text-2xl font-semibold">Entre na sua conta</h2>
              <p className="mt-1 text-sm text-white/55">Use seus dados cadastrados para continuar.</p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/15 bg-paper p-7 text-ink shadow-2xl shadow-black/25"
            >
              {error && (
                <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink/80">E-mail</label>
                  <div className="flex items-center rounded-lg border border-ink/15 bg-white px-3 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                    <Mail className="text-ink/35" size={18} strokeWidth={1.8} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-ink/35"
                      placeholder="voce@empresa.com.br"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink/80">Senha</label>
                  <div className="flex items-center rounded-lg border border-ink/15 bg-white px-3 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                    <LockKeyhole className="text-ink/35" size={18} strokeWidth={1.8} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-ink/35"
                      placeholder="senha"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
                {!loading && <ArrowRight size={17} strokeWidth={1.9} />}
              </button>

              <div className="mt-5 rounded-lg border border-ink/10 bg-white/70 px-3 py-3 text-center text-xs leading-5 text-ink/50">
                Dados de teste: admin@exemplo.com / senha123
              </div>

              <p className="mt-5 text-center text-xs text-ink/45">
                Ainda nao tem conta?{' '}
                <Link to="/registrar" className="font-medium text-brand-600 hover:underline">
                  Cadastre seu escritorio
                </Link>
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
