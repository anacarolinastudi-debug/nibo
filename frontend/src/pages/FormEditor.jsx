import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlignLeft, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, CircleDot,
  ClipboardCheck, ClipboardList, Image, Link2, ListChecks, ListFilter, MessageCircle, Pencil,
  Plus, Redo2, Settings, ShieldCheck, Star, Trash2, Type, Undo2, Users, X,
} from 'lucide-react';
import { getForm, updateForm } from '../api/forms';
import NiboRail from '../components/NiboRail';
import SideMenuSection from '../components/SideMenuSection';

const PALETTE = [
  { type: 'TEXTO_CURTO', icon: Type, label: 'Texto curto' },
  { type: 'TEXTO_LONGO', icon: AlignLeft, label: 'Texto longo' },
  { type: 'SIM_NAO', icon: CheckSquare, label: 'Sim ou não' },
  { type: 'MULTIPLA_ESCOLHA', icon: CircleDot, label: 'Múltipla escolha' },
  { type: 'DROPDOWN', icon: ListFilter, label: 'Lista suspensa' },
  { type: 'DATA', icon: CalendarDays, label: 'Data' },
  { type: 'UPLOAD', icon: Image, label: 'Upload de arquivo' },
  { type: 'AVALIACAO', icon: Star, label: 'Avaliação' },
  { type: 'LOGICA', icon: Link2, label: 'Lógica condicional' },
  { type: 'VALIDACAO', icon: ShieldCheck, label: 'Validação' },
];

const RIGHT_SECTIONS = ['Navegação', 'Pergunta', 'Páginas', 'Lógica', 'Data', 'Validação', 'Questionário Completo', 'Cronômetro/Quiz'];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blockDefaults(type) {
  switch (type) {
    case 'MULTIPLA_ESCOLHA':
    case 'DROPDOWN':
      return { options: ['Opção 1', 'Opção 2'] };
    case 'SIM_NAO':
      return { options: ['Não', 'Sim'] };
    default:
      return {};
  }
}

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
        <Link to="/radar-ecac" className="mb-4 flex items-center gap-2 text-[#68737a]">Radar e-CAC <b className="rounded bg-emerald-400 px-1.5 py-0.5 text-[10px] text-white">NOVO</b></Link>
        <p className="mb-4 border-t pt-4 text-xs font-semibold text-[#7b858c]">CADASTROS</p>
        <SideMenuSection icon={Users} label="Clientes" to="/clientes" open={openSection === 'clientes'} onToggle={() => toggleSection('clientes')}>
          {['Meus clientes', 'Contatos'].map((item) => (
            <Link key={item} to="/clientes" className="block rounded px-3 py-2 text-[#68737a] hover:bg-white">{item}</Link>
          ))}
        </SideMenuSection>
        <Link to="/formularios" className="mb-4 flex items-center gap-2 font-semibold"><ClipboardList size={16} /> Formulários</Link>
        <Link to="/configuracoes" className="flex items-center gap-2 text-[#68737a]"><Settings size={16} /> Configurações</Link>
      </nav>
    </aside>
  );
}

