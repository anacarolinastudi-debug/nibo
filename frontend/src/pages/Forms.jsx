import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, ListChecks, MessageCircle, MoreVertical, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { listForms, createForm, toggleFormStatus, removeForm } from '../api/forms';
import NiboRail from '../components/NiboRail';
import SideMenuSection from '../components/SideMenuSection';

const departments = ['Departamento Contábil', 'Departamento de Registro', 'Departamento Financeiro', 'Departamento Fiscal', 'Departamento Pessoal'];

function FormsMenu() {
  const [openSection, setOpenSection] = useState('formularios');
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
        <Link to="/relacionamento" className="mb-4 mt-1 flex items-center gap-2 text-[#68737a]"><MessageCircle size={16} /> Relacionamento</Link>
        <p className="mb-4 border-t pt-4 text-xs font-semibold text-[#7b858c]">CADASTROS</p>
        <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === 'clientes'} onToggle={() => toggleSection('clientes')}>
          {['Meus clientes', 'Contatos'].map((item) => (
            <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <p className="flex items-center gap-2 font-semibold"><ClipboardList size={16} /> Formulários</p>
      </nav>
    </aside>
  );
}

function NewFormModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const form = await createForm({ name, description: description || null, department: department || null });
      onCreated(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="h-full w-[460px] bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo formulário</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <label className="mb-5 block text-sm">
          <span className="mb-1 block font-medium">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded border border-[#dfe5e8] px-3" autoFocus />
        </label>
        <label className="mb-5 block text-sm">
          <span className="mb-1 block font-medium">Descrição (opcional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full resize-y rounded border border-[#dfe5e8] px-3 py-2" />
        </label>
        <label className="mb-5 block text-sm">
          <span className="mb-1 block font-medium">Departamento (opcional)</span>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 w-full rounded border border-[#dfe5e8] px-3 bg-white">
            <option value="">Selecione</option>
            {departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
          </select>
        </label>
        <div className="absolute bottom-6 right-6 flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={handleNext} disabled={saving || !name.trim()} className="rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50">Próximo</button>
        </div>
      </div>
    </div>
  );
}

export default function Forms() {
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState('ATIVO');
  const [forms, setForms] = useState([]);
  const [counts, setCounts] = useState({ ATIVO: 0, INATIVO: 0 });
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [filters, setFilters] = useState({ search: '', department: '' });
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [activeList, inactiveList] = await Promise.all([
        listForms({ status: 'ATIVO' }),
        listForms({ status: 'INATIVO' }),
      ]);
      setCounts({ ATIVO: activeList.length, INATIVO: inactiveList.length });
      const base = statusTab === 'ATIVO' ? activeList : inactiveList;
      const filtered = base.filter((form) => {
        const matchesSearch = !filters.search || form.name.toLowerCase().includes(filters.search.toLowerCase()) || (form.description || '').toLowerCase().includes(filters.search.toLowerCase());
        const matchesDept = !filters.department || form.department === filters.department;
        return matchesSearch && matchesDept;
      });
      setForms(filtered);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusTab, filters]);

  function applyFilters() {
    setFilters({ search, department });
  }

  function clearFilters() {
    setSearch('');
    setDepartment('');
    setFilters({ search: '', department: '' });
  }

  async function handleToggleStatus(form) {
    await toggleFormStatus(form.id);
    load();
  }

  async function handleRemove(form) {
    if (!window.confirm(`Excluir o formulário "${form.name}"?`)) return;
    await removeForm(form.id);
    load();
  }

  return (
    <div className="nibo-ui min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <FormsMenu />
      <main className="ml-[282px] min-h-screen">
        <header className="flex h-[58px] items-center justify-between border-b border-[#dfe5e8] px-5">
          <div className="text-base text-[#60666b]">52.107.544 ANA CAROLINA CARPINE AGUIAR</div>
        </header>
        <section className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Formulários</h1>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white">
              <Plus size={17} /> Novo formulário
            </button>
          </div>
          <div className="flex gap-8">
            <aside className="w-[200px]">
              <p className="mb-3 text-xs font-semibold uppercase text-[#7b858c]">Filtrar</p>
              <nav className="space-y-1 text-sm">
                {[{ key: 'ATIVO', label: 'Ativos' }, { key: 'INATIVO', label: 'Inativos' }].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setStatusTab(item.key)}
                    className={`flex w-full items-center justify-between rounded px-3 py-2 ${statusTab === item.key ? 'bg-[#dce5ef] text-[#2f3a42]' : 'text-[#68737a] hover:bg-[#eef2f6]'}`}
                  >
                    <span>{item.label}</span>
                    <span>{counts[item.key]}</span>
                  </button>
                ))}
              </nav>
            </aside>
            <div className="flex-1">
              <h2 className="mb-4 text-lg font-semibold">{statusTab === 'ATIVO' ? 'Ativos' : 'Inativos'}</h2>
              <div className="mb-6 flex items-end gap-4">
                <label className="block min-w-[320px] text-sm">
                  <span className="mb-1 block">Buscar por</span>
                  <span className="flex h-10 items-center gap-2 rounded border border-[#dfe5e8] px-3">
                    <Search size={16} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou descrição" className="w-full outline-none" />
                  </span>
                </label>
                <label className="block min-w-[220px] text-sm">
                  <span className="mb-1 block">Departamento</span>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 w-full rounded border border-[#dfe5e8] bg-white px-3">
                    <option value="">Todos</option>
                    {departments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
                  </select>
                </label>
                <button onClick={applyFilters} className="h-10 rounded border border-[#2693d2] px-5 text-[#2693d2]">Filtrar</button>
                <button onClick={clearFilters} className="h-10 text-[#16829b]">Limpar filtros</button>
              </div>

              {!loading && forms.length === 0 && <p className="py-10 text-center text-[#78838a]">Nenhum formulário encontrado.</p>}

              {forms.length > 0 && (
                <div className="overflow-x-auto rounded border border-[#dfe5e8]">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-[#f3f3f3]">
                      <tr>
                        <th className="px-5 py-3">Nome</th>
                        <th className="px-5 py-3">Descrição</th>
                        <th className="px-5 py-3">Departamento</th>
                        <th className="w-16 px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {forms.map((form) => (
                        <tr key={form.id} className="border-t border-[#dfe5e8]">
                          <td className="px-5 py-4">
                            <button onClick={() => navigate(`/formularios/${form.id}`)} className="font-semibold text-[#16829b]">{form.name}</button>
                          </td>
                          <td className="px-5 py-4 text-[#5c656b]">{form.description || '-'}</td>
                          <td className="px-5 py-4">{form.department || '-'}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-3 text-[#16829b]">
                              <button title="Editar" onClick={() => navigate(`/formularios/${form.id}`)}><Pencil size={16} /></button>
                              <button title={form.status === 'ATIVO' ? 'Inativar' : 'Ativar'} onClick={() => handleToggleStatus(form)}><MoreVertical size={17} /></button>
                              <button title="Excluir" onClick={() => handleRemove(form)}><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      {showModal && (
        <NewFormModal
          onClose={() => setShowModal(false)}
          onCreated={(form) => navigate(`/formularios/${form.id}`)}
        />
      )}
    </div>
  );
}
