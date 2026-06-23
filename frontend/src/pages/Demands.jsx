import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  FileText,
  ListChecks,
  Maximize2,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Workflow,
  X,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import NiboRail from "../components/NiboRail";
import SideMenuSection from "../components/SideMenuSection";

const departments = [
  "Departamento Contábil",
  "Departamento de Registro",
  "Departamento Financeiro",
  "Departamento Fiscal",
  "Departamento Pessoal",
];
const statusLabels = {
  PENDING: "A fazer",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando cliente",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};
const defaultSettings = {
  overdueNotification: false,
  approvalRequired: false,
  checklistRequired: false,
};
const builtInProcessTemplates = [
  {
    id: "opening-company",
    name: "REGISTRO - Abertura de empresa",
    department: "Departamento de Registro",
    durationDays: 21,
    instructions:
      "Tarefas para executar a abertura de uma empresa, divididas em suas respectivas etapas.",
    stages: [
      {
        id: "s1",
        name: "Solicitação de informações e documentos",
        tasks: [
          {
            id: "p1",
            title: "Solicitar informações e documentos",
            dueOffset: 0,
            done: false,
          },
        ],
      },
      {
        id: "s2",
        name: "Montagem do processo",
        tasks: [
          {
            id: "p2",
            title: "Enviar a viabilidade para a Junta Comercial",
            dueOffset: 2,
            done: false,
          },
          {
            id: "p3",
            title: "Baixar arquivos deferidos (Contrato Social e CNPJ)",
            dueOffset: 6,
            done: false,
          },
        ],
      },
      {
        id: "s3",
        name: "Coleta de assinaturas",
        tasks: [
          {
            id: "p4",
            title: "Coletar assinaturas dos documentos",
            dueOffset: 7,
            done: false,
          },
        ],
      },
      {
        id: "s4",
        name: "Protocolo na Junta Comercial",
        tasks: [
          {
            id: "p5",
            title: "Protocolar na Junta Comercial",
            dueOffset: 8,
            done: false,
          },
        ],
      },
      {
        id: "s5",
        name: "Licenças Municipais e Estaduais",
        tasks: [
          {
            id: "p6",
            title: "Baixar Inscrição Estadual",
            dueOffset: 10,
            done: false,
          },
          {
            id: "p7",
            title: "Solicitar Inscrição Municipal",
            dueOffset: 10,
            done: false,
          },
        ],
      },
      {
        id: "s6",
        name: "Simples Nacional",
        tasks: [
          {
            id: "p8",
            title: "Solicitar opção pelo Simples Nacional",
            dueOffset: 17,
            done: false,
          },
          {
            id: "p9",
            title: "Verificar resultado da solicitação",
            dueOffset: 20,
            done: false,
          },
        ],
      },
      {
        id: "s7",
        name: "Registro nos órgãos fiscalizadores",
        tasks: [
          {
            id: "p10",
            title: "Registrar empresa nos órgãos fiscalizadores",
            dueOffset: 21,
            done: false,
          },
        ],
      },
      {
        id: "s8",
        name: "Envio do contrato de prestação de serviços",
        tasks: [
          {
            id: "p11",
            title: "Enviar contrato contábil de prestação de serviços",
            dueOffset: 10,
            done: false,
          },
        ],
      },
    ],
  },
];

function Shell({ tab, setTab, children }) {
  const [openSection, setOpenSection] = useState("tarefas");
  const toggleSection = (key) =>
    setOpenSection((current) => (current === key ? null : key));

  return (
    <div className="min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <aside className="fixed inset-y-0 left-[46px] z-20 flex w-[236px] flex-col border-r bg-[#f4f7fb]">
        <div className="flex h-[58px] shrink-0 items-center border-b px-5 text-xl">
          Contador
        </div>
        <nav className="flex-1 overflow-y-auto px-5 py-5 text-sm">
          <p className="mb-4 text-xs font-semibold">OPERAÇÃO</p>
          <Link to="/" className="mb-4 flex gap-2 text-[#68737a]">
            <ClipboardCheck size={16} /> Obrigações
          </Link>
          <SideMenuSection icon={ListChecks} label="Tarefas & Processos" to="/demandas" active open={openSection === "tarefas"} onToggle={() => toggleSection("tarefas")}>
            {["Tarefas", "Processos", "Configurações"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`block w-full rounded px-3 py-2 text-left ${tab === item ? "bg-[#dce5ef]" : "text-[#68737a]"}`}
              >
                {item}
              </button>
            ))}
          </SideMenuSection>
          <Link to="/relacionamento" className="mb-4 mt-1 flex items-center gap-2 text-[#68737a]"><MessageCircle size={16} /> Relacionamento</Link>
          <p className="mb-4 border-t pt-4 text-xs font-semibold">CADASTROS</p>
          <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === "clientes"} onToggle={() => toggleSection("clientes")}>
            {["Meus clientes", "Contatos"].map((item) => (
              <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
            ))}
          </SideMenuSection>
          <Link to="/formularios" className="flex gap-2 text-[#68737a]">
            <FileText size={16} /> Formulários
          </Link>
        </nav>
      </aside>
      <main className="ml-[282px]">
        <header className="flex h-[58px] items-center border-b px-6 text-[#60666b]">
          52.107.544 ANA CAROLINA CARPINE AGUIAR
        </header>
        <div className="flex h-[45px] items-end gap-14 border-b px-6 text-sm">
          <b className="pb-3">Tarefas &amp; Processos</b>
          {["Tarefas", "Processos", "Configurações"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`h-full border-b-2 px-1 ${tab === item ? "border-[#003f82] font-semibold" : "border-transparent"}`}
            >
              {item}
            </button>
          ))}
        </div>
        {children}
      </main>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex gap-3 rounded bg-[#f4f4f4] p-4">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-1 h-5 w-9 rounded-full ${checked ? "bg-[#2693d2]" : "bg-[#c8cdd0]"}`}
      >
        <i
          className={`block h-4 w-4 rounded-full bg-white transition-all ${checked ? "ml-[18px]" : "ml-0.5"}`}
        />
      </button>
      <span>
        <b className="block text-sm">{label}</b>
        <small>{description}</small>
      </span>
    </label>
  );
}

