const { Parser } = require('htmlparser2');
const { articleUrl, trustedUrl, classifyArea, parseDate } = require('./accountingNewsParser');
const { fetchSourceText } = require('./accountingNews.service');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function locations(xml) {
  if (Buffer.byteLength(xml) > 4 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Arquivo historico fora dos limites permitidos.');
  const values = []; let inside = false, value = '';
  const parser = new Parser({
    onopentag(name) { if (name === 'loc') { inside = true; value = ''; } },
    ontext(text) { if (inside) value = (value + text).slice(0, 2049); },
    onclosetag(name) { if (name === 'loc') { inside = false; if (values.length < 15000) values.push(value.trim()); } },
  }, { xmlMode: true, decodeEntities: true });
  parser.write(xml); parser.end(); return values;
}

function metadata(html, url, source) {
  if (!articleUrl(url, source) || Buffer.byteLength(html) > 2 * 1024 * 1024) return null;
  const meta = {};
  const parser = new Parser({ onopentag(name, attrs) {
    if (name !== 'meta') return;
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (attrs.content && !meta[key]) meta[key] = attrs.content.replace(/\s+/g, ' ').trim().slice(0, 1000);
  } }, { decodeEntities: true });
  parser.write(html); parser.end();
  const title = meta['og:title']?.slice(0, 300);
  if (!title || title.length < 15 || /captcha|access denied|just a moment/i.test(title)) return null;
  const summary = (meta['og:description'] || meta.description || '').slice(0, 420);
  return { url, title, summary, publishedAt: parseDate(meta['article:published_time']), kind: source.kind, area: classifyArea(title + ' ' + summary, source.area), scope: source.scope, ufs: [] };
}

async function searchArchive({ input, sources, fetchText = fetchSourceText }) {
  const source = sources.find(value => value.id === 'portal-contabeis');
  const terms = [...new Set(normalize(input.q || '').split(/[^a-z0-9]+/).filter(value => value.length > 1))].slice(0, 20);
  if (!source || !terms.length) return [];
  const deadline = Date.now() + 30000;
  const read = async (url, maxBytes) => {
    if (Date.now() >= deadline) throw new Error('Tempo da consulta historica excedido.');
    return fetchText({ ...source, feedUrl: url, maxBytes, timeoutMs: Math.max(1, Math.min(7000, deadline - Date.now())) });
  };
  const index = await read('https://www.contabeis.com.br/sitemap.xml', 2 * 1024 * 1024);
  const maps = [...new Set(locations(index.body))].filter(value => {
    const url = trustedUrl(value, source);
    return url && /^\/assets\/sitemap\/sitemap_ctd\d+\.xml$/.test(url.pathname);
  }).sort((a, b) => Number(b.match(/ctd(\d+)/)[1]) - Number(a.match(/ctd(\d+)/)[1])).slice(0, 2);
  const urls = new Set();
  for (const map of maps) {
    const archive = await read(map, 4 * 1024 * 1024);
    for (const value of locations(archive.body)) {
      const url = articleUrl(value, source);
      if (!url) continue;
      let path; try { path = normalize(decodeURIComponent(new URL(url).pathname)); } catch { continue; }
      if (terms.every(term => path.includes(term))) urls.add(url);
    }
  }
  const items = [];
  for (const url of [...urls].slice(-6).reverse()) {
    try {
      const response = await read(url, 2 * 1024 * 1024);
      const item = metadata(response.body, response.url || url, source);
      if (item) items.push({ source, item });
    } catch { /* An unavailable article must not discard other verified matches. */ }
  }
  return items;
}
module.exports = { searchArchive };
