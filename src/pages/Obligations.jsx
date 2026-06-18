import React, { useMemo, useRef, useState } from 'react';
import { company, departmentStats, obligations as seedObligations, protocols as seedProtocols } from '../data/niboMockData';

const tabs = ['Calendario', 'Conferencia', 'Protocolos', 'Relatorios', 'Configuracoes'];
const clients = [
  'ANA CAROLINA CARPINE AGUIAR',
  'IVANI SEVERINA SOARES DE ALMEIDA',
  'SILVIA HELENA CARPINE RODRIGUES',
  'THIAGO SANTOS OLIVEIRA',
  'BOARDEN MARKETING DIGITAL LTDA',
];
const departments = ['Departamento Fiscal', 'Departamento Contabil', 'Departamento Pessoal', 'Departamento de Registro', 'Departamento Financeiro'];
const obligationNames = seedObligations.map((item) => item[0]);
const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const statusColors = {
  overdue: 'bg-red-500 text-white',
  dueToday: 'bg-amber-300 text-ink',
  openOnTime: 'bg-zinc-300 text-ink',
  doneOnTime: 'bg-emerald-300 text-ink',
  doneLate: 'bg-rose-300 text-ink',
};

function makeTasks() {
  return [
    { id: 1, day: 5, client: clients[1], department: 'Departamento Fiscal', obligation: 'PGDAS - Declaracao Original', status: 'doneLate', responsible: 'Ana Carolina' },
    { id: 2, day: 10, client: clients[0], department: 'Departamento Fiscal', obligation: 'DAS - Documento de Arrecadacao do Simples Nacional', status: 'overdue', responsible: 'Ana Carolina' },
    { id: 3, day: 17, client: clients[0], department: 'Departamento Pessoal', obligation: 'ADIANTAMENTO SALARIAL (Vencimento dia 15)', status: 'dueToday', responsible: 'Ana Carolina' },
    { id: 4, day: 17, client: clients[1], department: 'Departamento Fiscal', obligation: 'PGDAS - Recibo de Entrega da Apuracao', status: 'doneOnTime', responsible: 'Ana Carolina' },
    { id: 5, day: 18, client: clients[2], department: 'Departamento Fiscal', obligation: 'DAS Mei do Parcelamento PARCMEI', status: 'dueToday', responsible: 'Ana Carolina' },
    { id: 6, day: 23, client: clients[3], department: 'Departamento Fiscal', obligation: 'DeSTDA SIMPLES NACIONAL', status: 'openOnTime', responsible: 'Ana Carolina' },
    { id: 7, day: 25, client: clients[4], department: 'Departamento Contabil', obligation: 'BALANCETE DE VERIFICACAO', status: 'openOnTime', responsible: 'Ana Carolina' },
    { id: 8, day: 25, client: clients[0], department: 'Departamento Fiscal', obligation: 'NOTAS FISCAIS DE ENTRADA', status: 'openOnTime', responsible: 'Ana Carolina' },
  ];
}

function makeRobots() {
  return [
    { id: 'robot-darf-prev', obligation: 'DARF Previdenciario', identifiers: ['0561', '0588', '1082', '1089', '1099', 'darf previdenciario'] },
    { id: 'robot-das', obligation: 'DAS - Documento de Arrecadacao do Simples Nacional', identifiers: ['das', 'simples nacional', 'pgdas'] },
    { id: 'robot-esocial', obligation: 'DAE - Documento de Arrecadacao do eSocial', identifiers: ['dae', 'esocial'] },
  ];
}

function protocolFromSeed(row, index) {
  return {
    id: `seed-${index}`,
    document: row[0],
    client: row[1],
    reference: row[2],
    dueDate: row[3],
    value: row[4],
    status: row[5],
    responsible: 'Ana Carolina',
    fileName: `${row[0].slice(0, 22)}.pdf`,
    protocolDate: '18/06/2026',
  };
}

function recognizePdf(fileName, robots) {
  const normalizedName = fileName.toLowerCase();
  return robots.find((robot) => robot.identifiers.some((identifier) => normalizedName.includes(identifier.toLowerCase())));
}

function AppShell({ activeTab, setActiveTab, children }) {
  return (
    <div className="nibo-ui min-h-screen bg-white text-[#3f4548]">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[46px] flex-col items-center bg-[#003f82] text-white">
        <div className="mb-5 mt-4 text-2xl font-bold leading-none">n</div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <IconButton active>□</IconButton>
          <IconButton>⌁</IconButton>
          <IconButton>▤</IconButton>
        </div>
        <div className="mb-4 flex flex-col items-center gap-3 text-xs">
          <IconButton>□</IconButton>
          <span>News</span>
          <IconButton>?</IconButton>
          <span>Ajuda</span>
          <div className="grid h-8 w-8 place-items-center rounded-full border border-white/70 text-xs">AC</div>
        </div>
      </aside>

      <aside className="fixed inset-y-0 left-[46px] z-10 w-[236px] border-r border-[#dfe5e8] bg-[#f4f7fb]">
        <div className="flex h-[58px] items-center justify-between border-b border-[#dfe5e8] px-5">
          <h1 className="text-xl text-[#444]">Contador</h1>
          <span className="text-[#9aa5ad]">□</span>
        </div>
        <nav className="px-5 py-4 text-sm">
          <div className="mb-5 flex items-center gap-2 text-[#7a858c]">↯ Comece rapido</div>
          <MenuSection title="OPERACAO" />
          <div className="mb-1 font-semibold text-[#4f5559]">□ Obrigacoes</div>
          <div className="mb-5 ml-5 space-y-1">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`block w-full rounded px-3 py-2 text-left ${activeTab === tab ? 'bg-[#dce5ef] text-[#2f3a42]' : 'text-[#6d7479] hover:bg-white'}`}>
                {tab}
              </button>
            ))}
          </div>
          {['Tarefas & Processos', 'Relacionamento', 'Documentos recebidos', 'Automacao contabil'].map((item) => (
            <button key={item} className="mb-4 flex w-full justify-between text-[#69747b]"><span>{item}</span><span>⌄</span></button>
          ))}
          <div className="mb-5 flex items-center justify-between text-[#69747b]">
            <span>Radar e-CAC <b className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] text-white">NOVO</b></span>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-white">⌄</span>
          </div>
          <MenuSection title="CADASTROS" />
          <button className="flex w-full justify-between text-[#69747b]"><span>Clientes</span><span>⌄</span></button>
        </nav>
      </aside>

      <main className="ml-[282px] min-h-screen">
        <header className="flex h-[58px] items-center justify-between border-b border-[#dfe5e8] px-5">
          <div className="text-base text-[#60666b]">{company.document} {company.name}</div>
          <div />
        </header>
        <div className="flex h-[45px] items-end gap-14 border-b border-[#dfe5e8] px-5 text-sm">
          <span className="pb-3 font-semibold">Obrigacoes</span>
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`h-full border-b-2 px-1 ${activeTab === tab ? 'border-[#003f82] font-semibold text-[#202427]' : 'border-transparent text-[#666]'}`}>
              {tab}
            </button>
          ))}
        </div>
        {children}
      </main>
    </div>
  );
}

function IconButton({ children, active }) {
  return <button className={`grid h-9 w-9 place-items-center rounded-md text-lg ${active ? 'bg-white/15' : 'hover:bg-white/10'}`}>{children}</button>;
}

function MenuSection({ title }) {
  return <div className="mb-4 border-t border-[#dfe5e8] pt-4 text-xs font-semibold text-[#7b858c]">{title}</div>;
}

