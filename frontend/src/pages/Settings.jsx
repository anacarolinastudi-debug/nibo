import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, ClipboardList, ListChecks, MessageCircle, Pencil, Plus, Search,
  Settings as SettingsIcon, ShieldCheck, Trash2, Upload, Users, X,
} from 'lucide-react';
import { getFirm, updateFirm, uploadLogo, uploadCertificate, removeCertificate } from '../api/firm';
import {
  listDepartments, createDepartment, updateDepartment, removeDepartment,
  getClientMatrix, upsertClientMatrix, listFirmRoles, createFirmRole, removeFirmRole,
} from '../api/departments';
import api from '../api/client';
import NiboRail from '../components/NiboRail';
import SideMenuSection from '../components/SideMenuSection';

const TABS = ['Atalhos', 'Escritório', 'Equipe', 'Departamentos', 'Responsabilidades'];

function SettingsMenu({ tab, setTab }) {
  const [openSection, setOpenSection] = useState('configuracoes');
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
        <Link to="/radar-ecac" className="mb-4 flex items-center gap-2 text-[#68737a]">Radar e-CAC <b className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] text-white">NOVO</b></Link>
        <p className="mb-4 border-t pt-4 text-xs font-semibold text-[#7b858c]">CADASTROS</p>
        <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === 'clientes'} onToggle={() => toggleSection('clientes')}>
          {['Meus clientes', 'Contatos'].map((item) => (
            <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <Link to="/formularios" className="mb-4 flex items-center gap-2 text-[#68737a]"><ClipboardList size={16} /> Formulários</Link>
        <SideMenuSection icon={SettingsIcon} label="Configurações" to="/configuracoes" active open={openSection === 'configuracoes'} onToggle={() => toggleSection('configuracoes')}>
          {['Escritório', 'Equipe', 'Departamentos', 'Responsabilidades'].map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`block w-full rounded px-3 py-2 text-left ${tab === item ? 'bg-[#dce5ef] text-[#2f3a42]' : 'text-[#68737a] hover:bg-white'}`}>{item}</button>
          ))}
        </SideMenuSection>
      </nav>
    </aside>
  );
}

function FieldLabel({ children }) {
  return <span className="mb-1 block text-sm font-medium text-[#3f4548]">{children}</span>;
}

function TextInput({ label, value, onChange, disabled }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input value={value || ''} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} className="h-10 w-full rounded border border-[#dfe5e8] px-3 disabled:bg-[#f7f9fa] disabled:text-[#9aa5ad]" />
    </label>
  );
}

