const { randomUUID } = require('node:crypto');
const prisma = require('../lib/prisma');
const { SOURCES } = require('../data/accountingNewsSources');
const { parseFeed, parsePage, trustedUrl, MAX_BYTES } = require('./accountingNewsParser');
const KEY = 'national';
const localDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

async function fetchSource(source) {
  let url = trustedUrl(source.feedUrl || source.url, source);
  if (!url) throw new Error('Endereco da fonte nao permitido.');
  const signal = AbortSignal.timeout(18000);
  const limit = Math.min(source.maxBytes || MAX_BYTES, 8 * 1024 * 1024);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'YoungContabil-News/1.0', Accept: 'application/rss+xml, application/atom+xml, text/html;q=0.9' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const destination = new URL(response.headers.get('location') || '', url);
      await response.body?.cancel();
      url = trustedUrl(destination.href, source);
      if (!url) throw new Error('Redirecionamento fora da fonte cadastrada.');
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Fonte indisponivel (HTTP ${response.status}).`); }
    if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error('Resposta acima do tamanho permitido.'); }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limit) throw new Error('Resposta acima do tamanho permitido.');
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return source.format === 'rss' ? parseFeed(body, source) : parsePage(body, source);
  }
  throw new Error('Excesso de redirecionamentos.');
}

async function acquire(db, now, daily) {
  await db.newsSyncState.upsert({ where: { key: KEY }, create: { key: KEY }, update: {} });
  const state = await db.newsSyncState.findUnique({ where: { key: KEY } });
  const today = localDay(now);
  const cutoff = new Date(today + 'T07:00:00-04:00');
  if (daily && now < cutoff) return null;
  if (daily && state.state === 'COMPLETED' && state.lastCompletedAt >= cutoff) return null;
  const scheduledDue = daily && (!state.lastAttemptAt || state.lastAttemptAt < cutoff);
  const owner = randomUUID();
  const result = await db.newsSyncState.updateMany({ where: { key: KEY, AND: [
    { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
    ...(scheduledDue ? [] : [{ OR: [{ nextAllowedAt: null }, { nextAllowedAt: { lte: now } }] }]),
  ] }, data: { state: 'RUNNING', leaseOwner: owner, leaseUntil: new Date(now.getTime() + 600000), nextAllowedAt: new Date(now.getTime() + 1800000), lastAttemptAt: now, errorMessage: null } });
  return result.count ? owner : null;
}

async function collect(owner, db = prisma, fetcher = fetchSource) {
  let success = 0, errors = 0, index = 0;
  const deadline = Date.now() + 480000;
  async function fenced(write) {
    return db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`SELECT "leaseOwner", "leaseUntil" FROM news_sync_states WHERE key = ${KEY} FOR UPDATE`;
      if (rows[0]?.leaseOwner !== owner || rows[0]?.leaseUntil <= new Date() || Date.now() > deadline) return false;
      await write(tx); return true;
    }, { timeout: 60000 });
  }
  async function worker() {
    while (index < SOURCES.length) {
      const source = SOURCES[index++];
      try {
        if (Date.now() > deadline) throw new Error('Tempo da coleta excedido. Nova tentativa na proxima atualizacao.');
        const items = await fetcher(source);
        const written = await fenced(async (tx) => {
          await tx.newsSource.upsert({ where: { id: source.id }, create: { id: source.id, name: source.name, url: source.url, uf: source.uf || null, scope: source.scope, priority: source.priority || 0 }, update: { name: source.name, url: source.url, uf: source.uf || null, scope: source.scope, priority: source.priority || 0 } });
          for (const item of items) {
          const { publishedAt, summary, ...metadata } = item;
          await tx.newsArticle.upsert({ where: { url: item.url }, create: { ...item, sourceId: source.id, sortDate: publishedAt || new Date() }, update: { ...metadata, ...(summary ? { summary } : {}), ...(publishedAt ? { publishedAt, sortDate: publishedAt } : {}) } });
        }
          await tx.newsSource.update({ where: { id: source.id }, data: { status: items.length ? 'OK' : 'EMPTY', lastCheckedAt: new Date(), lastSuccessAt: new Date(), errorMessage: items.length ? null : 'Nenhum item reconhecido nesta verificacao.', articlesCount: items.length } });
        });
        if (!written) { errors++; return; }
        success++;
      } catch (error) {
        const safeMessage = /^(Fonte indisponivel|Endereco da fonte|Redirecionamento|Excesso de|Resposta acima|Tempo da coleta|A fonte exige|Feed nao reconhecido|Declaracoes)/.test(error.message) ? error.message.slice(0, 200) : 'Nao foi possivel consultar esta fonte. Nova tentativa na proxima atualizacao.';
        await fenced(async (tx) => tx.newsSource.upsert({ where: { id: source.id }, create: { id: source.id, name: source.name, url: source.url, uf: source.uf || null, scope: source.scope, priority: source.priority || 0, status: 'ERROR', lastCheckedAt: new Date(), errorMessage: safeMessage }, update: { status: 'ERROR', priority: source.priority || 0, lastCheckedAt: new Date(), errorMessage: safeMessage } }));
        errors++;
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: 3 }, worker));
    if (success + errors < SOURCES.length) errors += SOURCES.length - success - errors;
    await db.newsSyncState.updateMany({ where: { key: KEY, leaseOwner: owner }, data: { state: success ? (errors ? 'PARTIAL' : 'COMPLETED') : 'FAILED', leaseOwner: null, leaseUntil: null, ...(success ? { lastCompletedAt: new Date() } : {}), errorMessage: errors ? `${errors} fonte(s) indisponivel(is).` : null } });
  } catch {
    await db.newsSyncState.updateMany({ where: { key: KEY, leaseOwner: owner }, data: { state: 'FAILED', leaseOwner: null, leaseUntil: null, errorMessage: 'A coleta nao foi concluida.' } });
  }
}

async function requestSync({ daily = false, wait = false, db = prisma, fetcher = fetchSource, now = new Date() } = {}) {
  const owner = await acquire(db, now, daily);
  if (!owner) {
    const current = await db.newsSyncState.findUnique({ where: { key: KEY } });
    return { state: current?.state || 'IDLE', queued: false };
  }
  const work = collect(owner, db, fetcher);
  if (wait) await work;
  else work.catch(() => console.error('Falha na atualizacao das fontes contabeis.'));
  return { state: wait ? (await db.newsSyncState.findUnique({ where: { key: KEY } })).state : 'RUNNING', queued: true };
}

async function getStatus(full = true) {
  const record = await prisma.newsSyncState.findUnique({ where: { key: KEY } });
  const expired = record?.state === 'RUNNING' && record.leaseUntil < new Date();
  const status = { state: expired ? 'FAILED' : record?.state || 'IDLE', lastAttemptAt: record?.lastAttemptAt || null, lastCompletedAt: record?.lastCompletedAt || null };
  if (!full) return status;
  const stored = await prisma.newsSource.findMany();
  return { ...status, nextSchedule: '07:00', timeZone: 'America/Cuiaba', sources: SOURCES.map((source) => {
    const row = stored.find((item) => item.id === source.id);
    return { id: source.id, name: source.name, url: source.url, uf: source.uf || null, scope: source.scope, status: row?.status || 'PENDING', lastCheckedAt: row?.lastCheckedAt || null, lastSuccessAt: row?.lastSuccessAt || null, errorMessage: row?.errorMessage || null, articlesCount: row?.articlesCount || 0 };
  }) };
}
module.exports = { requestSync, getStatus, fetchSource, acquire, localDay };
