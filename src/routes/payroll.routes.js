const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payroll.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/employees', ctrl.listEmployees);
router.post('/employees', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createEmployee);

router.get('/entries', ctrl.listEntries);
router.post('/entries/generate', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.generateEntry);

module.exports = router;
