const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const MAX_BYTES = 2 * 1024 * 1024;
const AREAS = ['FISCAL', 'TRIBUTARIO', 'TRABALHISTA', 'PREVIDENCIARIO', 'CONTABIL', 'SPED', 'REFORMA_TRIBUTARIA', 'SIMPLES_NACIONAL', 'GERAL'];
const text = (value, max = 500) => {
  if (typeof value !== 'string') return '';
  const $ = cheerio.load(value, null, false); $('script,style,iframe,svg,form,noscript').remove();
  return $.text().replace(/\s+/g, ' ').trim().slice(0, max);
};
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function bounded(input, limit = MAX_BYTES) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > Math.min(limit, 8 * 1024 * 1024)) throw new Error('Resposta acima do tamanho permitido.');
  return input;
}
function trustedUrl(value, source) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, source.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !source.allowedHosts.includes(url.hostname)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.href.length <= 2048 ? url : null;
  } catch { return null; }
}
function articleUrl(value, source) {
  const url = trustedUrl(value, source);
  if (!url || !source.articlePrefixes.some((prefix) => url.pathname.startsWith(prefix))) return null;
  if (/\.(?:jpg|jpeg|png|webp|gif|svg|css|js|zip|xml)$/i.test(url.pathname)) return null;
  if (source.kind !== 'LEGISLATION' && /\.pdf$/i.test(url.pathname)) return null;
  const suffix = url.pathname.replace(/\/$/, '').split('/').pop();
  if (!suffix || suffix.length < 7 || /^(rss|feed|noticias|not%C3%ADcias|default\.aspx)$/i.test(suffix)) return null;
  if (/^index\.html$/i.test(suffix) && !/\/noticias\/20\d{2}\/[^/]+\/index\.html$/i.test(url.pathname)) return null;
  if (source.linkPattern && !(new RegExp(source.linkPattern, 'i')).test(source.linkPattern.startsWith('^https:') ? url.href : url.pathname + url.search)) return null;
  return url.href;
}
function parseDate(value, now = new Date()) {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim(); let date;
  const months = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const numeric = raw.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  const portuguese = normalize(raw).match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(20\d{2})\b/);
  const isoDay = raw.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (numeric || portuguese || isoDay) {
    const year = Number(numeric?.[3] || portuguese?.[3] || isoDay[1]);
    const month = numeric ? Number(numeric[2]) : portuguese ? months.indexOf(portuguese[2]) + 1 : Number(isoDay[2]);
    const day = Number(numeric?.[1] || portuguese?.[1] || isoDay[3]);
    // A date-only source is stored at midday; the interface displays only its date.
    date = new Date(Date.UTC(year, month - 1, day, 16));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  } else {
    if (!/\d{4}/.test(raw)) return null;
    date = new Date(raw);
  }
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 2000 || date.getTime() > now.getTime() + 86400000) return null;
  return date;
}
function classifyArea(value, fallback = 'GERAL') {
  const valueText = normalize(value);
  for (const [key, regex] of [
    ['REFORMA_TRIBUTARIA', /reforma tributaria|\bcbs\b|\bibs\b/],
    ['SIMPLES_NACIONAL', /simples nacional|\bmei\b|microempreendedor|pgdas/],
    ['SPED', /\bsped\b|efd|ecf|escrituracao|reinf/],
    ['TRABALHISTA', /esocial|trabalhist|fgts|folha de pagamento|empregador/],
    ['PREVIDENCIARIO', /previdenci|\binss\b|aposentador/],
    ['CONTABIL', /norma.*contab|\bnbc\b|auditoria|cfc|contador/],
    ['TRIBUTARIO', /tribut|\bicms\b|\biss\b|\bipi\b|\bpis\b|cofins|imposto|convenio/],
    ['FISCAL', /nota fiscal|\bnf-e\b|nfs-e|nfce|sefaz|fiscal/],
  ]) if (regex.test(valueText)) return key;
  return AREAS.includes(fallback) ? fallback : 'GERAL';
}
function makeArticle(item, source, now) {
  const url = articleUrl(item.url, source), title = text(item.title, 300);
  if (!url || title.length < 15) return null;
  return { url, title, summary: text(item.summary || '', 420), publishedAt: parseDate(item.date, now), kind: source.kind || 'NEWS', area: classifyArea(title + ' ' + text(item.summary || ''), source.area), scope: source.scope, ufs: source.uf ? [source.uf] : [] };
}
function unique(items) { const map = new Map(); for (const item of items.filter(Boolean)) if (!map.has(item.url)) map.set(item.url, item); return [...map.values()].slice(0, 35); }
function parseFeed(input, source, now = new Date()) {
  bounded(input);
  if (/<!DOCTYPE|<!ENTITY/i.test(input)) throw new Error('Declaracoes de entidades nao sao permitidas.');
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true, processEntities: false });
  const root = parser.parse(input);
  const raw = root.rss?.channel?.item ?? root.feed?.entry;
  if (!root.rss && !root.feed) throw new Error('Feed nao reconhecido.');
  const entries = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return unique(entries.slice(0, 100).map((item) => {
    const links = Array.isArray(item.link) ? item.link : [item.link];
    const link = links.find((value) => typeof value === 'string' || value?.['@_rel'] === 'alternate' || !value?.['@_rel']);
    const string = (value) => typeof value === 'string' ? value : value?.['#text'] || '';
    return makeArticle({ title: string(item.title), url: typeof link === 'string' ? link : link?.['@_href'], summary: string(item.description || item.summary), date: string(item.pubDate || item.published || item.updated || item.date) }, source, now);
  }));
}
function parsePage(input, source, now = new Date()) {
  bounded(input, source.maxBytes || MAX_BYTES);
  if (/checking your browser|verify you are human|just a moment\.\.\./i.test(input.slice(0, 20000))) throw new Error('A fonte exige verificacao de acesso.');
  const $ = cheerio.load(input); $('script,style,nav,body > header,#portal-header,footer,aside,noscript').remove();
  const root = $('#content-core,main,#main-content,.main-content').first();
  const articles = [];
  (root.length ? root : $('body')).find('a[href]').each((index, element) => {
    const link = $(element), url = articleUrl(link.attr('href'), source);
    if (!url) return;
    let block = link.closest('article,.tileItem,.tile-item,.views-row,.news-item,.noticia,.post,.entry');
    if (!block.length) block = link.parent().parent();
    let title = link.find('h1,h2,h3,h4,.titulo').first().text().trim() || link.text().trim() || link.attr('title');
    title = title?.replace(/^Navegar para a not[ií]cia\s+/i, '').replace(/\s+20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/, '');
    if (/^(leia mais|saiba mais|ler mais|continue|acessar|ver mais)/i.test(title)) title = block.find('h1,h2,h3,h4').first().text();
    if (text(title, 300).length < 25 && source.kind !== 'LEGISLATION') return;
    const blockText = block.children().map((i, child) => $(child).text()).get().join(' ') || block.text();
    const date = block.find('time[datetime]').first().attr('datetime') || block.find('time,.summary-view-icon,.documentByLine,.date,.data,.published,.entry-date').first().text() || blockText.match(/\b\d{2}\/\d{2}\/20\d{2}\b/)?.[0] || blockText.match(/\b\d{1,2}\s+de\s+[a-zç]+\s+de\s+20\d{2}\b/i)?.[0] || blockText.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
    const summary = block.find('.description,.summary,.excerpt,.entry-summary,p').first().text();
    const article = makeArticle({ url, title, summary, date }, source, now);
    if (article) articles.push(article);
  });
  if (source.reverseListing) articles.sort((a, b) => Number(b.url.match(/CV(\d+)_/i)?.[1] || 0) - Number(a.url.match(/CV(\d+)_/i)?.[1] || 0));
  return unique(articles);
}
module.exports = { parseFeed, parsePage, articleUrl, trustedUrl, classifyArea, parseDate, AREAS, MAX_BYTES };
