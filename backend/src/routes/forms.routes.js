const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/forms.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.listForms);
router.get('/:id', ctrl.getForm);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createForm);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.updateForm);
router.patch('/:id/status', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.toggleFormStatus);
router.delete('/:id', requireRole('ADMIN'), ctrl.removeForm);

module.exports = router;
