const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/maintenance.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.post('/clear-registrations-keep-admin', requireRole('ADMIN'), ctrl.clearRegistrationsKeepAdmin);

module.exports = router;