export default function FormEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [view, setView] = useState('Estrutura');
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [rightSection, setRightSection] = useState('Pergunta');
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    getForm(id).then((data) => setForm(data));
  }, [id]);

  if (!form) return <div className="ml-[282px] p-10 text-[#78838a]">Carregando…</div>;

  const pages = form.pages || [];
  const activePage = pages[activePageIndex];
  const selectedBlock = activePage?.blocks.find((b) => b.id === selectedBlockId) || null;

  function pushHistory(nextForm) {
    setHistory((h) => [...h, form]);
    setFuture([]);
    setForm(nextForm);
  }

  function updatePages(nextPages) {
    pushHistory({ ...form, pages: nextPages });
  }

  function undo() {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((f) => [form, ...f]);
    setHistory((h) => h.slice(0, -1));
    setForm(previous);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, form]);
    setFuture((f) => f.slice(1));
    setForm(next);
  }

  function addBlock(type) {
    const block = { id: uid(), type, title: '', description: '', required: false, ...blockDefaults(type) };
    const nextPages = pages.map((page, idx) => (idx === activePageIndex ? { ...page, blocks: [...page.blocks, block] } : page));
    updatePages(nextPages);
    setSelectedBlockId(block.id);
    setRightSection('Pergunta');
  }

  function updateBlock(blockId, patch) {
    const nextPages = pages.map((page, idx) => {
      if (idx !== activePageIndex) return page;
      return { ...page, blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) };
    });
    updatePages(nextPages);
  }

  function removeBlock(blockId) {
    const nextPages = pages.map((page, idx) => (idx === activePageIndex ? { ...page, blocks: page.blocks.filter((b) => b.id !== blockId) } : page));
    updatePages(nextPages);
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }

  function addPage() {
    const newPage = { id: uid(), title: `Página ${pages.length + 1}`, blocks: [] };
    updatePages([...pages, newPage]);
    setActivePageIndex(pages.length);
  }

  function updatePageTitle(pageId, title) {
    updatePages(pages.map((p) => (p.id === pageId ? { ...p, title } : p)));
  }

  function updateOption(blockId, optionIndex, value) {
    const block = activePage.blocks.find((b) => b.id === blockId);
    const options = block.options.map((opt, idx) => (idx === optionIndex ? value : opt));
    updateBlock(blockId, { options });
  }

  function addOption(blockId) {
    const block = activePage.blocks.find((b) => b.id === blockId);
    updateBlock(blockId, { options: [...block.options, `Opção ${block.options.length + 1}`] });
  }

  function removeOption(blockId, optionIndex) {
    const block = activePage.blocks.find((b) => b.id === blockId);
    updateBlock(blockId, { options: block.options.filter((_, idx) => idx !== optionIndex) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateForm(form.id, { pages: form.pages, settings: form.settings, name: form.name, description: form.description, department: form.department });
      setForm(updated);
    } finally {
      setSaving(false);
    }
  }

  const allBlocksFlat = pages.flatMap((p) => p.blocks);

  return (
    <div className="nibo-ui min-h-screen bg-white text-[#3f4548]">
      <NiboRail />
      <FormsMenu />
      <main className="ml-[282px] min-h-screen pb-24">
        <header className="flex h-[58px] items-center justify-between border-b border-[#dfe5e8] px-5">
          <div className="text-base text-[#60666b]">52.107.544 ANA CAROLINA CARPINE AGUIAR</div>
        </header>
        <section className="px-6 py-5">
          <p className="mb-1 text-sm text-[#78838a]">
            <Link to="/formularios" className="text-[#16829b]">Formulários</Link>
          </p>
          <div className="mb-3 flex items-start justify-between">
            <h1 className="text-2xl font-semibold">{form.name}</h1>
            <button title="Editar dados do formulário" className="text-[#68737a]"><Pencil size={18} /></button>
          </div>
          <div className="mb-5 flex items-center gap-10 text-sm">
            <div>
              <p className="text-[#78838a]">Descrição</p>
              <p>{form.description || '-'}</p>
            </div>
            <div>
              <p className="text-[#78838a]">Departamento</p>
              <p>{form.department || '-'}</p>
            </div>
            <div>
              <p className="text-[#78838a]">Status</p>
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${form.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}>{form.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</span>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between border-b border-[#dfe5e8]">
            <div className="flex gap-8 text-sm">
              {['Estrutura', 'Visualização'].map((tab) => (
                <button key={tab} onClick={() => setView(tab)} className={`h-10 border-b-2 px-1 ${view === tab ? 'border-[#003f82] font-semibold text-[#202427]' : 'border-transparent text-[#666]'}`}>{tab}</button>
              ))}
            </div>
            {view === 'Estrutura' && (
              <div className="flex items-center gap-3 pb-2 text-[#9aa5ad]">
                <button title="Desfazer" onClick={undo} disabled={history.length === 0} className="disabled:opacity-30"><Undo2 size={18} /></button>
                <button title="Refazer" onClick={redo} disabled={future.length === 0} className="disabled:opacity-30"><Redo2 size={18} /></button>
              </div>
            )}
          </div>

          {view === 'Estrutura' ? (
            <div className="flex gap-4">
              <aside className="flex w-12 flex-col items-center gap-1 rounded border border-[#dfe5e8] py-3">
                {PALETTE.map(({ type, icon: Icon, label }) => (
                  <button key={type} title={label} onClick={() => addBlock(type)} className="grid h-9 w-9 place-items-center rounded text-[#68737a] hover:bg-[#eef2f6]">
                    <Icon size={18} />
                  </button>
                ))}
              </aside>

              <div className="flex-1 rounded border border-[#dfe5e8] bg-[#f7f9fa] p-6">
                <div className="mb-4 flex items-center gap-3">
                  {pages.map((page, idx) => (
                    <button key={page.id} onClick={() => { setActivePageIndex(idx); setSelectedBlockId(null); }} className={`rounded-full px-3 py-1 text-xs ${idx === activePageIndex ? 'bg-[#003f82] text-white' : 'bg-white text-[#68737a] border border-[#dfe5e8]'}`}>
                      {page.title}
                    </button>
                  ))}
                  <button onClick={addPage} title="Adicionar página" className="grid h-7 w-7 place-items-center rounded-full border border-[#dfe5e8] text-[#68737a]"><Plus size={14} /></button>
                </div>

                <input
                  value={activePage.title}
                  onChange={(e) => updatePageTitle(activePage.id, e.target.value)}
                  className="mb-4 w-full bg-transparent text-lg font-semibold outline-none"
                />

                <div className="space-y-3">
                  {activePage.blocks.length === 0 && (
                    <p className="rounded border border-dashed border-[#c9d3da] bg-white p-8 text-center text-[#9aa5ad]">Clique em um item da barra à esquerda para adicionar uma pergunta.</p>
                  )}
                  {activePage.blocks.map((block, index) => (
                    <BlockCard
                      key={block.id}
                      index={index}
                      block={block}
                      selected={selectedBlockId === block.id}
                      onSelect={() => { setSelectedBlockId(block.id); setRightSection('Pergunta'); }}
                      onRemove={() => removeBlock(block.id)}
                      onChangeOption={(optIdx, value) => updateOption(block.id, optIdx, value)}
                    />
                  ))}
                </div>
              </div>

              <aside className="w-[300px] rounded border border-[#dfe5e8]">
                <div className="border-b border-[#dfe5e8] px-4 py-3 font-semibold">Questionário</div>
                <div className="flex">
                  <nav className="w-[150px] border-r border-[#dfe5e8] text-sm">
                    {(selectedBlock ? RIGHT_SECTIONS : ['Geral']).map((section) => (
                      <button key={section} onClick={() => setRightSection(section)} className={`block w-full px-4 py-3 text-left ${rightSection === section || (!selectedBlock && section === 'Geral') ? 'bg-[#eef2f6] font-medium text-[#202427]' : 'text-[#68737a]'}`}>
                        {section}
                      </button>
                    ))}
                  </nav>
                  <div className="flex-1 p-4 text-sm">
                    {!selectedBlock && (
                      <GeneralSettings settings={form.settings || {}} onChange={(settings) => pushHistory({ ...form, settings })} />
                    )}
                    {selectedBlock && rightSection === 'Pergunta' && (
                      <QuestionSettings block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} onAddOption={() => addOption(selectedBlock.id)} onRemoveOption={(i) => removeOption(selectedBlock.id, i)} />
                    )}
                    {selectedBlock && rightSection === 'Lógica' && (
                      <LogicSettings block={selectedBlock} blocks={allBlocksFlat.filter((b) => b.id !== selectedBlock.id)} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
                    )}
                    {selectedBlock && rightSection === 'Validação' && (
                      <ValidationSettings block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
                    )}
                    {selectedBlock && !['Pergunta', 'Lógica', 'Validação'].includes(rightSection) && (
                      <p className="text-[#9aa5ad]">Em breve.</p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <FormPreview pages={pages} pageIndex={previewIndex} onPrev={() => setPreviewIndex((i) => Math.max(0, i - 1))} onNext={() => setPreviewIndex((i) => Math.min(pages.length - 1, i + 1))} />
          )}
        </section>
      </main>

      <footer className="fixed bottom-0 left-[282px] right-0 flex justify-end gap-3 border-t border-[#dfe5e8] bg-white px-6 py-3">
        <button onClick={() => navigate('/formularios')} className="px-4 py-2 text-[#16829b]">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="rounded bg-[#2693d2] px-5 py-2.5 text-white disabled:opacity-50">Salvar</button>
      </footer>
    </div>
  );
}

function BlockCard({ index, block, selected, onSelect, onRemove, onChangeOption }) {
  return (
    <div onClick={onSelect} className={`cursor-pointer rounded border bg-white p-4 ${selected ? 'border-[#2693d2] ring-1 ring-[#2693d2]' : 'border-[#dfe5e8]'}`}>
      <div className="mb-2 flex items-start justify-between">
        <p className="font-medium">
          {index + 1}. {block.title || <span className="text-[#9aa5ad]">Pergunta sem título</span>} {block.required && <span className="text-red-500">*</span>}
        </p>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-[#9aa5ad] hover:text-red-500"><Trash2 size={15} /></button>
      </div>
      {block.description && <p className="mb-3 text-sm text-[#78838a]">{block.description}</p>}
      <BlockPreviewInput block={block} onChangeOption={onChangeOption} />
    </div>
  );
}

function BlockPreviewInput({ block, onChangeOption }) {
  switch (block.type) {
    case 'SIM_NAO':
      return (
        <div className="flex gap-2">
          {block.options.map((opt) => <span key={opt} className="rounded-full border border-[#dfe5e8] px-4 py-1.5 text-sm text-[#68737a]">{opt}</span>)}
        </div>
      );
    case 'MULTIPLA_ESCOLHA':
    case 'DROPDOWN':
      return (
        <div className="space-y-2">
          {block.options.map((opt, idx) => (
            <input key={idx} value={opt} onClick={(e) => e.stopPropagation()} onChange={(e) => onChangeOption(idx, e.target.value)} className="block w-full rounded border border-[#dfe5e8] px-3 py-1.5 text-sm" />
          ))}
        </div>
      );
    case 'TEXTO_LONGO':
      return <div className="h-16 rounded border border-dashed border-[#dfe5e8] bg-[#f7f9fa]" />;
    case 'DATA':
      return <div className="inline-flex items-center gap-2 rounded border border-[#dfe5e8] px-3 py-1.5 text-sm text-[#9aa5ad]"><CalendarDays size={15} /> dd/mm/aaaa</div>;
    case 'UPLOAD':
      return <div className="inline-flex items-center gap-2 rounded border border-dashed border-[#dfe5e8] px-3 py-1.5 text-sm text-[#9aa5ad]"><Image size={15} /> Arquivo</div>;
    case 'AVALIACAO':
      return <div className="flex gap-1 text-[#dfe5e8]">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} />)}</div>;
    case 'LOGICA':
      return <p className="text-sm text-[#9aa5ad]">Bloco de lógica condicional — configure no painel à direita.</p>;
    case 'VALIDACAO':
      return <p className="text-sm text-[#9aa5ad]">Bloco de validação — configure no painel à direita.</p>;
    default:
      return <div className="h-9 w-full rounded border border-dashed border-[#dfe5e8] bg-[#f7f9fa]" />;
  }
}

function GeneralSettings({ settings, onChange }) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Idioma pré-definido</span>
        <select value={settings.language || 'pt-BR'} onChange={(e) => onChange({ ...settings, language: e.target.value })} className="h-9 w-full rounded border border-[#dfe5e8] bg-white px-2">
          <option value="pt-BR">Pré-definido (Português Brasileiro)</option>
          <option value="en">Inglês</option>
          <option value="es">Espanhol</option>
        </select>
      </label>
      <div>
        <span className="mb-1 block text-[#68737a]">Modo (editável/somente leitura)</span>
        <div className="flex h-9 rounded border border-[#dfe5e8] p-1">
          {['editar', 'mostrar'].map((mode) => (
            <button key={mode} onClick={() => onChange({ ...settings, mode })} className={`flex-1 rounded text-sm ${settings.mode === mode || (!settings.mode && mode === 'editar') ? 'bg-[#dce5ef] text-[#202427]' : 'text-[#68737a]'}`}>{mode}</button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Nome do cookie</span>
        <input value={settings.cookieName || ''} onChange={(e) => onChange({ ...settings, cookieName: e.target.value })} className="h-9 w-full rounded border border-[#dfe5e8] px-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Modo de largura</span>
        <select value={settings.widthMode || 'padrao'} onChange={(e) => onChange({ ...settings, widthMode: e.target.value })} className="h-9 w-full rounded border border-[#dfe5e8] bg-white px-2">
          <option value="padrao">Padrão</option>
          <option value="estreito">Estreito</option>
          <option value="largo">Largo</option>
        </select>
      </label>
    </div>
  );
}

function QuestionSettings({ block, onChange, onAddOption, onRemoveOption }) {
  const hasOptions = block.type === 'MULTIPLA_ESCOLHA' || block.type === 'DROPDOWN';
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Título</span>
        <input value={block.title} onChange={(e) => onChange({ title: e.target.value })} className="h-9 w-full rounded border border-[#dfe5e8] px-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Descrição</span>
        <textarea value={block.description || ''} onChange={(e) => onChange({ description: e.target.value })} rows={3} className="w-full resize-y rounded border border-[#dfe5e8] px-2 py-1.5" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!block.required} onChange={(e) => onChange({ required: e.target.checked })} />
        <span>Pergunta obrigatória</span>
      </label>
      {hasOptions && (
        <div>
          <span className="mb-2 block text-[#68737a]">Opções</span>
          <div className="space-y-2">
            {block.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input value={opt} onChange={(e) => {
                  const options = block.options.map((o, i) => (i === idx ? e.target.value : o));
                  onChange({ options });
                }} className="h-9 flex-1 rounded border border-[#dfe5e8] px-2" />
                <button onClick={() => onRemoveOption(idx)} className="text-[#9aa5ad] hover:text-red-500"><X size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={onAddOption} className="mt-2 flex items-center gap-1 text-[#16829b]"><Plus size={14} /> Adicionar opção</button>
        </div>
      )}
    </div>
  );
}

function LogicSettings({ block, blocks, onChange }) {
  const logic = block.logic || { sourceBlockId: '', operator: 'IGUAL', value: '' };
  return (
    <div className="space-y-4">
      <p className="text-[#68737a]">Exibir esta pergunta somente quando:</p>
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Pergunta de referência</span>
        <select value={logic.sourceBlockId || ''} onChange={(e) => onChange({ logic: { ...logic, sourceBlockId: e.target.value } })} className="h-9 w-full rounded border border-[#dfe5e8] bg-white px-2">
          <option value="">Selecione</option>
          {blocks.map((b) => <option key={b.id} value={b.id}>{b.title || 'Pergunta sem título'}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Condição</span>
        <select value={logic.operator || 'IGUAL'} onChange={(e) => onChange({ logic: { ...logic, operator: e.target.value } })} className="h-9 w-full rounded border border-[#dfe5e8] bg-white px-2">
          <option value="IGUAL">É igual a</option>
          <option value="DIFERENTE">É diferente de</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Valor</span>
        <input value={logic.value || ''} onChange={(e) => onChange({ logic: { ...logic, value: e.target.value } })} className="h-9 w-full rounded border border-[#dfe5e8] px-2" />
      </label>
    </div>
  );
}

function ValidationSettings({ block, onChange }) {
  const validation = block.validation || { minLength: '', maxLength: '' };
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Tamanho mínimo</span>
        <input type="number" value={validation.minLength ?? ''} onChange={(e) => onChange({ validation: { ...validation, minLength: e.target.value ? Number(e.target.value) : null } })} className="h-9 w-full rounded border border-[#dfe5e8] px-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[#68737a]">Tamanho máximo</span>
        <input type="number" value={validation.maxLength ?? ''} onChange={(e) => onChange({ validation: { ...validation, maxLength: e.target.value ? Number(e.target.value) : null } })} className="h-9 w-full rounded border border-[#dfe5e8] px-2" />
      </label>
    </div>
  );
}

function FormPreview({ pages, pageIndex, onPrev, onNext }) {
  const page = pages[pageIndex];
  if (!page) return null;
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="rounded border border-[#dfe5e8] p-8">
        <h2 className="mb-4 text-lg font-semibold">{page.title}</h2>
        <div className="space-y-6">
          {page.blocks.map((block, idx) => (
            <div key={block.id} className="rounded border border-[#dfe5e8] p-5">
              <p className="mb-1 font-semibold">{idx + 1}. {block.title || 'Pergunta sem título'} {block.required && <span className="text-red-500">*</span>}</p>
              {block.description && <p className="mb-3 text-sm text-[#78838a]">{block.description}</p>}
              <BlockPreviewInput block={block} onChangeOption={() => {}} />
            </div>
          ))}
          {page.blocks.length === 0 && <p className="text-[#9aa5ad]">Esta página ainda não tem perguntas.</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-[#68737a]">
        <button onClick={onPrev} disabled={pageIndex === 0} className="flex items-center gap-1 disabled:opacity-30"><ChevronLeft size={16} /> Anterior</button>
        <span>{page.title}</span>
        <button onClick={onNext} disabled={pageIndex === pages.length - 1} className="flex items-center gap-1 disabled:opacity-30">Próxima <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
