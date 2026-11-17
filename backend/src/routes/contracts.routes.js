const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/contracts.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

// Contratos de prestação de serviços: só a equipe do escritório.
router.use(requireAuth, requireRole('ADMIN', 'ACCOUNTANT'));

router.get('/settings', ctrl.getSettings);
router.put('/settings', requireRole('ADMIN'), ctrl.saveSettings);
router.get('/prefill/:cnpj', ctrl.prefill);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id/status', ctrl.updateStatus);
router.delete('/:id', requireRole('ADMIN'), ctrl.remove);
router.get('/:id/pdf', ctrl.pdf);

module.exports = router;
