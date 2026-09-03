const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/users.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.list);
router.post('/', requireRole('ADMIN'), ctrl.create);
router.put('/:id', requireRole('ADMIN'), ctrl.update);
router.delete('/:id', requireRole('ADMIN'), ctrl.deactivate);

module.exports = router;
