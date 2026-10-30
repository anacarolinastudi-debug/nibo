const prisma = require('../lib/prisma');
const { SOURCES } = require('../data/accountingNewsSources');
const { articleUrl } = require('./accountingNewsParser');
const { fetchSource } = require('./accountingNews.service');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const official = SOURCES.filter(source => source.allowedHosts.some(host => host === 'gov.br' || host.endsWith('.gov.br')));

async function researchOfficialSources({ topic, db = prisma, fetcher = fetchSource }) {
  const stop = new Set(['para', 'sobre', 'como', 'uma', 'das', 'dos', 'que', 'por', 'com', 'sem', 'pelo', 'pela']);
  const terms = [...new Set(normalize((topic || '').split(':')[0]).split(/[^a-z0-9]+/).filter(term => term.length > 2 && !stop.has(term)))].slice(0, 8);
  if (!terms.length) return { status: 'EMPTY', references: [], checkedAt: new Date().toISOString() };
  const items = []; let errors = 0;
  try {
    items.push(...await db.newsArticle.findMany({ where: { sourceId: { in: official.map(source => source.id) }, AND: terms.map(term => ({ searchText: { contains: term } })) }, orderBy: { sortDate: 'desc' }, take: 8, select: { title: true, summary: true, url: true, publishedAt: true } }));
  } catch { errors++; }
  // Only public themes are matched locally; private context is never sent to publishers.
  if (!items.length) await Promise.all(['receita-federal', 'fazenda', 'esocial'].map(async id => {
    try { items.push(...await fetcher({ ...official.find(source => source.id === id), timeoutMs: 8000 })); }
    catch { errors++; }
  }));
  const references = [...new Map(items.filter(item => official.some(source => articleUrl(item.url, source)) && terms.every(term => normalize(item.title + ' ' + item.summary).includes(term))).map(item => [item.url, { title: item.title.slice(0, 300), excerpt: (item.summary || '').slice(0, 420), url: item.url, publishedAt: item.publishedAt || null }])).values()].slice(0, 6);
  return { status: references.length ? (errors ? 'PARTIAL' : 'FOUND') : errors ? 'UNAVAILABLE' : 'EMPTY', references, checkedAt: new Date().toISOString() };
}
module.exports = { researchOfficialSources };
