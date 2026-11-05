import React, { useEffect, useState } from 'react';
import { ArrowRight, Calculator, Building2, Wallet, Download, RotateCcw, ShieldCheck, ExternalLink, AlertTriangle, Check, Copy } from 'lucide-react';
import { ACTIVITIES, ASSUMPTIONS, TAX_SOURCES, calculateProLabore } from '../utils/proLabore';
import { searchActivities, findActivityChoice } from '../utils/cnaeSearch';
import './ProLaboreCalculator.css';

const initial = { activityId: '', gross: '', dependents: '0', pension: '', revenue12: '', payroll12: '', established: false, ordinary: false };
const brl = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = value => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
function Amount({ label, name, value, onChange, required = false, hint, integer = false }) {
  return <label className="pl-field"><span>{label}{required && <b aria-label="obrigatório"> *</b>}</span><div className="pl-input-wrap">{!integer && <span aria-hidden="true">R$</span>}<input name={name} value={value} onChange={event => onChange(name, event.target.value)} type="number" inputMode={integer ? 'numeric' : 'decimal'} step={integer ? '1' : '.01'} min="0" max={integer ? '99' : '10000000'} placeholder={integer ? '0' : '0,00'} required={required} /></div>{hint && <small>{hint}</small>}</label>;
}
function Row({ label, value, total = false, id }) {
  return <div className={`pl-row ${total ? 'pl-row-total' : ''}`}><span>{label}</span><strong data-testid={id}>{brl(value)}</strong></div>;
}
export default function ProLaboreCalculator() {
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState('activity');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const choice = findActivityChoice(selection || form.activityId);
  const baseActivity = ACTIVITIES.find(item => item.id === form.activityId);
  const activity = baseActivity && choice ? { ...baseActivity, label: choice.label, cnae: choice.cnae } : baseActivity;
  const activities = searchActivities(query);
  useEffect(() => { const old = document.title; document.title = 'Calculadora de pró-labore | Young Contábil'; return () => { document.title = old; }; }, []);
  function change(name, value) { setForm(current => ({ ...current, [name]: value })); setResult(null); setError(''); }
  function choose(key) { const item = findActivityChoice(key); setSelection(key); change('activityId', item?.activityId || ''); }
  function search(value) {
    setQuery(value); choose('');
    const digits = value.replace(/\D/g, '');
    if (digits.length === 7 && !/[a-zA-Z]/.test(value)) {
      const exact = searchActivities(value).find(item => item.cnae?.replace(/\D/g, '') === digits);
      if (exact) choose(exact.key);
    }
  }
  function simulate(event) {
    event.preventDefault();
    try {
      const number = value => value === '' ? undefined : Number(value);
      const calculation = calculateProLabore({ ...form, gross: number(form.gross), revenue12: number(form.revenue12), payroll12: number(form.payroll12), dependents: number(form.dependents), pension: number(form.pension) ?? 0 });
      setResult(calculation); setError('');
      window.requestAnimationFrame(() => document.getElementById('pl-result-title')?.focus({ preventScroll: true }));
    } catch (failure) { setResult(null); setError(failure.message); }
  }
  async function download() {
    if (!result || exporting) return;
    setExporting(true); setError('');
    try {
      const { createProLaborePdf } = await import('../utils/proLaborePdf');
      const blob = await createProLaborePdf(result);
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'simulacao-pro-labore-2026.pdf'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError('Não foi possível gerar o PDF. Tente novamente.'); }
    finally { setExporting(false); }
  }
  async function share() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/calculadora-pro-labore`); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setError('Não foi possível copiar o link. O endereço desta página pode ser compartilhado diretamente.'); }
  }
  return <div className="pl-page">
    <header className="pl-top"><div className="pl-container pl-top-inner"><a href="/calculadora-pro-labore" aria-label="Young Contábil · calculadora"><span className="pl-brand"><img src="/content/young-logo-official-v2.png" alt="Young Contábil" /></span></a><span className="pl-top-note"><ShieldCheck size={16} /> Acesso livre · sem cadastro</span></div></header>
    <main className="pl-container">
      <div className="pl-heading"><div><span className="pl-kicker">SIMPLES NACIONAL · 2026</span><h1>Calculadora de pró-labore</h1><p>Da retirada do sócio ao faturamento necessário, com os tributos na mesma conta.</p></div><button type="button" className="pl-button pl-secondary" onClick={share}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Link copiado' : 'Compartilhar'}</button></div>
      <div className="pl-workspace">
        <section className="pl-form-section" aria-label="Dados da simulação">
          <div className="pl-tabs" role="tablist" aria-label="Etapas da simulação">{[['activity', Building2, 'Atividade da empresa'], ['income', Wallet, 'Pró-labore']].map(([key, Icon, label]) => <button key={key} type="button" role="tab" id={`pl-tab-${key}`} aria-selected={tab === key} aria-controls={`pl-panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'activity' : event.key === 'End' ? 'income' : tab === 'activity' ? 'income' : 'activity'; setTab(next); document.getElementById(`pl-tab-${next}`)?.focus(); } }}><Icon size={17} />{label}</button>)}</div>
          <div role="tabpanel" id="pl-panel-activity" aria-labelledby="pl-tab-activity" hidden={tab !== 'activity'}>
            <div className="pl-section-heading"><span>01</span><h2>Atividade da empresa</h2></div>
            <label className="pl-field"><span>Buscar atividade ou CNAE</span><input type="search" value={query} onChange={event => search(event.target.value)} placeholder="Ex.: cabeleireiros, comércio, 9602-5/01" /></label>
            <label className="pl-field"><span>Atividade exercida <b aria-label="obrigatório">*</b></span><select value={choice?.key || ''} onChange={event => { choose(event.target.value); setQuery(''); }}><option value="">Selecione sua atividade</option>{activities.map(item => <option key={item.key} value={item.key}>{item.label}{item.cnae ? ` · ${item.cnae}` : ''}</option>)}{choice && !activities.some(item => item.key === choice.key) && <option value={choice.key}>{choice.label}{choice.cnae ? ` · ${choice.cnae}` : ''}</option>}</select></label>
            {!activities.length && <p className="pl-note">Nenhuma atividade encontrada no catálogo. <button type="button" className="pl-inline" onClick={() => { choose('other'); setQuery(''); }}>Confirmar outro enquadramento</button></p>}
            {activity && <div className={`pl-classification ${activity.id === 'other' ? 'pl-warning' : ''}`}><strong>{activity.cnae ? `${activity.cnae} · ${activity.label}` : activity.label}</strong><strong>{activity.annex ? `Anexo ${activity.annex}` : activity.factorR ? 'Anexo III ou V · fator R' : 'Atividade identificada · enquadramento a confirmar'}</strong><p>{activity.detail}</p></div>}
            <Amount label="Receita bruta dos últimos 12 meses" name="revenue12" value={form.revenue12} onChange={change} required hint="RBT12 anterior ao mês simulado. Limite desta versão: R$ 180.000,00." />
            {activity?.factorR && <Amount label="Folha com encargos dos últimos 12 meses" name="payroll12" value={form.payroll12} onChange={change} required hint="Inclua salários, pró-labore e encargos admitidos no fator R efetivamente pagos. Use o mesmo período da receita. Se não houve folha, informe 0." />}
            <div className="pl-confirmations"><label><input type="checkbox" checked={form.established} onChange={event => change('established', event.target.checked)} />Minha empresa tem 13 meses ou mais de atividade.</label><label><input type="checkbox" checked={form.ordinary} onChange={event => change('ordinary', event.target.checked)} />A receita é integralmente desta atividade, sem regimes especiais, ISS fixo ou CPRB.</label></div>
            <p className="pl-note">O enquadramento depende da atividade efetiva, não só do CNAE. Se a sua atividade não estiver na lista, não presumimos uma alíquota.</p>
            <button type="button" className="pl-button pl-primary pl-full" onClick={() => setTab('income')}>Continuar <ArrowRight size={17} /></button>
          </div>
          <div role="tabpanel" id="pl-panel-income" aria-labelledby="pl-tab-income" hidden={tab !== 'income'}>
            <form onSubmit={simulate}>
              <div className="pl-section-heading"><span>02</span><h2>Retirada mensal do sócio</h2></div>
              <Amount label="Pró-labore bruto mensal" name="gross" value={form.gross} onChange={change} required />
              <Amount label="Dependentes para o IRRF" name="dependents" value={form.dependents} onChange={change} integer />
              <Amount label="Pensão alimentícia judicial" name="pension" value={form.pension} onChange={change} hint="Opcional. Valor mensal dedutível e descontado do pró-labore." />
              <div className="pl-classification"><strong>{activity?.label || 'Atividade não selecionada'}</strong><p>RBT12: {form.revenue12 !== '' ? brl(Number(form.revenue12)) : 'não informado'}</p><button type="button" onClick={() => setTab('activity')} className="pl-inline">Alterar atividade e histórico</button></div>
              <button type="submit" className="pl-button pl-primary pl-full" disabled={exporting}><Calculator size={18} /> Calcular simulação</button>
              <button type="button" className="pl-reset" onClick={() => { setForm(initial); setQuery(''); setSelection(''); setResult(null); setError(''); setTab('activity'); }}><RotateCcw size={15} /> Limpar dados</button>
            </form>
          </div>
          {error && <div className="pl-error" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}
          <p className="pl-privacy"><ShieldCheck size={14} /> Os valores desta simulação não são enviados nem gravados no sistema.</p>
        </section>
        <section className="pl-results" aria-label="Resultado da simulação" aria-live="polite">
          {!result ? <div className="pl-empty"><Calculator size={32} /><h2>Sua simulação mensal</h2><p>Selecione a atividade e informe a retirada bruta para consultar o faturamento, os descontos e o total de tributos.</p><div className="pl-empty-lines"><span>Pró-labore líquido<strong>—</strong></span><span>Faturamento necessário<strong>—</strong></span><span>Total de tributos<strong>—</strong></span></div></div> : <>
            <div className="pl-result-head"><h2 id="pl-result-title" tabIndex={-1}>Sua simulação mensal</h2><span>Anexo {result.annex} · {percent(result.rate)}</span></div>
            <div className="pl-main-result"><span>Faturamento mínimo estimado</span><strong data-testid="revenue">{brl(result.revenue)}</strong><p>Para cobrir {brl(result.gross)} de pró-labore bruto e os tributos da empresa.</p></div>
            <div className="pl-breakdown"><h3>Sócio</h3><Row label="Pró-labore bruto" value={result.gross} /><Row label="INSS retido · 11% até o teto" value={result.inss} /><Row label="IRRF após redução" value={result.irrf} />{result.pension > 0 && <Row label="Pensão judicial descontada" value={result.pension} />}<Row label="Líquido recebido" value={result.net} total id="net" /></div>
            <div className="pl-breakdown"><h3>Empresa</h3><Row label={`DAS · ${percent(result.rate)} do faturamento`} value={result.das} /><Row label={result.annex === 'IV' ? 'CPP patronal · 20% do bruto' : 'CPP externa · já contemplada no DAS'} value={result.cpp} /><Row label="Tributos da empresa" value={result.companyTaxes} total /></div>
            <div className="pl-tax-total"><div><span>Total de tributos</span><strong data-testid="total-taxes">{brl(result.totalTaxes)}</strong></div><p>Sócio + empresa · {percent(result.taxShare)} do faturamento estimado</p><div className="pl-tax-bar" aria-hidden="true"><span style={{ width: `${result.individualTaxes / result.totalTaxes * 100}%` }} /></div><div className="pl-tax-legend"><span>Sócio {brl(result.individualTaxes)}</span><span>Empresa {brl(result.companyTaxes)}</span></div></div>
            {result.factorR !== null && <p className="pl-factor">Fator R histórico: <b>{(result.factorR * 100).toLocaleString('pt-BR', { maximumFractionDigits: 8 })}%</b> · {result.annex === 'III' ? 'igual ou superior a 28%' : 'inferior a 28%'}.</p>}
            {result.warnings.map(warning => <div key={warning} className="pl-warning pl-warning-block"><AlertTriangle size={17} /><p>{warning}</p></div>)}
            <details className="pl-details"><summary>Memória de cálculo</summary><Row label={`Dedução ${result.deductionMode === 'legal' ? 'legal' : 'simplificada'} do IRRF`} value={result.deduction} /><Row label="Base do IRRF" value={result.baseIR} /><Row label="IRRF antes da redução de 2026" value={result.taxBeforeReduction} /><Row label="Redução aplicada" value={result.reduction} /><p>Faturamento = (pró-labore bruto + CPP externa) ÷ (1 − alíquota do DAS). Os descontos do sócio já estão no bruto.</p></details>
            <button type="button" onClick={download} disabled={exporting} className="pl-button pl-secondary pl-full"><Download size={17} />{exporting ? 'Gerando PDF…' : 'Baixar simulação em PDF'}</button>
          </>}
        </section>
      </div>
      <section className="pl-footnotes"><h2>Premissas da simulação</h2><ul>{ASSUMPTIONS.map(note => <li key={note}>{note}</li>)}</ul><details><summary>Fontes oficiais e regras de 2026</summary><p>Última conferência: 05/11/2026. Esta versão não aplica regras de 2027.</p><div className="pl-sources">{TAX_SOURCES.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink size={14} /></a>)}</div></details></section>
    </main>
    <footer className="pl-bottom"><div className="pl-container"><span>Young Contábil</span><span>Clareza para cuidar da sua empresa.</span></div></footer>
  </div>;
}