function EscritorioTab() {
  const [firm, setFirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [uploadingCert, setUploadingCert] = useState(false);
  const certFileRef = useRef(null);
  const logoFileRef = useRef(null);
  const [pendingCertFile, setPendingCertFile] = useState(null);

  function load() {
    getFirm().then(setFirm);
  }

  useEffect(() => { load(); }, []);

  if (!firm) return <p className="p-5 text-[#78838a]">Carregando…</p>;

  function set(key, value) {
    setFirm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateFirm({
        name: firm.name,
        email: firm.email,
        phone: firm.phone,
        crc: firm.crc,
        cep: firm.cep,
        street: firm.street,
        number: firm.number,
        complement: firm.complement,
        neighborhood: firm.neighborhood,
        city: firm.city,
        state: firm.state,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const updated = await uploadLogo(file);
    setFirm(updated);
  }

  async function handleCertificateSubmit() {
    if (!pendingCertFile || !passphrase) {
      window.alert('Selecione o arquivo .pfx e informe a senha do certificado.');
      return;
    }
    setUploadingCert(true);
    try {
      const updated = await uploadCertificate(pendingCertFile, passphrase);
      setFirm(updated);
      setPendingCertFile(null);
      setPassphrase('');
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível processar o certificado.');
    } finally {
      setUploadingCert(false);
    }
  }

  async function handleRemoveCertificate() {
    if (!window.confirm('Remover o certificado digital? O Radar e-CAC para de funcionar até você enviar um novo.')) return;
    const updated = await removeCertificate();
    setFirm(updated);
  }

  return (
    <div className="space-y-10 p-6 pb-28">
      <section className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <h2 className="font-semibold">Dados do escritório</h2>
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-4">
          <TextInput label="CNPJ" value={firm.cnpj} disabled />
          <TextInput label="Nome do escritório" value={firm.name} onChange={(v) => set('name', v)} />
          <TextInput label="CRC" value={firm.crc} onChange={(v) => set('crc', v)} />
          <div className="col-span-3 max-w-sm">
            <TextInput label="E-mail do escritório" value={firm.email} onChange={(v) => set('email', v)} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-6 border-t border-[#eef0f2] pt-8">
        <div className="col-span-1">
          <h2 className="font-semibold">Logotipo</h2>
        </div>
        <div className="col-span-2">
          <div className="mb-2 grid h-16 w-16 place-items-center overflow-hidden rounded border border-[#dfe5e8] bg-[#fafbfc]">
            {firm.logoUrl ? <img src={firm.logoUrl} alt="Logotipo" className="h-full w-full object-cover" /> : <Upload size={20} className="text-[#9aa5ad]" />}
          </div>
          <input ref={logoFileRef} type="file" accept=".jpg,.jpeg,.png,.bmp" className="hidden" onChange={handleLogoChange} />
          <button onClick={() => logoFileRef.current?.click()} className="text-sm text-[#16829b]">Selecionar arquivo</button>
          <p className="mt-1 text-xs text-[#9aa5ad]">(.jpg, .jpeg, .png ou .bmp)</p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-6 border-t border-[#eef0f2] pt-8">
        <div className="col-span-1">
          <h2 className="font-semibold">Endereço</h2>
        </div>
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <TextInput label="CEP" value={firm.cep} onChange={(v) => set('cep', v)} />
            <div className="col-span-2"><TextInput label="Endereço" value={firm.street} onChange={(v) => set('street', v)} /></div>
            <TextInput label="N°" value={firm.number} onChange={(v) => set('number', v)} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <TextInput label="Complemento" value={firm.complement} onChange={(v) => set('complement', v)} />
            <TextInput label="Bairro" value={firm.neighborhood} onChange={(v) => set('neighborhood', v)} />
            <TextInput label="Cidade" value={firm.city} onChange={(v) => set('city', v)} />
            <TextInput label="UF" value={firm.state} onChange={(v) => set('state', v)} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-6 border-t border-[#eef0f2] pt-8">
        <div className="col-span-1">
          <h2 className="font-semibold">Certificado digital</h2>
          <p className="mt-1 text-sm text-[#78838a]">Usado pelo Radar e-CAC para consultar pendências fiscais via procuração eletrônica.</p>
        </div>
        <div className="col-span-2">
          {firm.certificate ? (
            <div className="flex items-start justify-between rounded border border-[#dfe5e8] bg-[#fafbfc] p-4">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <ShieldCheck size={16} className={firm.certificate.expired ? 'text-red-500' : 'text-emerald-500'} />
                  Certificado digital
                </p>
                <p className="text-sm text-[#68737a]">
                  Validade {new Date(firm.certificate.validUntil).toLocaleDateString('pt-BR')}
                  {firm.certificate.expired && <span className="ml-2 text-red-500">(expirado)</span>}
                </p>
                <p className="mt-2 text-sm">{firm.certificate.subject}</p>
              </div>
              <button onClick={handleRemoveCertificate} title="Remover certificado" className="text-[#9aa5ad] hover:text-red-500"><Trash2 size={18} /></button>
            </div>
          ) : (
            <div className="rounded border border-dashed border-[#d5dde3] bg-[#fafbfc] p-4">
              <input ref={certFileRef} type="file" accept=".pfx,.p12" className="hidden" onChange={(e) => setPendingCertFile(e.target.files?.[0] || null)} />
              <button onClick={() => certFileRef.current?.click()} className="mb-3 flex items-center gap-2 rounded border border-[#dfe5e8] bg-white px-4 py-2 text-sm text-[#16829b]">
                <Upload size={16} /> {pendingCertFile ? pendingCertFile.name : 'Selecionar certificado (.pfx)'}
              </button>
              <div className="flex items-end gap-3">
                <div className="max-w-xs flex-1">
                  <TextInput label="Senha do certificado" value={passphrase} onChange={setPassphrase} />
                </div>
                <button onClick={handleCertificateSubmit} disabled={uploadingCert} className="h-10 rounded bg-[#2693d2] px-5 text-white disabled:opacity-50">
                  {uploadingCert ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
              <p className="mt-3 text-xs text-[#9aa5ad]">O arquivo e a senha ficam criptografados no servidor — nunca em texto puro.</p>
            </div>
          )}
        </div>
      </section>

      <div className="fixed bottom-0 left-[282px] right-0 flex justify-end gap-3 border-t border-[#dfe5e8] bg-white px-6 py-3">
        <button onClick={handleSave} disabled={saving} className="rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50">
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}

const roleLabels = { ADMIN: 'ADMIN', ACCOUNTANT: 'PERSONALIZADO', CLIENT: 'CLIENTE' };

function NewUserModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      window.alert('Preencha nome, e-mail e uma senha temporária com pelo menos 6 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', { name, email, password, role: role === 'ADMIN' ? 'ADMIN' : 'ACCOUNTANT' });
      onCreated();
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível criar o usuário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="w-[480px] rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo usuário</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mb-4"><TextInput label="E-mail" value={email} onChange={setEmail} /></div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <TextInput label="Nome" value={name} onChange={setName} />
          <TextInput label="Senha temporária" value={password} onChange={setPassword} />
        </div>
        <div className="mb-6">
          <FieldLabel>Perfil de acesso</FieldLabel>
          <div className="flex gap-6 pt-1 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={role === 'ADMIN'} onChange={() => setRole('ADMIN')} /> Administrador</label>
            <label className="flex items-center gap-2"><input type="radio" checked={role === 'ACCOUNTANT'} onChange={() => setRole('ACCOUNTANT')} /> Personalizado</label>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function EquipeTab() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  function load() {
    api.get('/users').then(({ data }) => setUsers(data));
  }

  useEffect(() => { load(); }, []);

  const filtered = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Equipe</h2>
        <div className="flex items-center gap-3">
          <span className="flex h-10 items-center gap-2 rounded border border-[#dfe5e8] px-3">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar em equipe..." className="w-56 text-sm outline-none" />
          </span>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white">
            <Plus size={17} /> Novo usuário
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded border border-[#dfe5e8]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-t border-[#dfe5e8]">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3 text-right">
                  <span className="rounded bg-[#f0f3f5] px-2 py-0.5 text-xs text-[#68737a]">{roleLabels[user.role] || user.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-8 text-center text-[#9aa5ad]">Nenhum usuário encontrado.</p>}
      </div>
      {showModal && <NewUserModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function SelectInput({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block">
      {label && <FieldLabel>{label}</FieldLabel>}
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded border border-[#dfe5e8] bg-white px-3 text-sm">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}

function DepartmentModal({ department, users, onClose, onSaved }) {
  const [name, setName] = useState(department?.name || '');
  const [responsibleId, setResponsibleId] = useState(department?.responsibleId || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      window.alert('Informe o nome do departamento.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), responsibleId: responsibleId || null };
      const saved = department ? await updateDepartment(department.id, payload) : await createDepartment(payload);
      onSaved(saved);
    } catch (error) {
      window.alert(error.response?.data?.error || 'Não foi possível salvar o departamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="w-[480px] rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{department ? 'Editar departamento' : 'Novo departamento'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mb-4"><TextInput label="Nome do departamento" value={name} onChange={setName} /></div>
        <div className="mb-6">
          <SelectInput
            label="Responsável pelo departamento"
            value={responsibleId}
            onChange={setResponsibleId}
            placeholder="Selecione"
            options={users.map((user) => ({ value: user.id, label: user.name }))}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function DepartamentosTab() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  function load() {
    listDepartments().then(setDepartments);
  }

  useEffect(() => {
    load();
    api.get('/users').then(({ data }) => setUsers(data));
  }, []);

  async function handleDelete(department) {
    if (!window.confirm(`Excluir o departamento "${department.name}"?`)) return;
    await removeDepartment(department.id);
    load();
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Departamentos</h2>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white">
          <Plus size={17} /> Novo departamento
        </button>
      </div>
      <div className="overflow-hidden rounded border border-[#dfe5e8]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} className="border-t border-[#dfe5e8]">
                <td className="px-4 py-3 font-medium">{dept.name}</td>
                <td className="px-4 py-3">{dept.responsible?.name || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3 text-[#16829b]">
                    <button title="Editar" onClick={() => { setEditing(dept); setShowModal(true); }}><Pencil size={16} /></button>
                    <button title="Excluir" onClick={() => handleDelete(dept)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {departments.length === 0 && <p className="py-8 text-center text-[#9aa5ad]">Nenhum departamento cadastrado.</p>}
      </div>
      {showModal && (
        <DepartmentModal
          department={editing}
          users={users}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function ClientResponsibilitiesView() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');

  function load() {
    setLoading(true);
    getClientMatrix().then(setRows).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.get('/users').then(({ data }) => setUsers(data));
  }, []);

  const clients = [...new Map(rows.map((row) => [row.client.id, row.client])).values()];
  const departmentOptions = [...new Map(rows.map((row) => [row.department.id, row.department])).values()];

  const filtered = rows.filter((row) =>
    (!filterClient || row.client.id === filterClient) &&
    (!filterDepartment || row.department.id === filterDepartment) &&
    (!filterResponsible || row.responsible?.id === filterResponsible)
  );

  async function handleResponsibleChange(row, responsibleId) {
    const updated = await upsertClientMatrix({ clientId: row.client.id, departmentId: row.department.id, responsibleId: responsibleId || null });
    setRows((current) => current.map((item) => (item.client.id === row.client.id && item.department.id === row.department.id ? { ...item, responsible: updated.responsible } : item)));
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-5 gap-4">
        <SelectInput label="Cliente" value={filterClient} onChange={setFilterClient} placeholder="Todos" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectInput label="Departamento" value={filterDepartment} onChange={setFilterDepartment} placeholder="Todos" options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))} />
        <SelectInput label="Responsável pelo cliente" value={filterResponsible} onChange={setFilterResponsible} placeholder="Todos" options={users.map((u) => ({ value: u.id, label: u.name }))} />
        <SelectInput label="Grupo de clientes" value="" onChange={() => {}} placeholder="Em breve" options={[]} />
        <SelectInput label="Status do cliente" value="ATIVO" onChange={() => {}} options={[{ value: 'ATIVO', label: 'Ativo' }]} />
      </div>
      <p className="mb-3 text-sm text-[#68737a]">{filtered.length} exibidos</p>
      <div className="overflow-hidden rounded border border-[#dfe5e8]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" disabled /></th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Responsável pelo cliente</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={`${row.client.id}-${row.department.id}`} className="border-t border-[#dfe5e8]">
                <td className="px-4 py-3"><input type="checkbox" disabled /></td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#16829b]">{row.client.code ? `${row.client.code} - ` : ''}{row.client.name}</p>
                  <p className="text-xs text-[#9aa5ad]">{row.client.cnpj}</p>
                </td>
                <td className="px-4 py-3">{row.department.name}</td>
                <td className="px-4 py-3">
                  <select
                    value={row.responsible?.id || ''}
                    onChange={(e) => handleResponsibleChange(row, e.target.value)}
                    className="h-9 rounded border border-[#dfe5e8] bg-white px-2 text-sm"
                  >
                    <option value="">Sem responsável</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <p className="py-8 text-center text-[#9aa5ad]">Nenhum registro encontrado.</p>}
      </div>
    </div>
  );
}

function DepartmentResponsibilitiesView() {
  const [departments, setDepartments] = useState([]);

  useEffect(() => { listDepartments().then(setDepartments); }, []);

  return (
    <div>
      <p className="mb-3 text-sm text-[#68737a]">{departments.length} exibidos</p>
      <div className="overflow-hidden rounded border border-[#dfe5e8]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" disabled /></th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Encarregado</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} className="border-t border-[#dfe5e8]">
                <td className="px-4 py-3"><input type="checkbox" disabled /></td>
                <td className="px-4 py-3">{dept.name}</td>
                <td className="px-4 py-3">{dept.responsible?.name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {departments.length === 0 && <p className="py-8 text-center text-[#9aa5ad]">Nenhum departamento cadastrado.</p>}
      </div>
    </div>
  );
}

function NewFirmRoleModal({ users, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [userId, setUserId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      window.alert('Informe o nome do cargo.');
      return;
    }
    setSaving(true);
    try {
      await createFirmRole({ title: title.trim(), userId: userId || null });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="w-[420px] rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo cargo</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mb-4"><TextInput label="Cargo" value={title} onChange={setTitle} /></div>
        <div className="mb-6">
          <SelectInput label="Nome" value={userId} onChange={setUserId} placeholder="Selecione" options={users.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function FirmRoleResponsibilitiesView() {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);

  function load() {
    listFirmRoles().then(setRoles);
  }

  useEffect(() => {
    load();
    api.get('/users').then(({ data }) => setUsers(data));
  }, []);

  async function handleDelete(role) {
    if (!window.confirm(`Excluir o cargo "${role.title}"?`)) return;
    await removeFirmRole(role.id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white">
          <Plus size={17} /> Novo cargo
        </button>
      </div>
      <div className="overflow-hidden rounded border border-[#dfe5e8]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f3f3]">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" disabled /></th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-t border-[#dfe5e8]">
                <td className="px-4 py-3"><input type="checkbox" disabled /></td>
                <td className="px-4 py-3">{role.title}</td>
                <td className="px-4 py-3">{role.user?.name || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button title="Excluir" onClick={() => handleDelete(role)} className="text-[#16829b]"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roles.length === 0 && <p className="py-8 text-center text-[#9aa5ad]">Nenhum cargo cadastrado.</p>}
      </div>
      {showModal && <NewFirmRoleModal users={users} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function ResponsabilidadesTab() {
  const [section, setSection] = useState('Dos clientes');

  return (
    <div className="p-6">
      <h2 className="mb-4 text-2xl font-semibold">Responsabilidades</h2>
      <div className="mb-5 flex gap-8 border-b border-[#eef0f2] text-sm">
        {['Dos clientes', 'Dos departamentos', 'Do escritório'].map((item) => (
          <button key={item} onClick={() => setSection(item)} className={`pb-3 ${section === item ? 'border-b-2 border-[#003f82] font-semibold text-[#202427]' : 'text-[#666]'}`}>
            {item}
          </button>
        ))}
      </div>
      {section === 'Dos clientes' && <ClientResponsibilitiesView />}
      {section === 'Dos departamentos' && <DepartmentResponsibilitiesView />}
      {section === 'Do escritório' && <FirmRoleResponsibilitiesView />}
    </div>
  );
}

function PlaceholderTab({ name }) {
  return (
    <div className="p-10 text-center text-[#9aa5ad]">
      <p className="font-medium">{name}</p>
      <p className="mt-1 text-sm">Em breve.</p>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('Escritório');

  return (
    <div className="nibo-ui min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <SettingsMenu tab={tab} setTab={setTab} />
      <main className="ml-[282px] min-h-screen">
        <header className="flex h-[58px] items-center justify-between border-b border-[#dfe5e8] px-5">
          <div className="text-base text-[#60666b]">52.107.544 ANA CAROLINA CARPINE AGUIAR</div>
        </header>
        <div className="flex h-[45px] items-end gap-10 border-b border-[#dfe5e8] px-5 text-sm">
          <span className="pb-3 font-semibold">Configurações</span>
          {TABS.map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`h-full border-b-2 px-1 ${tab === item ? 'border-[#003f82] font-semibold text-[#202427]' : 'border-transparent text-[#666]'}`}>
              {item}
            </button>
          ))}
        </div>
        {tab === 'Escritório' && <EscritorioTab />}
        {tab === 'Equipe' && <EquipeTab />}
        {tab === 'Departamentos' && <DepartamentosTab />}
        {tab === 'Responsabilidades' && <ResponsabilidadesTab />}
        {!['Escritório', 'Equipe', 'Departamentos', 'Responsabilidades'].includes(tab) && <PlaceholderTab name={tab} />}
      </main>
    </div>
  );
}
