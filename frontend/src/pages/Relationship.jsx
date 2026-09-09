import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, ClipboardList, Copy, ExternalLink, ListChecks, MessageCircle, Plus, Search, Send, Settings, TriangleAlert, Users, X } from 'lucide-react';
import { getStatus, listConversations, createConversation, getConversationMessages } from '../api/whatsapp';
import api from '../api/client';
import FirmHeader from '../components/FirmHeader';
import NiboRail from '../components/NiboRail';
import SideMenuSection from '../components/SideMenuSection';

function RelationshipMenu() {
  const [openSection, setOpenSection] = useState('relacionamento');
  const toggleSection = (key) => setOpenSection((current) => (current === key ? null : key));

  return (
    <aside className="fixed inset-y-0 left-[46px] z-20 flex w-[236px] flex-col border-r border-[#dfe5e8] bg-[#f4f7fb]">
      <div className="flex h-[58px] shrink-0 items-center border-b border-[#dfe5e8] px-5 text-xl">Contador</div>
      <nav className="flex-1 overflow-y-auto px-5 py-5 text-sm">
        <p className="mb-4 text-xs font-semibold text-[#7b858c]">OPERAÇÃO</p>
        <Link to="/" className="mb-4 flex items-center gap-2 text-[#68737a]"><ClipboardCheck size={16} /> Obrigações</Link>
        <SideMenuSection icon={ListChecks} label="Tarefas & Processos" to="/demandas" open={openSection === 'tarefas'} onToggle={() => toggleSection('tarefas')}>
          {['Tarefas', 'Processos', 'Configurações'].map((item) => (
            <Link key={item} to="/demandas" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <p className="mb-4 mt-1 flex items-center gap-2 font-semibold"><MessageCircle size={16} /> Relacionamento</p>
        <Link to="/radar-ecac" className="mb-4 flex items-center gap-2 text-[#68737a]">Radar e-CAC <b className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] text-white">NOVO</b></Link>
        <p className="mb-4 border-t pt-4 text-xs font-semibold text-[#7b858c]">CADASTROS</p>
        <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === 'clientes'} onToggle={() => toggleSection('clientes')}>
          {['Meus clientes', 'Contatos'].map((item) => (
            <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <Link to="/formularios" className="mb-4 flex items-center gap-2 text-[#68737a]"><ClipboardList size={16} /> Formulários</Link>
        <Link to="/configuracoes" className="flex items-center gap-2 text-[#68737a]"><Settings size={16} /> Configurações</Link>
      </nav>
    </aside>
  );
}

function NewConversationModal({ clients, onClose, onCreated }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      window.alert('Informe um número de WhatsApp válido, com DDD.');
      return;
    }
    setSaving(true);
    try {
      const conversation = await createConversation({ phoneNumber: digits, contactName: contactName || null, clientId: clientId || null });
      onCreated(conversation);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="h-full w-[420px] bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova conversa</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Número do WhatsApp</span>
          <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="55 11 99999-9999" className="h-10 w-full rounded border border-[#dfe5e8] px-3" autoFocus />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Nome do contato (opcional)</span>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-10 w-full rounded border border-[#dfe5e8] px-3" />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Vincular a um cliente (opcional)</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 w-full rounded border border-[#dfe5e8] bg-white px-3">
            <option value="">Nenhum</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={handleCreate} disabled={saving} className="rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50">Iniciar conversa</button>
        </div>
      </div>
    </div>
  );
}

export default function Relationship() {
  const [configured, setConfigured] = useState(true);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [showModal, setShowModal] = useState(false);
  const bottomRef = useRef(null);

  function loadConversations() {
    listConversations().then(setConversations).catch(() => {});
  }

  useEffect(() => {
    getStatus().then((status) => {
      setConfigured(status.configured);
      setWhatsappStatus(status);
    }).catch(() => {});
    api.get('/clients').then(({ data }) => setClients(data)).catch(() => {});
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    getConversationMessages(activeId).then(({ messages }) => setMessages(messages)).catch(() => {});
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filtered = conversations.filter((conv) => {
    const term = search.toLowerCase();
    return !term || (conv.contactName || '').toLowerCase().includes(term) || conv.phoneNumber.includes(term);
  });

  const active = conversations.find((conv) => conv.id === activeId);
  const missingLabels = {
    WHATSAPP_ACCESS_TOKEN: 'Token de acesso da Meta',
    WHATSAPP_PHONE_NUMBER_ID: 'ID do número do WhatsApp',
    WHATSAPP_VERIFY_TOKEN: 'Token de verificação do webhook',
  };

  async function copyWebhook() {
    if (!whatsappStatus?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(whatsappStatus.webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 1800);
    } catch {
      window.prompt('Copie a URL do webhook:', whatsappStatus.webhookUrl);
    }
  }

  function openWhatsAppWeb(phoneNumber, text = '') {
    const digits = phoneNumber.replace(/\D/g, '');
    const message = encodeURIComponent(text);
    const url = `https://web.whatsapp.com/send?phone=${digits}${message ? `&text=${message}` : ''}`;
    window.open(url, 'young-whatsapp-web', 'noopener,noreferrer,width=1120,height=760,left=120,top=60');
  }

  async function handleSend() {
    if (!draft.trim() || !activeId) return;
    const messageText = draft.trim();
    if (active) openWhatsAppWeb(active.phoneNumber, messageText);
    setDraft('');
  }

  return (
    <div className="nibo-ui min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <RelationshipMenu />
      <main className="ml-[282px] min-h-screen">
        <FirmHeader />
        <section className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Relacionamento</h1>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white">
              <Plus size={17} /> Nova conversa
            </button>
          </div>

          <div className={`mb-4 rounded border p-4 text-sm ${configured ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {configured ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" /> : <TriangleAlert size={19} className="mt-0.5 shrink-0" />}
                <div>
                  <b>{configured ? 'WhatsApp conectado.' : 'WhatsApp Web ativado para envio manual.'}</b>
                  <p className="mt-1 max-w-3xl">
                    {configured
                      ? 'A caixa de entrada está pronta para receber e enviar mensagens pelo WhatsApp Business.'
                      : 'Ao enviar uma mensagem, o sistema abre o WhatsApp Web com o texto pronto. O envio acontece direto pelo WhatsApp.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 ${whatsappStatus?.sendConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-amber-800'}`}>Envio {whatsappStatus?.sendConfigured ? 'automático' : 'via WhatsApp Web'}</span>
                <span className={`rounded-full px-3 py-1 ${whatsappStatus?.webhookConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-amber-800'}`}>Webhook {whatsappStatus?.webhookConfigured ? 'ativo' : 'pendente'}</span>
              </div>
            </div>

            {whatsappStatus?.webhookUrl && (
              <div className="mt-4 grid gap-3 rounded border border-white/70 bg-white/70 p-3 text-[#3f4548] md:grid-cols-[1fr_auto]">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-[#68737a]">URL do webhook para cadastrar na Meta</p>
                  <code className="block break-all rounded bg-white px-3 py-2 text-xs text-[#005ea8]">{whatsappStatus.webhookUrl}</code>
                </div>
                <button onClick={copyWebhook} className="inline-flex h-10 items-center justify-center gap-2 self-end rounded border border-[#b8d8ec] bg-white px-4 text-[#006da8] hover:bg-[#f1f9ff]">
                  <Copy size={15} /> {copiedWebhook ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}

            {!configured && whatsappStatus?.missing?.length > 0 && (
              <div className="mt-3 text-[#7a5a00]">
                <b>Para automatizar futuramente, ainda faltam:</b>
                <div className="mt-2 flex flex-wrap gap-2">
                  {whatsappStatus.missing.map((key) => (
                    <span key={key} className="rounded-full bg-white px-3 py-1 text-xs">{missingLabels[key] || key}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid h-[calc(100vh-220px)] grid-cols-[320px_1fr] overflow-hidden rounded border border-[#dfe5e8]">
            <div className="flex flex-col border-r border-[#dfe5e8]">
              <div className="border-b border-[#dfe5e8] p-3">
                <span className="flex h-10 items-center gap-2 rounded border border-[#dfe5e8] px-3">
                  <Search size={16} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa" className="w-full text-sm outline-none" />
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 && <p className="p-4 text-center text-sm text-[#9aa5ad]">Nenhuma conversa ainda.</p>}
                {filtered.map((conv) => {
                  const lastMessage = conv.messages?.[0];
                  return (
                    <button key={conv.id} onClick={() => setActiveId(conv.id)} className={`block w-full border-b border-[#f0f3f5] px-4 py-3 text-left ${activeId === conv.id ? 'bg-[#eaf6ff]' : 'hover:bg-[#fafbfc]'}`}>
                      <div className="flex items-center justify-between">
                        <b className="text-sm">{conv.contactName || conv.phoneNumber}</b>
                        <span className="text-xs text-[#9aa5ad]">{new Date(conv.lastMessageAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="truncate text-xs text-[#68737a]">{lastMessage?.body || 'Sem mensagens'}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col">
              {!active && <div className="flex flex-1 items-center justify-center text-sm text-[#9aa5ad]">Selecione uma conversa para começar.</div>}
              {active && (
                <>
                  <div className="border-b border-[#dfe5e8] px-5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <b>{active.contactName || active.phoneNumber}</b>
                        <p className="text-xs text-[#68737a]">{active.phoneNumber}{active.client ? ` · ${active.client.name}` : ''}</p>
                      </div>
                      <button onClick={() => openWhatsAppWeb(active.phoneNumber)} className="inline-flex items-center gap-2 rounded border border-[#b8d8ec] px-3 py-2 text-sm text-[#006da8] hover:bg-[#f1f9ff]">
                        <ExternalLink size={15} /> Abrir WhatsApp Web
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f9fa] p-5">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.direction === 'SAIDA' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${message.direction === 'SAIDA' ? 'bg-[#dcf8c6]' : 'bg-white'} shadow-sm`}>
                          <p>{message.body}</p>
                          <p className="mt-1 text-right text-[10px] text-[#9aa5ad]">
                            {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {message.direction === 'SAIDA' && message.status === 'NAO_CONFIGURADO' && ' · enviado manualmente pelo WhatsApp Web'}
                            {message.direction === 'SAIDA' && message.status === 'FALHA' && ' · falha no envio'}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                  <div className="flex items-center gap-3 border-t border-[#dfe5e8] p-3">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Digite uma mensagem"
                      className="h-10 flex-1 rounded border border-[#dfe5e8] px-3 text-sm"
                    />
                    <button onClick={handleSend} disabled={!draft.trim()} className="inline-flex h-10 items-center gap-2 rounded bg-[#2693d2] px-4 text-sm text-white disabled:opacity-50">
                      <Send size={16} /> Enviar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      {showModal && (
        <NewConversationModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onCreated={(conversation) => {
            setShowModal(false);
            loadConversations();
            setActiveId(conversation.id);
          }}
        />
      )}
    </div>
  );
}