function TaskDrawer({
  task,
  template,
  clients,
  user,
  onClose,
  onSaved,
  saveAsTemplate = false,
}) {
  const fileRef = useRef(null);
  const initial = task || template || {};
  const [form, setForm] = useState({
    title: initial.title || initial.name || "",
    description: initial.description || "",
    category: "OUTROS",
    priority: "MEDIUM",
    clientId: initial.clientId || clients[0]?.id || "",
    department: initial.department || "",
    dueDate: initial.dueDate ? initial.dueDate.slice(0, 10) : "",
    checklist: initial.checklist || [],
    forms: initial.forms || [],
    settings: initial.settings || defaultSettings,
  });
  const [panel, setPanel] = useState("Checklist");
  const [newItem, setNewItem] = useState("");
  const [newForm, setNewForm] = useState("");
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function save(e) {
    e.preventDefault();
    try {
      if (saveAsTemplate) {
        const payload = {
          name: form.title,
          description: form.description,
          department: form.department || null,
          checklist: form.checklist,
          forms: form.forms,
          settings: form.settings,
        };
        initial.id
          ? await api.put(`/demands/templates/${initial.id}`, payload)
          : await api.post("/demands/templates", payload);
      } else {
        const payload = {
          ...form,
          dueDate: form.dueDate
            ? new Date(`${form.dueDate}T12:00:00`).toISOString()
            : null,
        };
        task
          ? await api.put(`/demands/${task.id}`, payload)
          : await api.post("/demands", payload);
      }
      onSaved();
    } catch (error) {
      window.alert(error.response?.data?.error || "Não foi possível salvar.");
    }
  }
  const addChecklist = () => {
    if (!newItem.trim()) return;
    set("checklist", [
      ...form.checklist,
      { id: `${Date.now()}`, text: newItem.trim(), done: false },
    ]);
    setNewItem("");
  };
  const addForm = () => {
    if (!newForm.trim()) return;
    set("forms", [
      ...form.forms,
      { id: `${Date.now()}`, name: newForm.trim() },
    ]);
    setNewForm("");
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <form
        onSubmit={save}
        className="absolute inset-y-0 right-0 flex w-[min(740px,94vw)] flex-col bg-white"
      >
        <header className="flex h-16 items-center justify-between border-b px-5">
          <h2 className="text-2xl font-semibold">
            {saveAsTemplate
              ? "Novo modelo de tarefa"
              : task
                ? "Editar tarefa"
                : "Nova tarefa"}
          </h2>
          <div className="flex gap-5 text-sm">
            <button type="button" onClick={() => fileRef.current?.click()}>
              Arquivos
            </button>
            <input ref={fileRef} type="file" className="hidden" />
            <button type="button">Anotações</button>
            <button type="button" onClick={onClose}>
              <X />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-5">
            <label className="block text-sm">
              Tarefa
              <input
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="mt-1 h-10 w-full rounded border px-3"
              />
            </label>
            <label className="block text-sm">
              Descrição
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="mt-1 w-full rounded border p-3"
              />
            </label>
            <div className="grid grid-cols-3 gap-4">
              <label className="text-sm">
                Departamento
                <select
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                  className="mt-1 h-10 w-full rounded border bg-white px-2"
                >
                  <option value="">Todos</option>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              {!saveAsTemplate && (
                <>
                  <label className="text-sm">
                    Cliente
                    <select
                      value={form.clientId}
                      onChange={(e) => set("clientId", e.target.value)}
                      className="mt-1 h-10 w-full rounded border bg-white px-2"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Prazo de conclusão
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => set("dueDate", e.target.value)}
                      className="mt-1 h-10 w-full rounded border px-2"
                    />
                  </label>
                </>
              )}
            </div>
            {!saveAsTemplate && (
              <p className="text-sm">
                Responsável: <b>{user?.name}</b>
              </p>
            )}
          </div>
          <div className="mt-3 min-h-[330px] bg-[#f3f3f3] p-5">
            <div className="mb-5 flex gap-2">
              {["Checklist", "Formulários", "Configurações"].map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setPanel(item)}
                  className={`rounded px-4 py-2 ${panel === item ? "bg-white font-semibold" : "text-[#16829b]"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            {panel === "Checklist" && (
              <div className="rounded bg-white p-5">
                <div className="mb-4 flex gap-2">
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Novo item do checklist"
                    className="h-10 flex-1 rounded border px-3"
                  />
                  <button
                    type="button"
                    onClick={addChecklist}
                    className="rounded bg-[#2693d2] px-4 text-white"
                  >
                    Adicionar
                  </button>
                </div>
                {form.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 border-t py-3"
                  >
                    <input
                      type="checkbox"
                      checked={item.done || false}
                      onChange={() =>
                        set(
                          "checklist",
                          form.checklist.map((i) =>
                            i.id === item.id ? { ...i, done: !i.done } : i,
                          ),
                        )
                      }
                    />
                    <span className="flex-1">{item.text}</span>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "checklist",
                          form.checklist.filter((i) => i.id !== item.id),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {panel === "Formulários" && (
              <div className="rounded bg-white p-5">
                <div className="mb-4 flex gap-2">
                  <input
                    value={newForm}
                    onChange={(e) => setNewForm(e.target.value)}
                    placeholder="Nome do formulário"
                    className="h-10 flex-1 rounded border px-3"
                  />
                  <button
                    type="button"
                    onClick={addForm}
                    className="rounded bg-[#2693d2] px-4 text-white"
                  >
                    Adicionar
                  </button>
                </div>
                {form.forms.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between border-t py-3"
                  >
                    <span>{item.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "forms",
                          form.forms.filter((i) => i.id !== item.id),
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {panel === "Configurações" && (
              <div className="space-y-3">
                <Toggle
                  label="Notificação de atraso"
                  description="Notifica o responsável quando o prazo é excedido."
                  checked={form.settings.overdueNotification}
                  onChange={(v) =>
                    set("settings", {
                      ...form.settings,
                      overdueNotification: v,
                    })
                  }
                />
                <Toggle
                  label="Aprovação obrigatória"
                  description="Exige aprovação para finalizar a tarefa."
                  checked={form.settings.approvalRequired}
                  onChange={(v) =>
                    set("settings", { ...form.settings, approvalRequired: v })
                  }
                />
                <Toggle
                  label="Checklist obrigatório"
                  description="Exige todos os itens concluídos para finalizar."
                  checked={form.settings.checklistRequired}
                  onChange={(v) =>
                    set("settings", { ...form.settings, checklistRequired: v })
                  }
                />
              </div>
            )}
          </div>
        </div>
        <footer className="flex justify-end gap-3 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[#16829b]"
          >
            Cancelar
          </button>
          <button className="rounded bg-[#2693d2] px-6 py-2 text-white">
            Salvar
          </button>
        </footer>
      </form>
    </div>
  );
}

function ChoiceModal({ templates, onClose, onChoose }) {
  const [mode, setMode] = useState("blank");
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-[620px] rounded bg-white shadow-xl">
        <header className="flex justify-between p-5">
          <h2 className="text-2xl font-semibold">Nova tarefa</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="px-5 pb-5">
          <p className="mb-4">Informe como deseja criar a tarefa</p>
          <div className="flex gap-5">
            <button
              onClick={() => setMode("blank")}
              className={`h-28 w-36 rounded border text-left p-4 ${mode === "blank" ? "bg-blue-50 border-blue-300" : ""}`}
            >
              <Sparkles className="mb-4 text-blue-600" />
              Em branco
            </button>
            <button
              onClick={() => setMode("template")}
              className={`h-28 w-36 rounded border text-left p-4 ${mode === "template" ? "bg-blue-50 border-blue-300" : ""}`}
            >
              <Archive className="mb-4 text-blue-600" />
              Modelo criado
            </button>
          </div>
          {mode === "template" && (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-4 h-10 w-72 rounded border px-3"
            >
              <option value="">Selecione...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t p-4">
          <button onClick={onClose} className="px-5">
            Cancelar
          </button>
          <button
            onClick={() =>
              onChoose(
                mode === "template"
                  ? templates.find((t) => t.id === templateId)
                  : null,
              )
            }
            className="rounded bg-[#2693d2] px-5 py-2 text-white"
          >
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function Demands() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Tarefas");
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [processTemplates, setProcessTemplates] = useState(
    builtInProcessTemplates,
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [choice, setChoice] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [processDetail, setProcessDetail] = useState(null);
  const [configSection, setConfigSection] = useState("Modelos de tarefas");
  const [users, setUsers] = useState([]);
  async function load() {
    const [a, b, c, d, e, f] = await Promise.all([
      api.get("/demands"),
      api.get("/clients"),
      api.get("/demands/templates/list"),
      api.get("/demands/processes/list"),
      api.get("/demands/process-templates/list"),
      api.get("/users"),
    ]);
    setTasks(a.data);
    setClients(b.data.filter((x) => x.active));
    setTemplates(c.data);
    setProcesses(d.data);
    setProcessTemplates(e.data.length ? e.data : builtInProcessTemplates);
    setUsers(f.data.filter((item) => item.active && item.role !== "CLIENT"));
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);
  const visible = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!status || t.status === status) &&
          `${t.title} ${t.client?.name || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [tasks, query, status],
  );
  async function setTaskStatus(task, next) {
    if (
      next === "DONE" &&
      task.settings?.checklistRequired &&
      (task.checklist || []).some((x) => !x.done)
    )
      return window.alert("Conclua o checklist antes de finalizar.");
    await api.patch(`/demands/${task.id}/status`, { status: next });
    load();
  }
  async function removeTask(task) {
    if (window.confirm(`Excluir ${task.title}?`)) {
      await api.delete(`/demands/${task.id}`);
      load();
    }
  }
  return (
    <Shell tab={tab} setTab={setTab}>
      <section className="p-6">
        {tab === "Tarefas" && (
          <>
            <div className="mb-5 flex justify-between">
              <h1 className="text-2xl font-semibold">Minhas tarefas</h1>
              <button
                onClick={() => setChoice(true)}
                className="flex gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white"
              >
                <Plus size={17} /> Nova tarefa
              </button>
            </div>
            <div className="mb-7 flex gap-4">
              <label className="flex h-10 w-72 items-center gap-2 rounded border px-3">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tarefa ou cliente"
                  className="w-full outline-none"
                />
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 w-60 rounded border bg-white px-3"
              >
                <option value="">Todos os status</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded border">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-[#ececec]">
                  <tr>
                    {[
                      "Tarefa",
                      "Processo",
                      "Status",
                      "Cliente",
                      "Departamento",
                      "Prazo",
                      "Resp.",
                      "",
                    ].map((h) => (
                      <th key={h} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((task) => {
                    const overdue =
                      task.dueDate &&
                      new Date(task.dueDate) < new Date() &&
                      task.status !== "DONE";
                    return (
                      <tr key={task.id} className="border-t">
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              setDrawer({ type: "task", item: task })
                            }
                            className="font-medium"
                          >
                            {task.title}
                          </button>
                        </td>
                        <td className="px-4">{task.processName || "-"}</td>
                        <td className="px-4">
                          <select
                            value={task.status}
                            onChange={(e) =>
                              setTaskStatus(task, e.target.value)
                            }
                            className="rounded border bg-white px-3 py-1"
                          >
                            <option value="PENDING">A fazer</option>
                            <option value="IN_PROGRESS">Em andamento</option>
                            <option value="WAITING_CLIENT">
                              Aguardando cliente
                            </option>
                            <option value="DONE">Concluída</option>
                          </select>
                        </td>
                        <td className="px-4">{task.client?.name}</td>
                        <td className="px-4">{task.department || "-"}</td>
                        <td className={`px-4 ${overdue ? "text-red-600" : ""}`}>
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                        <td className="px-4">
                          {task.assignedTo?.name
                            ?.split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("") || "AC"}
                        </td>
                        <td className="px-4">
                          <div className="flex gap-3 text-[#16829b]">
                            <button
                              onClick={() =>
                                setDrawer({ type: "task", item: task })
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => removeTask(task)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "Processos" && (
          <>
            <div className="mb-6 flex justify-between">
              <h1 className="text-2xl font-semibold">Meus processos</h1>
              <button
                onClick={() => setDrawer({ type: "process" })}
                className="flex gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white"
              >
                <Plus size={17} /> Iniciar processo
              </button>
            </div>
            <div className="overflow-hidden rounded border">
              <div className="grid grid-cols-7 bg-[#f2f2f2] px-4 py-3 text-sm">
                <span>Processo</span>
                <span>Departamento</span>
                <span>Cliente</span>
                <span>Andamento</span>
                <span>Data de início</span>
                <span>Prazo</span>
                <span>Responsável</span>
              </div>
              {processes.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-7 border-t px-4 py-4 text-sm"
                >
                  <span>
                    <button
                      onClick={() => setProcessDetail(p)}
                      className="font-semibold text-[#16829b]"
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() => setProcessDetail(p)}
                      className="ml-3 text-xs text-[#68737a]"
                    >
                      Detalhes ›
                    </button>
                  </span>
                  <span>{p.department || "-"}</span>
                  <span>{p.client?.name}</span>
                  <span>
                    {
                      (p.stages || [])
                        .flatMap((stage) => stage.tasks || [])
                        .filter((task) => task.done).length
                    }{" "}
                    de{" "}
                    {
                      (p.stages || []).flatMap((stage) => stage.tasks || [])
                        .length
                    }{" "}
                    tarefas
                  </span>
                  <span>
                    {new Date(p.startDate).toLocaleDateString("pt-BR")}
                  </span>
                  <span>
                    {p.dueDate
                      ? new Date(p.dueDate).toLocaleDateString("pt-BR")
                      : "-"}
                  </span>
                  <span>{p.responsible?.name || "-"}</span>
                </div>
              ))}
              {!processes.length && (
                <div className="grid min-h-[420px] place-items-center text-center">
                  <div>
                    <Workflow className="mx-auto mb-5 h-20 w-20 text-[#73b8cf]" />
                    <h2 className="text-xl">
                      Você ainda não tem processos iniciados
                    </h2>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {tab === "Configurações" && (
          <ConfigurationPanel
            section={configSection}
            setSection={setConfigSection}
            taskTemplates={templates}
            processTemplates={processTemplates}
            users={users}
            onNewTask={() => setDrawer({ type: "template" })}
            onEditTask={(item) => setDrawer({ type: "template", item })}
            onNewProcess={() => setDrawer({ type: "process-template" })}
            onEditProcess={(item) =>
              setDrawer({ type: "process-template", item })
            }
            onReload={load}
          />
        )}
      </section>
      {choice && (
        <ChoiceModal
          templates={templates}
          onClose={() => setChoice(false)}
          onChoose={(template) => {
            setChoice(false);
            setDrawer({ type: "task", template });
          }}
        />
      )}
      {drawer?.type === "task" && (
        <TaskDrawer
          task={drawer.item}
          template={drawer.template}
          clients={clients}
          user={user}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            load();
          }}
        />
      )}
      {drawer?.type === "template" && (
        <TaskDrawer
          task={
            drawer.item ? { ...drawer.item, title: drawer.item.name } : null
          }
          clients={clients}
          user={user}
          saveAsTemplate
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            load();
          }}
        />
      )}
      {drawer?.type === "process" && (
        <ProcessModal
          clients={clients}
          templates={processTemplates}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            load();
          }}
        />
      )}
      {drawer?.type === "process-template" && (
        <ProcessTemplateEditor
          template={drawer.item}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            load();
          }}
        />
      )}
      {processDetail && (
        <ProcessBoard
          process={processDetail}
          onClose={() => setProcessDetail(null)}
          onUpdated={(next) => {
            setProcessDetail(next);
            load();
          }}
        />
      )}
    </Shell>
  );
}

function ConfigurationPanel({
  section,
  setSection,
  taskTemplates,
  processTemplates,
  users,
  onNewTask,
  onEditTask,
  onNewProcess,
  onEditProcess,
  onReload,
}) {
  const [fromUserId, setFromUserId] = useState(users[0]?.id || "");
  const [toUserId, setToUserId] = useState(users[1]?.id || "");
  const [transfer, setTransfer] = useState({ tasks: true, processes: true });
  useEffect(() => {
    if (!fromUserId && users[0]) setFromUserId(users[0].id);
    if (!toUserId && users[1]) setToUserId(users[1].id);
  }, [users]);
  async function executeTransfer() {
    if (!fromUserId || !toUserId || fromUserId === toUserId)
      return window.alert("Selecione responsáveis diferentes.");
    const { data } = await api.post("/demands/responsibilities/transfer", {
      fromUserId,
      toUserId,
      ...transfer,
    });
    window.alert(
      `${data.tasks} tarefa(s) e ${data.processes} processo(s) transferidos.`,
    );
    onReload();
  }
  return (
    <div className="grid grid-cols-[220px_1fr] -m-6 min-h-[680px]">
      <aside className="border-r bg-[#fbfbfb] py-3">
        <p className="px-5 py-3 text-xs text-[#9aa2a7]">CONFIGURAÇÕES</p>
        {[
          "Modelos de tarefas",
          "Modelos de processos",
          "Responsabilidades",
        ].map((item) => (
          <button
            key={item}
            onClick={() => setSection(item)}
            className={`block w-full px-5 py-4 text-left text-sm ${section === item ? "bg-[#e5f6fb] text-[#16829b]" : ""}`}
          >
            {item}
          </button>
        ))}
      </aside>
      <div className="p-6">
        {section === "Modelos de tarefas" && (
          <TemplateList
            title="Modelos de tarefa"
            items={taskTemplates}
            onNew={onNewTask}
            onEdit={onEditTask}
            detail={(item) =>
              `${item.checklist?.length || 0} checklist / ${item.forms?.length || 0} formulários`
            }
          />
        )}
        {section === "Modelos de processos" && (
          <TemplateList
            title="Modelos de processos"
            items={processTemplates}
            onNew={onNewProcess}
            onEdit={onEditProcess}
            detail={(item) => `${item.stages?.length || 0} etapas`}
          />
        )}
        {section === "Responsabilidades" && (
          <div>
            <h1 className="mb-8 text-2xl font-semibold">
              Transferência de responsabilidades
            </h1>
            <div className="grid grid-cols-3 gap-6">
              <label className="text-sm">
                Transferir de
                <select
                  value={fromUserId}
                  onChange={(e) => setFromUserId(e.target.value)}
                  className="mt-2 h-10 w-full rounded border bg-white px-3"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Transferir para
                <select
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  className="mt-2 h-10 w-full rounded border bg-white px-3"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm">
                <span className="block mb-2">O que transferir</span>
                <div className="space-y-3 rounded border p-3">
                  <label className="block">
                    <input
                      type="checkbox"
                      checked={transfer.tasks}
                      onChange={() =>
                        setTransfer({ ...transfer, tasks: !transfer.tasks })
                      }
                    />{" "}
                    Tarefas em aberto
                  </label>
                  <label className="block">
                    <input
                      type="checkbox"
                      checked={transfer.processes}
                      onChange={() =>
                        setTransfer({
                          ...transfer,
                          processes: !transfer.processes,
                        })
                      }
                    />{" "}
                    Processos em aberto
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-16 text-center">
              <Users className="mx-auto h-24 w-24 text-[#2aa4c8]" />
              <h2 className="mt-4 text-xl font-semibold">
                Transferir atividades entre responsáveis
              </h2>
              <p className="mt-2 text-sm text-[#68737a]">
                As tarefas e processos selecionados passam para o novo
                responsável.
              </p>
              <button
                onClick={executeTransfer}
                disabled={!transfer.tasks && !transfer.processes}
                className="mt-7 rounded bg-[#2693d2] px-6 py-2.5 text-white disabled:opacity-40"
              >
                Transferir responsabilidade
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateList({ title, items, onNew, onEdit, detail }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const visible = items.filter(
    (i) =>
      (!department || i.department === department) &&
      `${i.name} ${i.description || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="mb-6 flex justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <button
          onClick={onNew}
          className="flex gap-2 rounded bg-[#2693d2] px-5 py-2.5 text-white"
        >
          <Plus size={17} /> Novo modelo
        </button>
      </div>
      <div className="mb-6 flex gap-4">
        <label className="flex h-10 w-96 items-center gap-2 rounded border px-3">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Modelo, descrição"
            className="w-full outline-none"
          />
        </label>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="h-10 w-64 rounded border bg-white px-3"
        >
          <option value="">Todos os departamentos</option>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="overflow-hidden rounded border">
        <div className="grid grid-cols-[1fr_250px_180px_70px] bg-[#eee] px-4 py-3 text-sm">
          <span>Modelo</span>
          <span>Departamento</span>
          <span>Estrutura</span>
          <span />
        </div>
        {visible.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_250px_180px_70px] border-t px-4 py-4 text-sm"
          >
            <button
              onClick={() => onEdit(item)}
              className="text-left font-medium text-[#16829b]"
            >
              {item.name}
            </button>
            <span>{item.department || "-"}</span>
            <span>{detail(item)}</span>
            <button onClick={() => onEdit(item)}>
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function ProcessTemplateEditor({ template, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: template?.name || "",
    department: template?.department || "",
    instructions: template?.instructions || "",
    durationDays: template?.durationDays || 1,
    stages: template?.stages || [
      { id: `s-${Date.now()}`, name: "Etapa 1", tasks: [] },
    ],
  });
  const [taskStage, setTaskStage] = useState(null);
  const addStage = () =>
    setForm({
      ...form,
      stages: [
        ...form.stages,
        {
          id: `s-${Date.now()}`,
          name: `Etapa ${form.stages.length + 1}`,
          tasks: [],
        },
      ],
    });
  const addTask = (stageIndex, title, days) => {
    const stages = form.stages.map((s, i) =>
      i === stageIndex
        ? {
            ...s,
            tasks: [
              ...s.tasks,
              {
                id: `t-${Date.now()}`,
                title,
                dueOffset: Number(days) || 0,
                done: false,
              },
            ],
          }
        : s,
    );
    setForm({
      ...form,
      stages,
      durationDays: Math.max(
        ...stages.flatMap((s) => s.tasks.map((t) => t.dueOffset)),
        1,
      ),
    });
    setTaskStage(null);
  };
  async function save() {
    const payload = { ...form, durationDays: Number(form.durationDays) };
    template?.createdAt
      ? await api.put(`/demands/process-templates/${template.id}`, payload)
      : await api.post("/demands/process-templates", payload);
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <header className="sticky top-0 z-10 flex h-16 justify-between border-b bg-white px-6 py-4">
        <div>
          <small>Modelos de processos</small>
          <h1 className="text-2xl font-semibold">
            {template ? "Editar modelo" : "Novo modelo"}
          </h1>
        </div>
        <button onClick={onClose}>
          <X />
        </button>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-[1fr_320px] gap-8">
          <div>
            <label className="block text-sm">
              Título
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 h-10 w-full rounded border px-3"
              />
            </label>
            <label className="mt-5 block text-sm">
              Instruções
              <textarea
                value={form.instructions}
                onChange={(e) =>
                  setForm({ ...form, instructions: e.target.value })
                }
                className="mt-2 h-24 w-full rounded border p-3"
              />
            </label>
          </div>
          <label className="text-sm">
            Departamento
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="mt-2 h-10 w-full rounded border bg-white px-3"
            >
              <option value="">Selecione</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-7 bg-[#f2f2f2] px-4 py-3 font-semibold">
          Processo: {form.durationDays} dias
        </div>
        <div className="mt-4 flex min-w-max gap-3 overflow-x-auto pb-8">
          {form.stages.map((stage, index) => (
            <section key={stage.id} className="w-[360px] shrink-0">
              <input
                value={stage.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stages: form.stages.map((s, i) =>
                      i === index ? { ...s, name: e.target.value } : s,
                    ),
                  })
                }
                className="h-11 w-full rounded bg-[#eee] px-4 font-semibold"
              />
              {stage.tasks.map((task) => (
                <div key={task.id} className="mt-3 rounded border bg-white p-4">
                  <b>{task.title}</b>
                  <p className="mt-2 text-xs">Prazo: {task.dueOffset} dia(s)</p>
                </div>
              ))}
              <button
                onClick={() => setTaskStage(index)}
                className="mt-4 w-full rounded border border-[#2693d2] py-2 text-[#16829b]"
              >
                <Plus size={15} className="inline" /> Nova tarefa
              </button>
            </section>
          ))}
          <button
            onClick={addStage}
            className="h-11 rounded border border-[#2693d2] px-5 text-[#16829b]"
          >
            <Plus size={15} className="inline" /> Nova etapa
          </button>
        </div>
      </main>
      <footer className="fixed inset-x-0 bottom-0 flex justify-end gap-3 border-t bg-white p-4">
        <button onClick={onClose}>Cancelar</button>
        <button
          onClick={save}
          disabled={!form.name.trim() || !form.stages.length}
          className="rounded bg-[#2693d2] px-6 py-2 text-white disabled:opacity-40"
        >
          Criar modelo
        </button>
      </footer>
      {taskStage !== null && (
        <ProcessTemplateTaskModal
          onClose={() => setTaskStage(null)}
          onSave={(title, days) => addTask(taskStage, title, days)}
        />
      )}
    </div>
  );
}

function ProcessTemplateTaskModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(1);
  return (
    <div className="fixed inset-0 z-[60] bg-black/40">
      <div className="absolute inset-y-0 right-0 w-[620px] bg-white p-6">
        <div className="flex justify-between">
          <h2 className="text-2xl font-semibold">Nova tarefa</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="mt-8 block text-sm">
          Tarefa
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 h-10 w-full rounded border px-3"
          />
        </label>
        <label className="mt-5 block text-sm">
          Prazo de conclusão (dias)
          <input
            type="number"
            min="0"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="mt-2 h-10 w-32 rounded border px-3"
          />
        </label>
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-3 border-t p-4">
          <button onClick={onClose}>Cancelar</button>
          <button
            onClick={() => title.trim() && onSave(title.trim(), days)}
            className="rounded bg-[#2693d2] px-5 py-2 text-white"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessBoard({ process, onClose, onUpdated }) {
  const [stages, setStages] = useState(process.stages || []);
  const allTasks = stages.flatMap((stage) => stage.tasks || []);
  const doneCount = allTasks.filter((task) => task.done).length;
  const startDate = new Date(process.startDate);

  async function toggleTask(stageIndex, taskId) {
    const stageUnlocked =
      stageIndex === 0 ||
      (stages[stageIndex - 1]?.tasks || []).every((task) => task.done);
    if (!stageUnlocked) return;
    const nextStages = stages.map((stage, index) =>
      index !== stageIndex
        ? stage
        : {
            ...stage,
            tasks: stage.tasks.map((task) =>
              task.id === taskId ? { ...task, done: !task.done } : task,
            ),
          },
    );
    const tasks = nextStages.flatMap((stage) => stage.tasks || []);
    const progress = tasks.length
      ? Math.round(
          (tasks.filter((task) => task.done).length / tasks.length) * 100,
        )
      : 0;
    setStages(nextStages);
    const { data } = await api.put(`/demands/processes/${process.id}`, {
      stages: nextStages,
      progress,
      status: progress === 100 ? "CONCLUIDO" : "EM_ANDAMENTO",
    });
    onUpdated(data);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-[#3f4548]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6">
        <div>
          <button onClick={onClose} className="mr-4 text-[#16829b]">
            ‹ Meus processos
          </button>
          <b className="text-xl">{process.name}</b>
          {process.complement && (
            <span className="ml-3 text-sm text-[#68737a]">
              {process.complement}
            </span>
          )}
        </div>
        <div className="flex gap-5">
          <button className="flex gap-2 text-[#16829b]">
            <MessageSquare size={17} /> Comentários
          </button>
          <button title="Tela cheia">
            <Maximize2 size={18} />
          </button>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
      </header>
      <main className="p-6">
        <div className="mb-6 flex flex-wrap gap-8 text-sm">
          <div>
            <small className="block">Cliente</small>
            <b>{process.client?.name}</b>
          </div>
          <div>
            <small className="block">Data de início</small>
            <b>{startDate.toLocaleDateString("pt-BR")}</b>
          </div>
          <div>
            <small className="block">Conclusão prevista</small>
            <b>
              {process.dueDate
                ? new Date(process.dueDate).toLocaleDateString("pt-BR")
                : "-"}
            </b>
          </div>
          <div>
            <small className="block">Departamento</small>
            <b>{process.department || "-"}</b>
          </div>
          <div>
            <small className="block">Responsável</small>
            <b>{process.responsible?.name || "-"}</b>
          </div>
          <div>
            <small className="block">Andamento</small>
            <b>
              {doneCount} de {allTasks.length}
            </b>
          </div>
        </div>
        {process.instructions && (
          <div className="mb-6">
            <b className="text-sm">Instruções</b>
            <p className="mt-2 text-sm">{process.instructions}</p>
          </div>
        )}
        <div className="mb-4 bg-[#f2f2f2] px-4 py-3">Tarefas</div>
        <div className="overflow-x-auto pb-5">
          <div className="flex min-w-max gap-3">
            {stages.map((stage, stageIndex) => {
              const unlocked =
                stageIndex === 0 ||
                (stages[stageIndex - 1]?.tasks || []).every(
                  (task) => task.done,
                );
              return (
                <section key={stage.id} className="w-[350px]">
                  <h3 className="mb-3 flex items-center gap-2 bg-[#f1f1f1] px-4 py-3 font-semibold">
                    <span
                      className={`h-5 w-5 rounded-full border ${stage.tasks.every((task) => task.done) ? "border-emerald-500 bg-emerald-100" : ""}`}
                    />
                    {stage.name}
                  </h3>
                  <div className="space-y-3">
                    {stage.tasks.map((task) => {
                      const due = new Date(startDate);
                      due.setDate(due.getDate() + (task.dueOffset || 0));
                      return (
                        <article
                          key={task.id}
                          className={`rounded border ${unlocked ? "bg-white" : "bg-[#f5f5f5] text-[#777]"}`}
                        >
                          <div className="border-b bg-[#f5f5f5] px-4 py-3 text-xs">
                            {unlocked
                              ? task.done
                                ? "Concluída"
                                : "A fazer"
                              : "Aguardando a conclusão da etapa anterior"}
                          </div>
                          <div className="p-4">
                            <button
                              onClick={() => toggleTask(stageIndex, task.id)}
                              disabled={!unlocked}
                              className="flex items-start gap-3 text-left"
                            >
                              <span
                                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${task.done ? "border-emerald-500 bg-emerald-500 text-white" : ""}`}
                              >
                                {task.done && <Check size={13} />}
                              </span>
                              <b>{task.title}</b>
                            </button>
                            <div className="mt-4 flex justify-between text-xs">
                              <span className="flex gap-1">
                                <CalendarDays size={14} />{" "}
                                {due.toLocaleDateString("pt-BR")}
                              </span>
                              <span className="flex gap-1">
                                <UserRound size={14} />{" "}
                                {process.responsible?.name || "Responsável"}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function ProcessModal({ clients, templates, onClose, onSaved }) {
  const [form, setForm] = useState({
    templateId: templates[0]?.id || "",
    name: templates[0]?.name || "",
    clientId: clients[0]?.id || "",
    department: "",
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    complement: "",
  });
  async function save(e) {
    e.preventDefault();
    try {
      const template = templates.find((item) => item.id === form.templateId);
      const start = new Date(`${form.startDate}T12:00:00`);
      const due =
        form.dueDate ||
        new Date(start.getTime() + (template?.durationDays || 30) * 86400000)
          .toISOString()
          .slice(0, 10);
      await api.post("/demands/processes", {
        ...form,
        name: template?.name || form.name,
        department: form.department || template?.department || null,
        instructions: template?.instructions || null,
        stages: template?.stages || [],
        dueDate: due,
      });
      onSaved();
    } catch (error) {
      window.alert(
        error.response?.data?.error || "Não foi possível iniciar o processo.",
      );
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <form onSubmit={save} className="w-[820px] rounded bg-white p-6">
        <div className="mb-5 flex justify-between">
          <h2 className="text-2xl font-semibold">Iniciar processo</h2>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block text-sm">
            Modelo de processo
            <select
              required
              value={form.templateId}
              onChange={(e) => {
                const template = templates.find(
                  (item) => item.id === e.target.value,
                );
                setForm({
                  ...form,
                  templateId: e.target.value,
                  name: template?.name || "",
                  department: template?.department || form.department,
                });
              }}
              className="mt-1 h-10 w-full rounded border bg-white px-3"
            >
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Cliente
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="mt-1 h-10 w-full rounded border bg-white px-3"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-4">
            <label className="text-sm">
              Departamento
              <select
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                className="mt-1 h-10 w-full rounded border bg-white"
              >
                <option value="">Selecione</option>
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Início
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className="mt-1 h-10 w-full rounded border px-2"
              />
            </label>
            <label className="text-sm">
              Prazo
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="mt-1 h-10 w-full rounded border px-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            Complemento (opcional)
            <input
              value={form.complement}
              onChange={(e) => setForm({ ...form, complement: e.target.value })}
              placeholder="Nome do funcionário, protocolo..."
              className="mt-1 h-10 w-full rounded border px-3"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="rounded bg-[#2693d2] px-5 py-2 text-white">
            Iniciar
          </button>
        </div>
      </form>
    </div>
  );
}
