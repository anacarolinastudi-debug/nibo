import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível entrar. Confira seus dados.');
    } finally {
      setLoading(false);
    }
  }

  function openPasswordReset() {
    setResetEmail(email);
    setResetSent(false);
    setResetError('');
    setResetOpen(true);
  }

  async function handlePasswordReset(e) {
    e.preventDefault();
    setResetError('');
    try {
      await api.post('/auth/password-reset', { email: resetEmail });
      setResetSent(true);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Não encontramos esse e-mail no sistema.');
    }
  }

  return (
    <div className="min-h-screen bg-[#0f2e52] text-white">
      <div className="relative flex min-h-screen items-center overflow-hidden px-6 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(38,147,210,0.26),transparent_32%),radial-gradient(circle_at_82%_24%,rgba(22,130,155,0.2),transparent_28%),linear-gradient(135deg,#0b1f39_0%,#0f2e52_48%,#0d4b86_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
              <ShieldCheck size={15} strokeWidth={1.9} className="text-[#7ed0ff]" />
              Gestão contábil segura
            </div>

            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Contábil<span className="text-[#57b9f6]">Gestão</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/65">
              Centralize demandas, clientes, financeiro e documentos em um painel feito para a rotina do escritório.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {['Demandas em dia', 'Clientes organizados', 'Financeiro claro'].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                  <CheckCircle2 className="mb-3 text-[#57b9f6]" size={20} strokeWidth={1.8} />
                  <p className="text-sm font-medium text-white/85">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="w-full justify-self-center lg:max-w-md">
            <div className="mb-6 text-center lg:text-left">
              <p className="text-sm font-medium uppercase text-[#7ed0ff]">Acesso ao sistema</p>
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
                  <div className="flex items-center rounded-lg border border-ink/15 bg-white px-3 transition focus-within:border-[#2693d2] focus-within:ring-2 focus-within:ring-[#2693d2]/20">
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
                  <div className="flex items-center rounded-lg border border-ink/15 bg-white px-3 transition focus-within:border-[#2693d2] focus-within:ring-2 focus-within:ring-[#2693d2]/20">
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
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={openPasswordReset}
                      className="text-xs font-medium text-[#003f82] transition hover:text-[#0d4b86] hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#003f82] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0d4b86] disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
                {!loading && <ArrowRight size={17} strokeWidth={1.9} />}
              </button>

              <div className="mt-5 rounded-lg border border-ink/10 bg-white/70 px-3 py-3 text-center text-xs leading-5 text-ink/50">
                Dados de teste: admin@exemplo.com / senha123
              </div>

              <p className="mt-5 text-center text-xs text-ink/45">
                Ainda não tem conta?{' '}
                <Link to="/registrar" className="font-medium text-[#003f82] hover:underline">
                  Cadastre seu escritório
                </Link>
              </p>
            </form>
          </section>
        </div>
      </div>

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <form
            onSubmit={handlePasswordReset}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-paper p-6 text-ink shadow-2xl shadow-black/30"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf6ff] text-[#003f82]">
                  <KeyRound size={21} strokeWidth={1.9} />
                </div>
                <h3 className="text-xl font-semibold text-ink">Redefinir senha</h3>
                <p className="mt-1 text-sm leading-6 text-ink/55">
                  Informe seu e-mail para registrar a solicitação de troca de senha.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="rounded-full p-1.5 text-ink/45 transition hover:bg-ink/5 hover:text-ink"
                aria-label="Fechar"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            {resetSent ? (
              <div className="rounded-xl border border-[#b7e1ff] bg-[#f0f9ff] px-4 py-4 text-sm leading-6 text-[#0d4b86]">
                Solicitação enviada. O administrador verá o pedido em Configurações &gt; Equipe.
              </div>
            ) : (
              <>
                {resetError && (
                  <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {resetError}
                  </p>
                )}
                <label className="mb-1.5 block text-sm font-medium text-ink/80">E-mail cadastrado</label>
                <div className="flex items-center rounded-lg border border-ink/15 bg-white px-3 transition focus-within:border-[#2693d2] focus-within:ring-2 focus-within:ring-[#2693d2]/20">
                  <Mail className="text-ink/35" size={18} strokeWidth={1.8} />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-ink/35"
                    placeholder="voce@empresa.com.br"
                  />
                </div>

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setResetOpen(false)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#003f82] transition hover:bg-[#eaf6ff]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#003f82] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d4b86]"
                  >
                    Solicitar redefinição
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
