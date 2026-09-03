const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/invoices.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.create);
router.patch('/:id/issue', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.issue);
router.patch('/:id/cancel', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.cancel);

module.exports = router;
