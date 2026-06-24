const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ecac.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/status', ctrl.getStatus);
router.get('/checks', ctrl.listChecks);
router.get('/clients/latest', ctrl.getLatestByClient);
router.post('/clients/:clientId/sync', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.runCheckForClient);

module.exports = router;
