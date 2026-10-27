const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/content.controller');
router.use(requireAuth, requireRole('ADMIN', 'ACCOUNTANT'));
router.use((req, res, next) => {
  if (!req.user.accountingFirmId) return res.status(403).json({ error: 'Escritorio nao identificado.' });
  next();
});
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
module.exports = router;
