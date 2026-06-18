const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clients.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.create);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.update);
router.delete('/:id', requireRole('ADMIN'), ctrl.remove);

module.exports = router;
