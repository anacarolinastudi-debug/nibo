export function buildMonthlyTransactions(items, filters) {
  const year = Number(filters.year);
  const month = Number(filters.month);
  if (!Number.isInteger(year) || month < 1 || month > 12) return [];
  const savedIds = new Set(items.map((item) => item.id));
  return items.flatMap((item) => {
    const due = new Date(item.dueDate);
    if (due.getUTCFullYear() === year && due.getUTCMonth() === month - 1) return [item];
    if (!item.recurrenceInfinite) return [];
    const day = Math.min(due.getUTCDate(), new Date(Date.UTC(year, month, 0)).getUTCDate());
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date <= due) return [];
    const id = item.projectedIds?.[`${year}-${month}`] || item.projectedId || `${item.id}-projected-${year}-${month}`;
    if (savedIds.has(id)) return [];
    return [{ ...item, id, sourceId: item.id, dueDate: date.toISOString(), status: 'PENDING', paidAt: null, receipt: null, projected: true }];
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

export function summarizeTransactions(items) {
  const totals = { entradas: 0, saidas: 0, aReceber: 0, aPagar: 0 };
  for (const item of items) {
    const amount = Number(item.amount || 0);
    const income = item.type === 'RECEITA';
    totals[income ? 'entradas' : 'saidas'] += amount;
    if (item.status !== 'PAID') totals[income ? 'aReceber' : 'aPagar'] += amount;
  }
  return { ...totals, saldo: totals.entradas - totals.saidas, saldoPendente: totals.aReceber - totals.aPagar };
}

export function buildFinancialChart(items, { year, month, range = 'month', status = '', query = '' }) {
  if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(month) < 1 || Number(month) > 12) return [];
  const rows = [];
  for (let index = 0; index < (range === 'year' ? 12 : 1); index += 1) {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1 + index, 1));
    const targetYear = date.getUTCFullYear();
    const targetMonth = date.getUTCMonth() + 1;
    const days = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const buckets = Array.from({ length: range === 'year' ? 1 : days }, (_, day) => ({
      key: range === 'year' ? `${targetYear}-${targetMonth}` : `${targetYear}-${targetMonth}-${day + 1}`,
      label: range === 'year' ? date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : String(day + 1).padStart(2, '0'),
      recebido: 0, pago: 0, aReceber: 0, aPagar: 0,
    }));
    for (const item of buildMonthlyTransactions(items, { year: targetYear, month: targetMonth })) {
      if (status && item.status !== status) continue;
      if (!`${item.description} ${item.client?.name || ''} ${item.category?.name || ''}`.toLowerCase().includes(query.toLowerCase())) continue;
      const row = buckets[range === 'year' ? 0 : new Date(item.dueDate).getUTCDate() - 1];
      const key = item.type === 'RECEITA' ? (item.status === 'PAID' ? 'recebido' : 'aReceber') : (item.status === 'PAID' ? 'pago' : 'aPagar');
      row[key] += Number(item.amount || 0);
    }
    rows.push(...buckets);
  }
  const max = Math.max(1, ...rows.flatMap((row) => [row.recebido + row.aReceber, row.pago + row.aPagar]));
  return rows.map((row) => ({ ...row, max }));
}
