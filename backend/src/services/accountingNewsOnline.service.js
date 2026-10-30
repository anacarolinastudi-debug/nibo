const { createHash, randomUUID } = require('node:crypto');
const { SOURCES } = require('../data/accountingNewsSources');
const { articleUrl } = require('./accountingNewsParser');
const { fetchSource } = require('./accountingNews.service');
const { searchArchive } = require('./accountingNewsArchive.service');
const prisma = require('../lib/prisma');
const TTL = 15 * 60000;
const fail = (message, status = 503) => Object.assign(new Error(message), { status });
const queryTerms = value => [...new Set(normalize(value || '').split(/[^a-z0-9]+/).filter(term => term.length > 1))].slice(0, 20);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
function searchKey(firmId, input) {
  return createHash('sha256').update(JSON.stringify(['archive-v1', firmId, ...['q', 'kind', 'area', 'scope', 'uf', 'source', 'from', 'to'].map(key => typeof input[key] === 'string' ? normalize(input[key]) : key === 'kind' ? 'news' : '')])).digest('hex');
}
function selectedSources(input) {
  return SOURCES.filter(source => (!input.source || source.id === input.source) && source.kind === (input.kind || 'NEWS') && (!input.scope || source.scope === input.scope) && (!input.uf || source.uf === input.uf));
}
async function discoverLinks({ sources, fetcher = fetchSource }) {
  const items = []; let index = 0, failed = 0;
  async function worker() {
    while (index < sources.length) {
      const source = sources[index++];
      try {
        const found = await fetcher({ ...source, timeoutMs: 8000 });
        for (const item of found.slice(0, 105)) items.push({ source, item });
      } catch { failed++; }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  return { items, failed, attribution: null };
}
async function cachedSearch(firmId, input, db = prisma, now = new Date()) {
  if (!input.q?.trim()) return null;
  return db.newsOnlineSearch.findFirst({ where: { key: searchKey(firmId, input), accountingFirmId: firmId, provider: 'DIRECT', checkedAt: { gte: new Date(now.getTime() - TTL) } } });
}
const present = (row, cached) => ({ status: row.status, provider: row.provider, discovered: row.articleIds.length, sources: row.sources, attribution: row.attribution, checkedAt: row.checkedAt, cached });
async function searchOnline(firmId, input, { db = prisma, discover = discoverLinks, archive = searchArchive, now = new Date() } = {}) {
  const cached = await cachedSearch(firmId, input, db, now); if (cached) return present(cached, true);
  const sources = selectedSources(input);
  if (!sources.length) return { status: 'UNSUPPORTED', discovered: 0, sources: [], attribution: null };
  const key = 'direct-news-search', owner = randomUUID();
  await db.newsSyncState.upsert({ where: { key }, create: { key }, update: {} });
  const locked = await db.newsSyncState.updateMany({ where: { key, AND: [{ OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, { OR: [{ nextAllowedAt: null }, { nextAllowedAt: { lte: now } }] }] }, data: { state: 'RUNNING', leaseOwner: owner, leaseUntil: new Date(now.getTime() + 120000), nextAllowedAt: new Date(now.getTime() + 60000), lastAttemptAt: now } });
  if (!locked.count) return { status: 'COOLDOWN', discovered: 0, sources: [], attribution: null };
  try {
    const provider = 'DIRECT';
    const found = await discover({ sources });
    let archiveFailed = false;
    try { found.items.push(...await archive({ input, sources })); }
    catch { archiveFailed = true; }
    const terms = queryTerms(input.q);
    const items = found.items.filter(({ source, item }) => sources.some(value => value.id === source.id) && articleUrl(item.url, source) && terms.length && terms.every(term => normalize(item.title + ' ' + item.summary).includes(term))).sort((a, b) => (b.source.priority || 0) - (a.source.priority || 0)).slice(0, 60);
    const failed = found.failed || 0;
    if (failed === sources.length && !items.length) throw fail('As fontes estao indisponiveis no momento. O acervo salvo foi preservado.');
    const row = await db.$transaction(async tx => {
      const lease = await tx.$queryRaw`SELECT "leaseOwner", "leaseUntil" FROM news_sync_states WHERE key = ${key} FOR UPDATE`;
      if (lease[0]?.leaseOwner !== owner || lease[0]?.leaseUntil <= new Date()) throw fail('A pesquisa expirou. Tente novamente.', 504);
      const articleIds = [], storedSources = new Set();
      for (const { source, item } of items) {
        if (!storedSources.has(source.id)) {
          await tx.newsSource.upsert({ where: { id: source.id }, create: { id: source.id, name: source.name, url: source.url, scope: source.scope, uf: source.uf || null, priority: source.priority || 0 }, update: {} });
          storedSources.add(source.id);
        }
        const { publishedAt, summary, ...metadata } = item;
        const stored = await tx.newsArticle.upsert({ where: { url: item.url }, create: { ...item, sourceId: source.id, sortDate: publishedAt || new Date() }, update: { ...metadata, ...(summary ? { summary } : {}), ...(publishedAt ? { publishedAt, sortDate: publishedAt } : {}) } });
        if (terms.length && terms.every(term => normalize(stored.title + ' ' + stored.summary).includes(term))) articleIds.push(stored.id);
      }
      const data = { accountingFirmId: firmId, articleIds: [...new Set(articleIds)], status: failed || archiveFailed ? 'PARTIAL' : articleIds.length ? 'COMPLETED' : 'EMPTY', provider, sources: [...new Set(items.map(entry => entry.source.id))], attribution: null, checkedAt: new Date() };
      await tx.newsOnlineSearch.deleteMany({ where: { accountingFirmId: firmId, checkedAt: { lt: new Date(Date.now() - 86400000) } } });
      return tx.newsOnlineSearch.upsert({ where: { key: searchKey(firmId, input) }, create: { key: searchKey(firmId, input), ...data }, update: data });
    }, { timeout: 30000 });
    return present(row, false);
  } finally {
    await db.newsSyncState.updateMany({ where: { key, leaseOwner: owner }, data: { state: 'IDLE', leaseOwner: null, leaseUntil: null } });
  }
}
module.exports = { queryTerms, searchOnline, cachedSearch, searchKey, discoverLinks, presentSearch: present };
