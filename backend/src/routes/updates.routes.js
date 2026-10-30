const router = require('express').Router();
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { AREAS } = require('../services/accountingNewsParser');
const { requestSync, getStatus } = require('../services/accountingNews.service');
const { searchOnline, cachedSearch, presentSearch, queryTerms } = require('../services/accountingNewsOnline.service');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const parsed = new Date(value + 'T00:00:00Z'); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; });
const filters = z.object({ q: z.string().max(200).optional(), area: z.enum(AREAS).optional(), kind: z.enum(['NEWS', 'LEGISLATION']).optional(), scope: z.enum(['FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'NACIONAL']).optional(), uf: z.string().regex(/^[A-Z]{2}$/).optional(), source: z.string().max(100).optional(), from: date.optional(), to: date.optional(), read: z.enum(['all', 'unread', 'read']).optional(), bookmarked: z.enum(['true', 'false']).optional(), page: z.coerce.number().int().min(1).max(100000).default(1) }).refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'Periodo invalido.' });

function articleWhere(input, own, cached) {
  const terms = queryTerms(input.q);
  return { ...(input.q ? { OR: [...(terms.length ? [{ AND: terms.map(term => ({ searchText: { contains: term } })) }] : [{ id: { in: [] } }]), ...(cached?.articleIds.length ? [{ id: { in: cached.articleIds } }] : [])] } : {}),
    ...Object.fromEntries(['area', 'kind', 'scope'].filter(key => input[key]).map(key => [key, input[key]])),
    ...(input.uf ? { ufs: { has: input.uf } } : {}), ...(input.source ? { sourceId: input.source } : {}),
    ...(input.from || input.to ? { publishedAt: { ...(input.from ? { gte: new Date(input.from + 'T00:00:00-04:00') } : {}), ...(input.to ? { lt: new Date(new Date(input.to + 'T00:00:00-04:00').getTime() + 86400000) } : {}) } } : {}),
    AND: [...(input.read === 'read' ? [{ states: { some: { ...own, read: true } } }] : []), ...(input.read === 'unread' ? [{ states: { none: { ...own, read: true } } }] : []), ...(input.bookmarked === 'true' ? [{ states: { some: { ...own, bookmarked: true } } }] : [])],
  };
}

router.get('/daily', async (req, res) => res.json(await getStatus(false)));
router.post('/daily', async (req, res) => res.json(await requestSync({ daily: true })));
router.use(requireAuth, requireRole('ADMIN', 'ACCOUNTANT'));
router.use(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { accountingFirmId: true, role: true, active: true } });
  if (!user?.active || !user.accountingFirmId || !['ADMIN', 'ACCOUNTANT'].includes(user.role) || user.accountingFirmId !== req.user.accountingFirmId) return res.status(403).json({ error: 'Acesso restrito a equipe do escritorio.' });
  next();
});
router.get('/status', async (req, res) => res.json(await getStatus()));
router.post('/search', async (req, res) => {
  const body = req.body || {};
  const input = filters.parse({ ...body, bookmarked: typeof body.bookmarked === 'boolean' ? String(body.bookmarked) : body.bookmarked });
  if (!input.q || input.q.trim().length < 2) return res.status(400).json({ error: 'Informe pelo menos dois caracteres para pesquisar online.' });
  if (input.bookmarked === 'true' || input.read === 'read') return res.json({ status: 'SKIPPED', discovered: 0, sources: [], attribution: null });
  const own = { userId: req.user.id, accountingFirmId: req.user.accountingFirmId };
  const cached = await cachedSearch(req.user.accountingFirmId, input);
  if (await prisma.newsArticle.count({ where: articleWhere(input, own, cached) })) return res.json({ status: 'LOCAL', discovered: 0, sources: [], attribution: null });
  const result = await searchOnline(req.user.accountingFirmId, input);
  res.json(result);
});
router.post('/refresh', async (req, res) => {
  const result = await requestSync();
  if (!result.queued && result.state !== 'RUNNING') return res.status(429).set('Retry-After', '1800').json({ error: 'Aguarde ate 30 minutos entre atualizacoes. O historico continua disponivel.' });
  res.json(result);
});
router.get('/articles/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const article = await prisma.newsArticle.findUnique({ where: { id }, select: { id: true, title: true, summary: true, url: true, publishedAt: true, source: { select: { name: true, url: true } } } });
  if (!article) return res.status(404).json({ error: 'Publicacao nao encontrada.' });
  res.json(article);
});
router.get('/articles', async (req, res) => {
  const input = filters.parse(req.query);
  const own = { userId: req.user.id, accountingFirmId: req.user.accountingFirmId };
  const cached = input.q?.trim().length >= 2 ? await cachedSearch(req.user.accountingFirmId, input) : null;
  const where = articleWhere(input, own, cached);
  const pageSize = 25;
  const [items, total] = await prisma.$transaction([prisma.newsArticle.findMany({ where, orderBy: [{ source: { priority: 'desc' } }, { sortDate: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * pageSize, take: pageSize, include: { source: { select: { id: true, name: true, url: true } }, states: { where: own, select: { read: true, bookmarked: true } } } }), prisma.newsArticle.count({ where })]);
  res.json({ items: items.map(({ states, sourceId, searchText, sortDate, updatedAt, ...item }) => ({ ...item, read: states[0]?.read || false, bookmarked: states[0]?.bookmarked || false })), total, page: input.page, pageSize, online: cached ? presentSearch(cached, true) : null });
  requestSync({ daily: true }).catch(() => {});
});
router.patch('/articles/:id/state', async (req, res) => {
  const articleId = z.string().uuid().parse(req.params.id);
  const input = z.object({ read: z.boolean().optional(), bookmarked: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0).parse(req.body);
  if (!await prisma.newsArticle.findUnique({ where: { id: articleId }, select: { id: true } })) return res.status(404).json({ error: 'Publicacao nao encontrada.' });
  const state = await prisma.newsArticleState.upsert({ where: { accountingFirmId_userId_articleId: { accountingFirmId: req.user.accountingFirmId, userId: req.user.id, articleId } }, create: { ...input, articleId, userId: req.user.id, accountingFirmId: req.user.accountingFirmId }, update: input });
  res.json({ articleId, read: state.read, bookmarked: state.bookmarked });
});
module.exports = router;
