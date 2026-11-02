const jwt = require('jsonwebtoken');
const { createHmac } = require('node:crypto');
const cheerio = require('cheerio');
const { logoDataUrl } = require('../utils/firmLogo');
const cache = new Map();
const fail = (message, status = 503) => Object.assign(new Error(message), { status });
const selectionKey = () => {
  if (!process.env.JWT_SECRET) throw fail('A selecao de imagens precisa ser configurada no servidor.');
  return createHmac('sha256', process.env.JWT_SECRET).update('young/content-photo/signing-key/v1').digest();
};
const cleanQuery = value => value.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
const plain = value => cheerio.load(String(value || '').slice(0, 5000), null, false).text().replace(/\s+/g, ' ').trim();
function mediaUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.port && !url.username && !url.password && ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname) && url.pathname.startsWith('/wikipedia/commons/') ? url.href : null; } catch { return null; }
}
function publicQuery(value) {
  const clean = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [pattern, query] of [[/cnpj|\bmei\b|empreend|negocio|empresa/, 'small business entrepreneur'], [/imposto|tribut|fiscal|reforma/, 'tax paperwork'], [/financ|dinheiro|receita|despesa|orcamento/, 'finance calculator'], [/contab|balanco/, 'accounting calculator'], [/trabalh|empreg|folha|fgts/, 'office teamwork'], [/planej|organiz/, 'office desk']]) if (pattern.test(clean)) return query;
  return cleanQuery(value);
}
async function searchImages(query, firmId, { fetchImpl = globalThis.fetch, automatic = false } = {}) {
  const term = automatic ? publicQuery(query) : cleanQuery(query);
  if (!term) return { query: term, items: [] };
  let cached = cache.get(term);
  if (!cached || cached.expires < Date.now()) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${term} filetype:bitmap -intitle:logo -intitle:map -intitle:diagram`, gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl', iiurlwidth: '960', format: 'json' });
    let response;
    try { response = await fetchImpl(url.href, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'YoungContabilContent/1.0 (https://nibo-ten.vercel.app; image search)' } }); }
    catch { throw fail('O acervo de imagens esta indisponivel. Tente outra busca ou envie uma foto.'); }
    if (!response.ok) throw fail('Nao foi possivel consultar as imagens. Tente novamente mais tarde.', response.status === 429 ? 429 : 503);
    const data = await response.json();
    const items = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).flatMap(page => {
      const info = page.imageinfo?.[0], meta = info?.extmetadata || {};
      const license = plain(meta.LicenseShortName?.value);
      const url = mediaUrl(info?.thumburl);
      if (!url || !/^image\/(jpeg|png|webp)$/.test(info.mime) || info.width < 500 || info.height < 500 || !/^(CC0|Public domain|CC BY(?: |$))/i.test(license) || /BY-SA|BY-NC|BY-ND/i.test(license) || !Number.isSafeInteger(page.pageid) || page.pageid < 1) return [];
      const licenseUrl = String(meta.LicenseUrl?.value || '');
      return [{ id: String(page.pageid), title: plain(page.title.replace(/^File:/, '')).slice(0, 200), url, creator: plain(meta.Artist?.value).slice(0, 120) || 'Wikimedia Commons', license: license.slice(0, 50), licenseUrl: /^https:\/\/creativecommons.org\//.test(licenseUrl) ? licenseUrl : '', sourceUrl: `https://commons.wikimedia.org/?curid=${page.pageid}` }];
    }).slice(0, 6);
    cached = { expires: Date.now() + 15 * 60000, items }; cache.set(term, cached);
    if (cache.size > 80) cache.delete(cache.keys().next().value);
  }
  return { query: term, items: cached.items.map(item => ({ ...item, token: jwt.sign({ ...item, firmId }, selectionKey(), { expiresIn: '30m', audience: 'content-photo', issuer: 'young-content' }) })) };
}
async function selectImage(token, firmId, { fetchImpl = globalThis.fetch } = {}) {
  let item;
  try { item = jwt.verify(token, selectionKey(), { algorithms: ['HS256'], audience: 'content-photo', issuer: 'young-content' }); } catch { throw fail('A selecao da imagem expirou. Pesquise novamente.', 400); }
  if (item.firmId !== firmId || !mediaUrl(item.url)) throw fail('Selecao de imagem invalida.', 400);
  let response;
  try { response = await fetchImpl(item.url, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'YoungContabilContent/1.0 (https://nibo-ten.vercel.app; image import)' } }); }
  catch { throw fail('Nao foi possivel carregar a imagem. Escolha outra foto.'); }
  if (!response.ok) throw fail('A imagem esta indisponivel. Escolha outra foto.');
  const limit = 2 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw fail('A imagem ultrapassa o limite de 2 MB.', 400); }
  const chunks = []; let length = 0;
  for await (const chunk of response.body) { length += chunk.length; if (length > limit) throw fail('A imagem ultrapassa o limite de 2 MB.', 400); chunks.push(chunk); }
  const dataUrl = logoDataUrl(Buffer.concat(chunks));
  if (!/^data:image\/(jpeg|png|webp);/.test(dataUrl)) throw fail('Formato de imagem nao permitido.', 400);
  const { title, creator, license, licenseUrl, sourceUrl } = item;
  return { dataUrl, title, creator, license, licenseUrl, sourceUrl };
}
module.exports = { searchImages, selectImage };
