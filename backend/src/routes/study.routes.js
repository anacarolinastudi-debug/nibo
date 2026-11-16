const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

// Progresso do cronograma de estudos (aba Estudos). Cada pessoa da equipe tem
// o seu registro por plano; o conteúdo é só o que ela marcou na página.
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.use(requireAuth, requireRole('ADMIN', 'ACCOUNTANT'));

const plan = z.string().regex(/^[a-z0-9-]{1,60}$/);
const id = z.string().regex(/^w\d{1,2}[dq]\d{1,2}$/);
const progress = z.object({
  done: z.array(id).max(300),
  answers: z.record(id, z.number().int().min(0).max(3)).refine((value) => Object.keys(value).length <= 300),
  graded: z.record(z.string().regex(/^\d{1,2}$/), z.boolean()).refine((value) => Object.keys(value).length <= 60),
});

router.get('/progress/:plan', async (req, res) => {
  const key = plan.safeParse(req.params.plan);
  if (!key.success) return res.status(400).json({ error: 'Plano invalido.' });
  const row = await prisma.studyProgress.findUnique({ where: { userId_plan: { userId: req.user.id, plan: key.data } } });
  res.json(row ? { data: row.data, updatedAt: row.updatedAt } : { data: null, updatedAt: null });
});

router.put('/progress/:plan', async (req, res) => {
  const key = plan.safeParse(req.params.plan);
  const body = progress.safeParse(req.body);
  if (!key.success || !body.success) return res.status(400).json({ error: 'Progresso invalido.' });
  const data = { done: [...new Set(body.data.done)], answers: body.data.answers, graded: body.data.graded };
  const row = await prisma.studyProgress.upsert({
    where: { userId_plan: { userId: req.user.id, plan: key.data } },
    create: { userId: req.user.id, plan: key.data, data },
    update: { data },
  });
  res.json({ updatedAt: row.updatedAt });
});

module.exports = router;