function Badge({ value, color }) {
  return <span className={`inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs ${statusColors[color] || statusColors.openOnTime}`}>{value}</span>;
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded border border-[#dfe5e8] bg-white px-3 text-[#3f4548]">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded border border-[#dfe5e8] bg-white px-3 text-[#3f4548]" />
    </label>
  );
}

function Calendar({ tasks, setTasks }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [viewBy, setViewBy] = useState('atividade');
  const [showDone, setShowDone] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);

  const days = useMemo(() => buildMonth(year, month), [year, month]);
  const tasksWithCalendarStatus = tasks.map((task) => ({
    ...task,
    calendarStatus: statusForDate(task, new Date(year, month, task.day), today),
  }));
  const visibleTasks = tasksWithCalendarStatus.filter((task) => showDone || !isDoneStatus(task.calendarStatus));
  const selectedTasks = visibleTasks.filter((task) => task.day === selectedDay);
  const grouped = groupTasks(selectedTasks, viewBy);

  function shiftMonth(direction) {
    const next = new Date(year, month + direction, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
    setSelectedDay(isSameMonth(next, today) ? today.getDate() : 1);
    setExpandedClient(null);
  }

  function goToToday() {
    setMonth(today.getMonth());
    setYear(today.getFullYear());
    setSelectedDay(today.getDate());
    setExpandedClient(null);
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const currentStatus = statusForDate(task, new Date(year, month, task.day), today);
      if (isDoneStatus(currentStatus)) return { ...task, status: 'openOnTime' };
      return { ...task, status: currentStatus === 'overdue' ? 'doneLate' : 'doneOnTime' };
    }));
  }

  function selectView(mode) {
    setViewBy(mode);
    setExpandedClient(null);
  }

  return (
    <section className="grid grid-cols-[600px_1fr]">
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Calendario</h2>
          <div className="flex items-center gap-6 text-lg text-[#147e9a]">
            <button onClick={() => shiftMonth(-1)} className="rounded px-2 py-1 hover:bg-[#eaf6ff]">‹</button>
            <b className="min-w-28 text-center text-[#111]">{monthLabels[month]}/{year}</b>
            <button onClick={() => shiftMonth(1)} className="rounded px-2 py-1 hover:bg-[#eaf6ff]">›</button>
            <button onClick={goToToday} className="rounded px-2 py-1 hover:bg-[#eaf6ff]">⌁</button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-xs font-semibold text-[#777]">{['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map((day) => <div key={day} className="px-2 py-2">{day}</div>)}</div>
        <div className="grid grid-cols-7 border-l border-t border-[#e6eaed]">
          {days.map((day, index) => {
            const dayTasks = visibleTasks.filter((task) => task.day === day.date.getDate() && day.current);
            const counts = summarizeStatuses(dayTasks, day.date, today);
            return (
              <button key={day.key} onClick={() => day.current && setSelectedDay(day.date.getDate())} className={`h-[76px] border-b border-r border-[#e6eaed] p-2 text-left ${selectedDay === day.date.getDate() && day.current ? 'bg-[#e6f6f7] ring-1 ring-[#8cc7cd]' : index % 7 === 0 || index % 7 === 6 ? 'bg-[#f7f7f7]' : ''}`}>
                <div className={`mb-4 text-base ${day.current ? 'text-[#222]' : 'text-[#aaa]'}`}>{day.date.getDate()}</div>
                <div className="flex justify-center gap-1">{counts.map((count) => <Badge key={count.color} value={count.value} color={count.color} />)}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-6 text-sm">
          <div className="border-r border-[#e6eaed] pr-6">
            <p className="mb-1 font-medium text-[#555]">Em aberto</p>
            <div className="flex gap-4">
              <Legend label="Fora do prazo" color="bg-red-500" />
              <Legend label="Vence hoje" color="bg-amber-300" />
              <Legend label="Dentro do prazo" color="bg-zinc-300" />
            </div>
          </div>
          <div>
            <p className="mb-1 font-medium text-[#555]">Concluido</p>
            <div className="flex gap-4">
              <Legend label="Dentro do prazo" color="bg-emerald-300" />
              <Legend label="Fora do prazo" color="bg-rose-300" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-l border-[#dfe5e8] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tarefas do dia {String(selectedDay).padStart(2, '0')}/{String(month + 1).padStart(2, '0')}/{year}</h2>
          <label className="flex items-center gap-2 text-sm text-[#147e9a]"><input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} /> Exibir concluidos</label>
        </div>
        <div className="mb-5 flex gap-4 text-sm">
          {['atividade', 'cliente'].map((mode) => (
            <button key={mode} onClick={() => selectView(mode)} className={`border-b-2 pb-2 ${viewBy === mode ? 'border-[#003f82] font-semibold' : 'border-transparent'}`}>
              Por {mode === 'atividade' ? 'atividade' : 'cliente'}
            </button>
          ))}
        </div>
        {viewBy === 'cliente' ? (
          <div className="mb-5 space-y-2 border-b border-[#e6eaed] pb-5">
            {Object.entries(grouped).length === 0 ? (
              <p className="text-sm text-[#7a858c]">Nenhum cliente com tarefa neste dia.</p>
            ) : Object.entries(grouped).map(([clientName, items]) => (
              <div key={clientName}>
                <button
                  onClick={() => setExpandedClient((current) => current === clientName ? null : clientName)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-[#f6fbfd]"
                >
                  <Badge value={items.length} color="done" />
                  <span className="font-medium">{clientName}</span>
                  <span className="ml-auto text-[#16829b]">{expandedClient === clientName ? '−' : '+'}</span>
                </button>
                {expandedClient === clientName && (
                  <div className="ml-8 mt-2 space-y-2">
                    {items.map((task) => <TaskCard key={task.id} task={task} onToggle={toggleTask} compact />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-5 space-y-2 border-b border-[#e6eaed] pb-5">
            {Object.entries(grouped).map(([name, items]) => <div key={name} className="flex gap-2"><Badge value={items.length} color="done" />{name}</div>)}
          </div>
        )}
        {selectedTasks.length === 0 ? (
          <p className="rounded border border-dashed border-[#cfd8dd] p-8 text-center text-[#7a858c]">Nenhuma tarefa para este dia.</p>
        ) : viewBy === 'cliente' ? (
          <p className="text-sm text-[#7a858c]">Clique no nome de um cliente acima para ver as tarefas dele neste dia.</p>
        ) : (
          <div className="space-y-3">
            {selectedTasks.map((task) => <TaskCard key={task.id} task={task} onToggle={toggleTask} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function TaskCard({ task, onToggle, compact }) {
  const taskStatus = task.calendarStatus || task.status;
  return (
    <article className={`rounded border border-[#e6eaed] bg-white ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{task.obligation}</div>
          <div className="mt-1 text-sm text-[#68737a]">{task.client} · {task.department}</div>
        </div>
        <button onClick={() => onToggle(task.id)} className={`rounded px-3 py-1 text-xs ${isDoneStatus(taskStatus) ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f2f2f2]'}`}>
          {isDoneStatus(taskStatus) ? statusLabel(taskStatus) : 'Marcar baixa'}
        </button>
      </div>
    </article>
  );
}

function Conference({ protocols, setProtocols, robots }) {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [client, setClient] = useState(clients[0]);
  const [department, setDepartment] = useState(departments[0]);
  const [obligation, setObligation] = useState(obligationNames[0]);
  const [deliveryType, setDeliveryType] = useState('Portal do cliente');

  function addFiles(fileList) {
    const mapped = Array.from(fileList).map((file) => {
      const match = recognizePdf(file.name, robots);
      return {
        id: `${Date.now()}-${file.name}`,
        fileName: file.name,
        size: file.size,
        client,
        department,
        obligation: match?.obligation || obligation,
        deliveryType,
        status: match ? 'Reconhecido por robo' : 'Aguardando conferencia',
        robotMatch: match ? match.identifiers.join(', ') : '',
      };
    });
    setFiles((current) => [...mapped, ...current]);
  }

  function protocolFile(file) {
    const today = new Date().toLocaleDateString('pt-BR');
    setProtocols((current) => [{
      id: file.id,
      document: file.obligation,
      client: file.client,
      reference: '06/2026',
      dueDate: today,
      value: '',
      status: 'Protocolado',
      responsible: 'Ana Carolina',
      fileName: file.fileName,
      protocolDate: today,
    }, ...current]);
    setFiles((current) => current.filter((item) => item.id !== file.id));
  }

  return (
    <section className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Conferencia</h2>
        <div className="flex gap-3">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
          <button onClick={() => fileRef.current?.click()} className="rounded bg-[#f2f2f2] px-4 py-2">☁ Carregar arquivos</button>
          <button onClick={() => fileRef.current?.click()} className="rounded bg-[#f2f2f2] px-4 py-2">+ Novo protocolo</button>
        </div>
      </div>
      <div className="mb-4 flex gap-4 text-sm text-[#16829b]"><button>☁ Baixar o Nibo Assistente</button><button>☁ Baixar o Nibo Impressora</button><button>□ Lista de robos</button></div>
      <div className="grid grid-cols-4 gap-4">
        <SelectField label="Cliente" value={client} onChange={setClient} options={clients} />
        <SelectField label="Departamento" value={department} onChange={setDepartment} options={departments} />
        <SelectField label="Obrigacao" value={obligation} onChange={setObligation} options={obligationNames} />
        <SelectField label="Tipo de entrega" value={deliveryType} onChange={setDeliveryType} options={['Portal do cliente', 'Entrega fisica', 'E-mail']} />
      </div>
      <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="mt-6 rounded border-2 border-dashed border-[#d5dde3] bg-[#fafafa] p-8 text-center">
        <div className="text-5xl text-[#777]">☁</div>
        <b>Arraste arquivos para essa tela</b>
        <p className="mt-2 text-sm text-[#777]">Os arquivos entram na conferencia vinculados ao cliente e podem ser protocolados em seguida.</p>
      </div>
      <div className="mt-6">
        <h3 className="mb-3 font-semibold">Arquivos carregados</h3>
        {files.length === 0 ? <p className="text-sm text-[#777]">Nenhuma obrigacao para conferencia.</p> : (
          <div className="overflow-hidden rounded border border-[#e7ecef]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f3f3f3]"><tr>{['Arquivo', 'Cliente', 'Obrigacao reconhecida', 'Robo', 'Status', ''].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead>
              <tbody>{files.map((file) => <tr key={file.id} className="border-t border-[#e7ecef]"><td className="px-4 py-3 font-semibold text-[#16829b]">{file.fileName}</td><td className="px-4 py-3">{file.client}</td><td className="px-4 py-3">{file.obligation}</td><td className="px-4 py-3 text-xs text-[#68737a]">{file.robotMatch || '-'}</td><td className="px-4 py-3">{file.status}</td><td className="px-4 py-3 text-right"><button onClick={() => protocolFile(file)} className="rounded bg-[#2693d2] px-3 py-1.5 text-white">Protocolar</button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm text-[#68737a]">Protocolados nesta sessao: {protocols.filter((item) => item.status === 'Protocolado').length}</p>
    </section>
  );
}

function Protocols({ protocols, setProtocols }) {
  const [query, setQuery] = useState('');
  const [client, setClient] = useState('Todos');
  const filtered = protocols.filter((item) => (client === 'Todos' || item.client === client) && `${item.document} ${item.fileName}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="p-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-semibold">Protocolos ⓘ</h2><button onClick={() => setProtocols((current) => [{ ...protocolFromSeed(seedProtocols[0], Date.now()), id: `manual-${Date.now()}`, status: 'Protocolado' }, ...current])} className="rounded bg-[#2693d2] px-5 py-2.5 text-white">+ Novo protocolo</button></div>
      <div className="mb-6 grid grid-cols-[250px_260px_260px_270px_auto] gap-4">
        <TextField label="Buscar por" value={query} onChange={setQuery} placeholder="Buscar" />
        <SelectField label="Cliente" value={client} onChange={setClient} options={['Todos', ...clients]} />
        <SelectField label="Obrigacao" value="Todos" onChange={() => {}} options={['Todos', ...obligationNames]} />
        <TextField label="Periodo de vencimento" value="01/06/2026    30/06/2026" onChange={() => {}} />
        <button className="self-end rounded border border-[#16829b] px-5 py-2 text-[#16829b]">Filtrar</button>
      </div>
      <DataTable
        headings={['Documento', 'Cliente', 'Arquivo', 'Data', 'Responsavel pela baixa', 'Status', '']}
        rows={filtered.map((item) => [item.document, item.client, item.fileName, item.protocolDate, item.responsible, item.status, '⋮'])}
        statusIndex={5}
      />
    </section>
  );
}

function Reports({ tasks, protocols }) {
  const [section, setSection] = useState('Produtividade');
  const [filter, setFilter] = useState('Todos');
  const [month, setMonth] = useState(5);
  const filteredTasks = tasks.filter((task) => filter === 'Todos' || (filter === 'Concluidas' ? isDoneStatus(task.status) : !isDoneStatus(task.status)));

  return (
    <section className="grid grid-cols-[205px_1fr]">
      <SideSubMenu items={['Produtividade', 'Mapa de pendencias', 'Auditoria', 'Completa']} active={section} onChange={setSection} />
      <div className="p-5">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{section}</h2>
          <div className="text-lg"><button onClick={() => setMonth((m) => Math.max(0, m - 1))}>‹</button> <b>{monthLabels[month]}/2026</b> <button onClick={() => setMonth((m) => Math.min(11, m + 1))}>›</button></div>
          <div className="rounded-full bg-[#f4f4f4] p-1"><button className="rounded-full bg-[#eaf6ff] px-4 py-2 text-[#16829b]">Meta Interna</button><button className="rounded-full bg-white px-4 py-2">Vencimentos</button></div>
        </div>
        <div className="mb-8 flex gap-3 text-sm">
          {['Todos', 'Abertas', 'Concluidas'].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 ${filter === item ? 'border-[#16829b] bg-[#eaf6ff] text-[#16829b]' : 'border-[#ddd]'}`}>{item}</button>)}
        </div>
        {section === 'Produtividade' && <Productivity tasks={filteredTasks} />}
        {section === 'Mapa de pendencias' && <PendingMap tasks={filteredTasks} />}
        {section === 'Auditoria' && <Audit protocols={protocols} />}
        {section === 'Completa' && <CompleteReport tasks={filteredTasks} protocols={protocols} />}
      </div>
    </section>
  );
}

function Configurations({ obligationRows, setObligationRows, linkedClients, setLinkedClients, robots, setRobots }) {
  const [section, setSection] = useState('Lista de obrigacoes');
  const [editing, setEditing] = useState(null);
  const [linking, setLinking] = useState(null);
  const [linkResponsibles, setLinkResponsibles] = useState(() => ({
    '13o SALARIO 1a PARCELA::ANA CAROLINA CARPINE AGUIAR': 'Ana Carolina',
    '13o SALARIO 1a PARCELA::IVANI SEVERINA SOARES DE ALMEIDA': 'Ana Carolina',
    'ADIANTAMENTO SALARIAL (Vencimento dia 15)::ANA CAROLINA CARPINE AGUIAR': 'Ana Carolina',
  }));
  const [query, setQuery] = useState('');
  const filtered = obligationRows.filter((row) => row[0].toLowerCase().includes(query.toLowerCase()));

  function saveObligation(next) {
    setObligationRows((current) => {
      if (next.index === -1) return [[next.name, next.type, next.department, next.nickname, next.frequency, next.status, next.robot], ...current];
      return current.map((row, index) => index === next.index ? [next.name, next.type, next.department, next.nickname, next.frequency, next.status, next.robot] : row);
    });
    setEditing(null);
  }

  return (
    <section className="grid grid-cols-[245px_1fr]">
      <SideSubMenu items={['Lista de obrigacoes', 'Lista de robos', 'Grupo de obrigacoes', 'Vinculos', 'Responsabilidades']} active={section} onChange={setSection} />
      <div className="p-5">
        {section === 'Lista de obrigacoes' && (
          <>
            <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-semibold">Lista de obrigacoes</h2><button onClick={() => setEditing({ index: -1, row: ['Nova obrigacao', 'Pagamento', departments[0], 'NOVO', 'Mensal', 'Ativo', 'Nao'] })} className="rounded bg-[#2693d2] px-5 py-2.5 text-white">+ Nova obrigacao</button></div>
            <div className="mb-6 flex items-end gap-5"><TextField label="Buscar por" value={query} onChange={setQuery} placeholder="Buscar" /><label className="pb-2"><input type="checkbox" /> Exibir itens inativos</label><button className="pb-2 text-[#16829b]">⌁ Filtro avancado⌄</button></div>
            <DataTable headings={['Obrigacao', 'Tipo', 'Departamento', 'Apelido', 'Frequencia', 'Status', 'Robo padrao', '']} rows={filtered.map((row) => [...row, <ActionButtons key={row[0]} onEdit={() => setEditing({ index: obligationRows.indexOf(row), row })} onLink={() => setLinking(row)} onDelete={() => setObligationRows((current) => current.filter((item) => item !== row))} />])} />
          </>
        )}
        {section === 'Lista de robos' && <Robots robots={robots} setRobots={setRobots} obligationRows={obligationRows} />}
        {section === 'Grupo de obrigacoes' && <Groups obligationRows={obligationRows} linkedClients={linkedClients} setLinkedClients={setLinkedClients} setLinkResponsibles={setLinkResponsibles} />}
        {section === 'Vinculos' && <LinksMatrix obligationRows={obligationRows} linkedClients={linkedClients} setLinkedClients={setLinkedClients} linkResponsibles={linkResponsibles} setLinkResponsibles={setLinkResponsibles} />}
        {section === 'Responsabilidades' && <Responsibilities />}
      </div>
      {editing && <ObligationModal editing={editing} onClose={() => setEditing(null)} onSave={saveObligation} />}
      {linking && <LinkClientsModal obligation={linking} linkedClients={linkedClients} setLinkedClients={setLinkedClients} onClose={() => setLinking(null)} />}
    </section>
  );
}

function Legend({ label, color }) {
  return <span className="flex items-center gap-2"><i className={`h-3 w-3 rounded-full ${color}`} />{label}</span>;
}

function SideSubMenu({ items, active, onChange }) {
  return <aside className="min-h-[610px] border-r border-[#dfe5e8] bg-[#fbfbfb]">{items.map((item) => <button key={item} onClick={() => onChange(item)} className={`block w-full px-5 py-4 text-left text-sm ${active === item ? 'bg-[#e5f6fb] text-[#16829b]' : ''}`}>{item}</button>)}</aside>;
}

function DataTable({ headings, rows, statusIndex }) {
  return (
    <div className="overflow-hidden rounded border border-[#e7ecef]">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[#f3f3f3] text-[#4c5357]"><tr>{headings.map((head) => <th key={head} className="px-4 py-3 font-medium">{head}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#e7ecef]">{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">{cellIndex === 0 ? <b className="text-[#16829b]">{cell}</b> : cellIndex === statusIndex ? <span className="rounded border border-emerald-400 px-2 py-1 text-xs text-emerald-700">{cell}</span> : cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Productivity({ tasks }) {
  const done = tasks.filter((task) => isDoneStatus(task.status)).length;
  const open = tasks.length - done;
  return <div className="grid grid-cols-[260px_1fr] gap-10"><BigDonut open={open} done={done} /><div><h3 className="mb-5 text-xl font-semibold">Por departamento</h3><div className="grid grid-cols-2 gap-6">{departmentStats.map((stat) => <DepartmentCard key={stat.title} stat={stat} />)}</div></div></div>;
}

function PendingMap({ tasks }) {
  return <DataTable headings={['Cliente', 'Obrigacao', 'Departamento', 'Status']} rows={tasks.map((task) => [task.client, task.obligation, task.department, statusLabel(task.status)])} statusIndex={3} />;
}

function Audit({ protocols }) {
  return <DataTable headings={['Data', 'Arquivo', 'Cliente', 'Responsavel', 'Status']} rows={protocols.map((item) => [item.protocolDate, item.fileName, item.client, item.responsible, item.status])} statusIndex={4} />;
}

function CompleteReport({ tasks, protocols }) {
  return <div className="grid grid-cols-3 gap-4"><Stat label="Tarefas filtradas" value={tasks.length} /><Stat label="Protocolos" value={protocols.length} /><Stat label="Baixas concluidas" value={tasks.filter((task) => isDoneStatus(task.status)).length} /></div>;
}

function Stat({ label, value }) {
  return <div className="rounded border border-[#e7ecef] p-5"><p className="text-sm text-[#777]">{label}</p><b className="mt-2 block text-3xl text-[#16829b]">{value}</b></div>;
}

function BigDonut({ open, done }) {
  const total = Math.max(open + done, 1);
  const donePercent = Math.round((done / total) * 100);
  return <div><h3 className="mb-5 text-xl font-semibold">Escritorio</h3><div className="mx-auto h-48 w-48 rounded-full" style={{ background: `conic-gradient(#91d9a7 0 ${donePercent}%, #f8d66d ${donePercent}% 78%, #ef4444 78% 100%)` }}><div className="relative left-12 top-12 h-24 w-24 rounded-full bg-white" /></div><div className="mx-auto mt-6 w-44 space-y-2 text-sm"><b className="flex justify-between">EM ABERTO <span>{open}</span></b><Legend label="Vence hoje" color="bg-amber-300" /><Legend label="Fora do prazo" color="bg-red-500" /><b className="flex justify-between pt-3">CONCLUIDO <span>{done}</span></b><Legend label="Dentro do prazo" color="bg-emerald-300" /></div></div>;
}

function DepartmentCard({ stat }) {
  return <article className="rounded border border-[#e7ecef] p-4"><h4 className="mb-5 text-lg font-semibold text-[#16829b]">{stat.title}</h4><div className="grid grid-cols-[150px_1fr] gap-4"><div className="h-32 w-32 rounded-full" style={{ background: `conic-gradient(${stat.accent} 0 76%, #f2a5b1 76% 87%, #ef4444 87% 100%)` }}><div className="relative left-8 top-8 grid h-16 w-16 place-items-center rounded-full bg-white text-sm">{stat.percent}</div></div><div className="space-y-2 bg-[#f7f7f7] p-3 text-sm"><b className="flex justify-between">EM ABERTO <span>{stat.open}</span></b><Legend label="Vence hoje" color="bg-amber-300" /><Legend label="Fora do prazo" color="bg-red-500" /><b className="flex justify-between pt-3">CONCLUIDO <span>{stat.done}</span></b><Legend label="Fora do prazo" color="bg-rose-300" /></div></div></article>;
}

function ActionButtons({ onEdit, onLink, onDelete }) {
  return <div className="flex gap-3 text-[#16829b]"><button onClick={onEdit} title="Editar">✎</button><button onClick={onLink} title="Vincular tarefa">🔗</button><button onClick={onDelete} title="Excluir">🗑</button></div>;
}

function ObligationModal({ editing, onClose, onSave }) {
  const [name, setName] = useState(editing.row[0]);
  const [type, setType] = useState(editing.row[1]);
  const [department, setDepartment] = useState(editing.row[2]);
  const [nickname, setNickname] = useState(editing.row[3]);
  const [frequency, setFrequency] = useState(editing.row[4] || 'Mensal');
  const [status, setStatus] = useState(editing.row[5]);
  const [robot, setRobot] = useState(editing.row[6]);
  const [ruleMonth, setRuleMonth] = useState('10');
  const [dueDay, setDueDay] = useState('31');
  const [nonBusinessDayRule, setNonBusinessDayRule] = useState('Dias Corridos - Antecipa');
  const [saturdayIsBusinessDay, setSaturdayIsBusinessDay] = useState('Nao');
  const [competence, setCompetence] = useState('06/2026');
  const [simulationResult, setSimulationResult] = useState('');

  function simulateDueDate() {
    const result = calculateDueDate({
      competence,
      frequency,
      ruleMonth,
      dueDay,
      nonBusinessDayRule,
      saturdayIsBusinessDay,
    });
    setSimulationResult(result.error || `Vencimento simulado: ${result.date}`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute inset-x-8 top-6 max-h-[92vh] overflow-auto rounded bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e7ecef] p-4"><h2 className="text-2xl font-semibold">{name}</h2><button onClick={onClose} className="text-2xl text-[#aaa]">×</button></div>
        <div className="grid grid-cols-[1fr_240px] gap-9 p-4">
          <TextField label="Nome da obrigacao" value={name} onChange={setName} />
          <SelectField label="Tipo de obrigacao" value={type} onChange={setType} options={['Pagamento', 'Cadastral', 'Declaracao']} />
          <SelectField label="Departamento da obrigacao" value={department} onChange={setDepartment} options={departments} />
          <div className="grid grid-cols-2 gap-4"><TextField label="Apelido da obrigacao" value={nickname} onChange={setNickname} /><SelectField label="Status da obrigacao" value={status} onChange={setStatus} options={['Ativo', 'Inativo']} /></div>
          <label className="rounded border border-[#e7ecef] p-3"><input type="checkbox" /> Entrega somente fisica</label>
          <label className="rounded border border-[#e7ecef] p-3"><input type="checkbox" defaultChecked /> Controle de vencimento</label>
        </div>
        <div className="border-t border-[#e7ecef] p-4">
          <h3 className="mb-5 text-lg">Cadastro de Regras de Vencimento</h3>
          <div className="grid grid-cols-5 gap-8">
            <SelectField label="Frequencia" value={frequency} onChange={setFrequency} options={['Mensal', 'Anual', 'Trimestral']} />
            <TextField label="Meses" value={ruleMonth} onChange={setRuleMonth} />
            <TextField label="Dia do vencimento" value={dueDay} onChange={setDueDay} />
            <SelectField label="Data nao util" value={nonBusinessDayRule} onChange={setNonBusinessDayRule} options={['Dias Corridos - Antecipa', 'Dias Uteis - Posterga']} />
            <SelectField label="Sabado e dia util?" value={saturdayIsBusinessDay} onChange={setSaturdayIsBusinessDay} options={['Nao', 'Sim']} />
          </div>
        </div>
        <div className="bg-[#f3f3f3] p-4">
          <h3 className="mb-5 text-lg">Simular vencimento</h3>
          <div className="flex items-end gap-8"><TextField label="Competencia" value={competence} onChange={setCompetence} placeholder="mm/aaaa ou aaaa" /><button onClick={simulateDueDate} className="rounded border border-[#16829b] px-5 py-2 text-[#16829b]">Simular vencimento</button><span>{simulationResult}</span></div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e7ecef] p-4"><button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button><button onClick={onClose} className="rounded border border-[#16829b] px-5 py-2 text-[#16829b]">Excluir</button><button onClick={() => onSave({ index: editing.index, name, type, department, nickname, frequency, status, robot })} className="rounded bg-[#2693d2] px-5 py-2 text-white">Salvar</button></div>
      </div>
    </div>
  );
}

function LinkClientsModal({ obligation, linkedClients, setLinkedClients, onClose }) {
  const obligationName = obligation[0];
  const selected = linkedClients[obligationName] || [];

  function toggleClient(client) {
    setLinkedClients((current) => {
      const currentClients = current[obligationName] || [];
      const nextClients = currentClients.includes(client)
        ? currentClients.filter((item) => item !== client)
        : [...currentClients, client];
      return { ...current, [obligationName]: nextClients };
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute left-1/2 top-10 w-[760px] -translate-x-1/2 rounded bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e7ecef] p-5">
          <div>
            <h2 className="text-2xl font-semibold">Vincular tarefa</h2>
            <p className="mt-1 text-sm text-[#68737a]">{obligationName}</p>
          </div>
          <button onClick={onClose} className="text-2xl text-[#aaa]">×</button>
        </div>
        <div className="p-5">
          <div className="mb-4 grid grid-cols-[1fr_180px] gap-4">
            <TextField label="Buscar cliente" value="" onChange={() => {}} placeholder="Nome, codigo, CPF/CNPJ" />
            <div className="rounded border border-[#dfe5e8] p-3 text-sm">
              <b>{selected.length}</b> cliente(s) vinculado(s)
            </div>
          </div>
          <div className="overflow-hidden rounded border border-[#e7ecef]">
            {clients.map((client) => (
              <label key={client} className="flex cursor-pointer items-center justify-between border-b border-[#e7ecef] px-4 py-3 last:border-b-0">
                <span>{client}</span>
                <input type="checkbox" checked={selected.includes(client)} onChange={() => toggleClient(client)} />
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e7ecef] p-4">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={onClose} className="rounded bg-[#2693d2] px-5 py-2 text-white">Salvar vinculos</button>
        </div>
      </div>
    </div>
  );
}

function calculateDueDate({ competence, frequency, ruleMonth, dueDay, nonBusinessDayRule, saturdayIsBusinessDay }) {
  const clean = competence.trim();
  const match = clean.match(/^(\d{1,2})\/(\d{4})$/) || clean.match(/^(\d{4})$/);
  if (!match) return { error: 'Informe a competencia como mm/aaaa ou aaaa.' };

  const competenceMonth = match[2] ? Number(match[1]) - 1 : 0;
  const competenceYear = Number(match[2] || match[1]);
  const monthNumber = Math.min(Math.max(Number(ruleMonth || competenceMonth + 1), 1), 12) - 1;
  const dayNumber = Math.min(Math.max(Number(dueDay || 1), 1), 31);
  const targetMonth = frequency === 'Mensal' ? competenceMonth : monthNumber;
  const targetYear = frequency === 'Mensal' && targetMonth < competenceMonth ? competenceYear + 1 : competenceYear;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const date = new Date(targetYear, targetMonth, Math.min(dayNumber, lastDay));

  const saturdayWorks = saturdayIsBusinessDay === 'Sim';
  while (isNonBusinessDay(date, saturdayWorks)) {
    date.setDate(date.getDate() + (nonBusinessDayRule.includes('Antecipa') ? -1 : 1));
  }

  return { date: date.toLocaleDateString('pt-BR') };
}

function isNonBusinessDay(date, saturdayWorks) {
  const day = date.getDay();
  return day === 0 || (!saturdayWorks && day === 6);
}

function Robots({ robots, setRobots, obligationRows }) {
  const [query, setQuery] = useState('');
  const [editingRobot, setEditingRobot] = useState(null);
  const filtered = robots.filter((robot) => `${robot.obligation} ${robot.identifiers.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  function saveRobot(robot) {
    setRobots((current) => {
      if (!robot.id) return [{ ...robot, id: `robot-${Date.now()}` }, ...current];
      return current.map((item) => item.id === robot.id ? robot : item);
    });
    setEditingRobot(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Lista de robos</h2>
        <button onClick={() => setEditingRobot({ id: null, obligation: obligationRows[0][0], identifiers: [] })} className="rounded bg-[#2693d2] px-4 py-2 text-white">+ Novo robo</button>
      </div>
      <TextField label="" value={query} onChange={setQuery} placeholder="Buscar por obrigacao ou identificador..." />
      <div className="mt-5 space-y-4">
        {filtered.map((robot) => (
          <div key={robot.id} className="rounded border border-[#e7ecef]">
            <div className="flex items-center justify-between p-3">
              <h3 className="font-semibold">{robot.obligation}</h3>
              <div className="flex gap-3 text-[#16829b]">
                <button onClick={() => setEditingRobot(robot)}>✎</button>
                <button onClick={() => setRobots((current) => current.filter((item) => item.id !== robot.id))}>🗑</button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_180px_180px] bg-[#f1f1f1] p-3 text-sm"><span>Identificadores de PDF</span><span>Criado em</span><span>Atualizado em</span></div>
            <div className="grid grid-cols-[1fr_180px_180px] p-3 text-sm">
              <span>{robot.identifiers.join(', ') || '-'}</span>
              <span>18/06/2026 as 09:00</span>
              <span>-</span>
            </div>
          </div>
        ))}
      </div>
      {editingRobot && <RobotModal robot={editingRobot} obligationRows={obligationRows} onClose={() => setEditingRobot(null)} onSave={saveRobot} />}
    </div>
  );
}

function RobotModal({ robot, obligationRows, onClose, onSave }) {
  const [obligation, setObligation] = useState(robot.obligation);
  const [identifiers, setIdentifiers] = useState(robot.identifiers || []);
  const [newIdentifier, setNewIdentifier] = useState('');

  function addIdentifier() {
    const value = newIdentifier.trim();
    if (!value) return;
    setIdentifiers((current) => Array.from(new Set([...current, value])));
    setNewIdentifier('');
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="absolute left-1/2 top-8 grid h-[82vh] w-[1180px] -translate-x-1/2 grid-cols-[1fr_420px] overflow-hidden rounded bg-white shadow-xl">
        <div className="bg-[#444] p-8">
          <div className="mx-auto h-full max-w-[420px] bg-white p-8 text-[#12356d]">
            <div className="mb-6 text-xl font-bold">Receita Federal</div>
            <h3 className="text-center text-lg font-bold">Documento de Arrecadacao<br />de Receitas Federais</h3>
            <div className="mt-8 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded border p-2">CNPJ<br />11.111.111/1111-11</div>
              <div className="rounded border p-2">Periodo<br />30/06/2026</div>
              <div className="rounded border p-2">Vencimento<br />20/07/2026</div>
            </div>
            <div className="mt-8 h-48 rounded border p-4 text-xs">Composicao do Documento de Arrecadacao<br /><br />Codigo 0561<br />Codigo 0588<br />Codigo 1082</div>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-8 flex justify-end"><button onClick={onClose} className="text-2xl text-[#aaa]">×</button></div>
          <div className="text-center"><div className="text-6xl">🤖</div><h2 className="mt-4 text-xl font-semibold">Robo de leitura de PDFs</h2><p className="mt-2 text-sm text-[#68737a]">Configure os identificadores que associam um PDF a uma obrigacao.</p></div>
          <div className="mt-8 space-y-4">
            <SelectField label="Nome da obrigacao" value={obligation} onChange={setObligation} options={obligationRows.map((row) => row[0])} />
            <div>
              <label className="mb-1 block text-sm">Identificador do PDF</label>
              <div className="flex gap-2"><input value={newIdentifier} onChange={(event) => setNewIdentifier(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addIdentifier()} placeholder="Ex.: 0561, DARF, Simples Nacional" className="h-10 flex-1 rounded border border-[#dfe5e8] px-3" /><button onClick={addIdentifier} className="rounded bg-[#f2f2f2] px-4">Adicionar</button></div>
            </div>
            <div className="max-h-56 space-y-2 overflow-auto">
              {identifiers.map((identifier) => <div key={identifier} className="flex items-center justify-between rounded bg-[#f1f1f1] px-4 py-2"><span>{identifier}</span><button onClick={() => setIdentifiers((current) => current.filter((item) => item !== identifier))} className="text-[#16829b]">🗑</button></div>)}
            </div>
          </div>
          <button onClick={() => onSave({ id: robot.id, obligation, identifiers })} className="mt-6 w-full rounded bg-[#2693d2] px-5 py-3 text-white">Salvar configuracoes</button>
        </div>
      </div>
    </div>
  );
}

function Groups({ obligationRows, linkedClients, setLinkedClients, setLinkResponsibles }) {
  const [groups, setGroups] = useState(() => [
    { id: 'FPD', nickname: 'FPD', name: 'Folha de Pagamento - Domestica', obligations: obligationRows.slice(0, 3).map((row) => row[0]) },
    { id: 'FPM', nickname: 'FPM', name: 'Folha de Pagamento MEI', obligations: obligationRows.slice(0, 6).map((row) => row[0]) },
    { id: 'FPP', nickname: 'FPP', name: 'Folha de Pagamento Padrao', obligations: obligationRows.slice(0, 7).map((row) => row[0]) },
    { id: 'LPS', nickname: 'LPS', name: 'Lucro Presumido Servicos', obligations: obligationRows.slice(2, 6).map((row) => row[0]) },
    { id: 'SNC', nickname: 'SNC', name: 'Simples Nacional Comercio', obligations: obligationRows.slice(1, 5).map((row) => row[0]) },
  ]);
  const [query, setQuery] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [linkingGroup, setLinkingGroup] = useState(null);
  const filtered = groups.filter((group) => `${group.nickname} ${group.name}`.toLowerCase().includes(query.toLowerCase()));

  function saveGroup(nextGroup) {
    setGroups((current) => {
      if (!nextGroup.id) return [{ ...nextGroup, id: `grp-${Date.now()}` }, ...current];
      return current.map((group) => group.id === nextGroup.id ? nextGroup : group);
    });
    setEditingGroup(null);
  }

  function deleteGroup(groupId) {
    setGroups((current) => current.filter((group) => group.id !== groupId));
  }

  return (
    <div>
      <div className="mb-7 flex justify-between">
        <h2 className="text-2xl font-semibold">Grupo de obrigacoes</h2>
        <div className="flex gap-2">
          <button onClick={() => setLinkingGroup(groups[0])} className="rounded bg-[#f2f2f2] px-4 py-2">Vincular por grupo</button>
          <button onClick={() => setEditingGroup({ id: null, nickname: '', name: '', obligations: [] })} className="rounded bg-[#2693d2] px-4 py-2 text-white">+ Novo grupo</button>
        </div>
      </div>
      <TextField label="" value={query} onChange={setQuery} placeholder="Buscar por apelido ou grupo..." />
      <div className="mt-5 overflow-hidden rounded border border-[#e7ecef]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3f3f3]"><tr><th className="px-4 py-3">Apelido</th><th className="px-4 py-3">Grupo de obrigacoes</th><th className="px-4 py-3">Qtd de obrigacoes</th><th className="px-4 py-3"></th></tr></thead>
          <tbody>
            {filtered.map((group) => (
              <tr key={group.id} className="border-t border-[#e7ecef]">
                <td className="px-4 py-3 font-semibold text-[#16829b]">{group.nickname}</td>
                <td className="px-4 py-3">{group.name}</td>
                <td className="px-4 py-3">{group.obligations.length}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-4 text-[#16829b]">
                    <button onClick={() => setLinkingGroup(group)} title="Vincular grupo">□</button>
                    <button onClick={() => setEditingGroup(group)} title="Editar grupo">✎</button>
                    <button onClick={() => deleteGroup(group.id)} title="Excluir grupo">🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingGroup && <GroupEditorModal group={editingGroup} obligationRows={obligationRows} onClose={() => setEditingGroup(null)} onSave={saveGroup} />}
      {linkingGroup && <GroupLinkModal group={linkingGroup} groups={groups} setGroup={setLinkingGroup} linkedClients={linkedClients} setLinkedClients={setLinkedClients} setLinkResponsibles={setLinkResponsibles} onClose={() => setLinkingGroup(null)} />}
    </div>
  );
}

function GroupEditorModal({ group, obligationRows, onClose, onSave }) {
  const [nickname, setNickname] = useState(group.nickname);
  const [name, setName] = useState(group.name);
  const [selectedObligations, setSelectedObligations] = useState(group.obligations || []);

  function toggleObligation(obligationName) {
    setSelectedObligations((current) => current.includes(obligationName)
      ? current.filter((item) => item !== obligationName)
      : [...current, obligationName]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute left-1/2 top-8 w-[860px] -translate-x-1/2 rounded bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e7ecef] p-5">
          <h2 className="text-2xl font-semibold">{group.id ? 'Editar grupo' : 'Novo grupo'}</h2>
          <button onClick={onClose} className="text-2xl text-[#aaa]">×</button>
        </div>
        <div className="grid grid-cols-2 gap-5 p-5">
          <TextField label="Apelido" value={nickname} onChange={setNickname} placeholder="Ex.: FPD" />
          <TextField label="Nome do grupo" value={name} onChange={setName} placeholder="Ex.: Folha de Pagamento" />
        </div>
        <div className="px-5 pb-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Obrigacoes do grupo</h3>
            <span className="text-sm text-[#68737a]">{selectedObligations.length} selecionada(s)</span>
          </div>
          <div className="max-h-80 overflow-auto rounded border border-[#e7ecef]">
            {obligationRows.map((row) => (
              <label key={row[0]} className="grid cursor-pointer grid-cols-[32px_1fr_160px_140px] border-b border-[#e7ecef] px-4 py-3 text-sm last:border-b-0">
                <input type="checkbox" checked={selectedObligations.includes(row[0])} onChange={() => toggleObligation(row[0])} />
                <span className="font-semibold text-[#16829b]">{row[0]}</span>
                <span>{row[2]}</span>
                <span>{row[4]}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e7ecef] p-4">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={() => onSave({ id: group.id, nickname: nickname || 'NOVO', name: name || 'Novo grupo', obligations: selectedObligations })} className="rounded bg-[#2693d2] px-5 py-2 text-white">Salvar grupo</button>
        </div>
      </div>
    </div>
  );
}

function GroupLinkModal({ group, groups, setGroup, linkedClients, setLinkedClients, setLinkResponsibles, onClose }) {
  const [selectedClients, setSelectedClients] = useState(() => clients.filter((client) => group.obligations.some((obligation) => (linkedClients[obligation] || []).includes(client))));
  const [selectedGroupId, setSelectedGroupId] = useState(group.id);
  const activeGroup = groups.find((item) => item.id === selectedGroupId) || group;

  function toggleClient(client) {
    setSelectedClients((current) => current.includes(client) ? current.filter((item) => item !== client) : [...current, client]);
  }

  function applyGroupLink() {
    setLinkedClients((current) => {
      const next = { ...current };
      activeGroup.obligations.forEach((obligation) => {
        const existing = next[obligation] || [];
        next[obligation] = Array.from(new Set([...existing, ...selectedClients]));
      });
      return next;
    });
    setLinkResponsibles((current) => {
      const next = { ...current };
      activeGroup.obligations.forEach((obligation) => {
        selectedClients.forEach((client) => {
          next[`${obligation}::${client}`] = next[`${obligation}::${client}`] || 'Ana Carolina';
        });
      });
      return next;
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute left-1/2 top-8 w-[860px] -translate-x-1/2 rounded bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e7ecef] p-5">
          <div>
            <h2 className="text-2xl font-semibold">Vincular por grupo</h2>
            <p className="mt-1 text-sm text-[#68737a]">Aplique varias obrigacoes aos mesmos clientes de uma vez.</p>
          </div>
          <button onClick={onClose} className="text-2xl text-[#aaa]">×</button>
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-6 p-5">
          <div>
            <SelectField label="Grupo de obrigacoes" value={selectedGroupId} onChange={(id) => { setSelectedGroupId(id); setGroup(groups.find((item) => item.id === id)); }} options={groups.map((item) => item.id)} />
            <div className="mt-4 rounded border border-[#e7ecef]">
              <div className="bg-[#f3f3f3] px-4 py-3 font-semibold">{activeGroup.name}</div>
              <div className="max-h-72 overflow-auto">
                {activeGroup.obligations.map((obligation) => (
                  <div key={obligation} className="border-t border-[#e7ecef] px-4 py-3 text-sm text-[#16829b]">{obligation}</div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Clientes</h3>
              <span className="text-sm text-[#68737a]">{selectedClients.length} selecionado(s)</span>
            </div>
            <div className="overflow-hidden rounded border border-[#e7ecef]">
              {clients.map((client) => (
                <label key={client} className="flex cursor-pointer items-center justify-between border-b border-[#e7ecef] px-4 py-3 last:border-b-0">
                  <span>{client}</span>
                  <input type="checkbox" checked={selectedClients.includes(client)} onChange={() => toggleClient(client)} />
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e7ecef] p-4">
          <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
          <button onClick={applyGroupLink} className="rounded bg-[#2693d2] px-5 py-2 text-white">Vincular grupo</button>
        </div>
      </div>
    </div>
  );
}

function LinksMatrix({ obligationRows, linkedClients, setLinkedClients, linkResponsibles, setLinkResponsibles }) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('Todos');
  const [cell, setCell] = useState(null);
  const visibleClients = clients.filter((client) => client.toLowerCase().includes(query.toLowerCase()));
  const visibleObligations = obligationRows
    .filter((row) => department === 'Todos' || row[2] === department)
    .slice(0, 12);

  function isLinked(obligation, client) {
    return (linkedClients[obligation] || []).includes(client);
  }

  function responsibleInitials(obligation, client) {
    return getInitials(linkResponsibles[`${obligation}::${client}`] || 'Ana Carolina');
  }

  return (
    <div>
      <div className="mb-7 flex justify-between">
        <h2 className="text-2xl font-semibold">Vincular</h2>
        <div className="flex gap-2">
          <button className="rounded bg-[#f2f2f2] px-4 py-2">Atualizar inicio de controle</button>
          <button className="rounded bg-[#f2f2f2] px-4 py-2">Vincular por grupo</button>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-5 gap-4">
        <TextField label="Buscar por" value={query} onChange={setQuery} placeholder="Nome, codigo, CPF/CNPJ" />
        <SelectField label="Departamento" value={department} onChange={setDepartment} options={['Todos', ...departments]} />
        <SelectField label="Regime tributario" value="Todos" onChange={() => {}} options={['Todos', 'Simples Nacional', 'Lucro Real']} />
        <SelectField label="Ramo de atividade" value="Todos" onChange={() => {}} options={['Todos', 'Comercio', 'Servico']} />
        <button className="self-end rounded border border-[#16829b] px-5 py-2 text-[#16829b]">Filtrar</button>
      </div>
      <div className="mb-3 text-sm text-[#68737a]">Clique em um quadradinho para atribuir, alterar responsavel ou remover a tarefa daquele cliente.</div>
      <div className="overflow-auto rounded border border-[#e7ecef]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-80 bg-[#eee] p-3 text-left">Cliente</th>
              {visibleObligations.map((row) => <th key={row[0]} className="min-w-20 bg-[#eee] p-3 [writing-mode:vertical-rl]">{row[3] || row[0]}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleClients.map((client) => (
              <tr key={client} className="border-t">
                <td className="sticky left-0 bg-white p-3 font-semibold">{client}</td>
                {visibleObligations.map((row) => {
                  const obligation = row[0];
                  const linked = isLinked(obligation, client);
                  return (
                    <td key={obligation} className="p-0 text-center">
                      <button
                        onClick={() => setCell({ obligation, client })}
                        className={`h-14 w-full border-l border-[#e7ecef] ${linked ? 'bg-emerald-50 text-[#2f3a42]' : 'bg-[#f8f8f8] text-[#b8c0c5] hover:bg-[#eef7fb]'}`}
                        title={`${linked ? 'Alterar' : 'Atribuir'} ${obligation} para ${client}`}
                      >
                        {linked ? responsibleInitials(obligation, client) : '+'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cell && <LinkCellModal cell={cell} linkedClients={linkedClients} setLinkedClients={setLinkedClients} linkResponsibles={linkResponsibles} setLinkResponsibles={setLinkResponsibles} onClose={() => setCell(null)} />}
    </div>
  );
}

function LinkCellModal({ cell, linkedClients, setLinkedClients, linkResponsibles, setLinkResponsibles, onClose }) {
  const responsibles = ['Ana Carolina', 'Mariana Fiscal', 'Carlos Contabil', 'Beatriz Registro'];
  const linked = (linkedClients[cell.obligation] || []).includes(cell.client);
  const [responsible, setResponsible] = useState(linkResponsibles[`${cell.obligation}::${cell.client}`] || responsibles[0]);

  function saveLink() {
    setLinkedClients((current) => {
      const currentClients = current[cell.obligation] || [];
      return currentClients.includes(cell.client)
        ? current
        : { ...current, [cell.obligation]: [...currentClients, cell.client] };
    });
    setLinkResponsibles((current) => ({ ...current, [`${cell.obligation}::${cell.client}`]: responsible }));
    onClose();
  }

  function removeLink() {
    setLinkedClients((current) => ({
      ...current,
      [cell.obligation]: (current[cell.obligation] || []).filter((client) => client !== cell.client),
    }));
    setLinkResponsibles((current) => {
      const next = { ...current };
      delete next[`${cell.obligation}::${cell.client}`];
      return next;
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="absolute left-1/2 top-16 w-[620px] -translate-x-1/2 rounded bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e7ecef] p-5">
          <h2 className="text-2xl font-semibold">{linked ? 'Alterar vinculo' : 'Atribuir tarefa'}</h2>
          <button onClick={onClose} className="text-2xl text-[#aaa]">×</button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded bg-[#f7f9fa] p-4">
            <p className="text-sm text-[#68737a]">Cliente</p>
            <p className="font-semibold">{cell.client}</p>
            <p className="mt-3 text-sm text-[#68737a]">Obrigacao</p>
            <p className="font-semibold text-[#16829b]">{cell.obligation}</p>
          </div>
          <SelectField label="Responsavel pela tarefa" value={responsible} onChange={setResponsible} options={responsibles} />
          <p className="text-sm text-[#68737a]">A sigla exibida no quadradinho sera <b>{getInitials(responsible)}</b>.</p>
        </div>
        <div className="flex justify-between border-t border-[#e7ecef] p-4">
          <button onClick={removeLink} disabled={!linked} className={`rounded border px-5 py-2 ${linked ? 'border-red-300 text-red-600' : 'cursor-not-allowed border-[#ddd] text-[#aaa]'}`}>Desvincular</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[#16829b]">Cancelar</button>
            <button onClick={saveLink} className="rounded bg-[#2693d2] px-5 py-2 text-white">{linked ? 'Salvar responsavel' : 'Atribuir tarefa'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function Responsibilities() {
  const [mode, setMode] = useState('departamento');
  return <div><div className="mb-8 bg-yellow-50 p-4">Para realizar a transferencia do responsavel padrao, <button className="text-[#16829b]">acesse a nova tela de responsabilidade</button></div><h2 className="mb-6 text-2xl font-semibold">Responsabilidades</h2><div className="space-y-4"><label><input type="radio" checked={mode === 'departamento'} onChange={() => setMode('departamento')} /> Transferir responsavel do vinculo por departamento</label><br /><label><input type="radio" checked={mode === 'obrigacao'} onChange={() => setMode('obrigacao')} /> Transferir responsavel do vinculo por obrigacao</label><div className="mt-6 max-w-md"><SelectField label={mode === 'departamento' ? 'Departamento' : 'Obrigacao'} value={mode === 'departamento' ? departments[0] : obligationNames[0]} onChange={() => {}} options={mode === 'departamento' ? departments : obligationNames} /></div></div></div>;
}

function buildMonth(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, current: date.getMonth() === month, key: date.toISOString() };
  });
}

function summarizeStatuses(tasks, date, today) {
  return Object.entries(tasks.reduce((acc, task) => {
    const status = statusForDate(task, date, today);
    return { ...acc, [status]: (acc[status] || 0) + 1 };
  }, {})).map(([color, value]) => ({ color, value }));
}

function isDoneStatus(status) {
  return status === 'doneOnTime' || status === 'doneLate';
}

function statusForDate(task, date, today) {
  if (isDoneStatus(task.status)) return task.status;
  const dueDate = startOfDay(date);
  if (dueDate < today) return 'overdue';
  if (dueDate.getTime() === today.getTime()) return 'dueToday';
  return 'openOnTime';
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameMonth(date, today) {
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function statusLabel(status) {
  const labels = {
    doneOnTime: 'Concluida no prazo',
    dueToday: 'Vence hoje',
    openOnTime: 'Dentro do prazo',
    overdue: 'Atrasada',
    doneLate: 'Concluida em atraso',
  };
  return labels[status] || status;
}

function groupTasks(tasks, by) {
  return tasks.reduce((acc, task) => {
    const key = by === 'cliente' ? task.client : task.obligation;
    return { ...acc, [key]: [...(acc[key] || []), task] };
  }, {});
}

export default function Obligations() {
  const [activeTab, setActiveTab] = useState('Calendario');
  const [tasks, setTasks] = useState(makeTasks);
  const [protocols, setProtocols] = useState(seedProtocols.map(protocolFromSeed));
  const [robots, setRobots] = useState(makeRobots);
  const [obligationRows, setObligationRows] = useState(seedObligations);
  const [linkedClients, setLinkedClients] = useState(() => ({
    '13o SALARIO 1a PARCELA': [clients[0], clients[1]],
    'ADIANTAMENTO SALARIAL (Vencimento dia 15)': [clients[0]],
  }));
  const content = {
    Calendario: <Calendar tasks={tasks} setTasks={setTasks} />,
    Conferencia: <Conference protocols={protocols} setProtocols={setProtocols} robots={robots} />,
    Protocolos: <Protocols protocols={protocols} setProtocols={setProtocols} />,
    Relatorios: <Reports tasks={tasks} protocols={protocols} />,
    Configuracoes: <Configurations obligationRows={obligationRows} setObligationRows={setObligationRows} linkedClients={linkedClients} setLinkedClients={setLinkedClients} robots={robots} setRobots={setRobots} />,
  };

  return (
    <AppShell activeTab={activeTab} setActiveTab={setActiveTab}>
      {content[activeTab]}
    </AppShell>
  );
}
