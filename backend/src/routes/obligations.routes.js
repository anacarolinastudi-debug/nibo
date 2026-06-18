const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/obligations.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(requireAuth);

router.get('/', ctrl.listObligations);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createObligation);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.updateObligation);
router.delete('/:id', requireRole('ADMIN'), ctrl.removeObligation);

router.get('/groups/list', ctrl.listGroups);
router.post('/groups', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createGroup);
router.put('/groups/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.updateGroup);
router.post('/groups/:id/link-clients', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.linkGroupToClients);
router.delete('/groups/:id', requireRole('ADMIN'), ctrl.removeGroup);

router.get('/links/matrix', ctrl.getLinksMatrix);
router.post('/links', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.upsertClientObligation);
router.delete('/links/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.removeClientObligation);

router.get('/robots/list', ctrl.listRobots);
router.post('/robots', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createRobot);
router.put('/robots/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.updateRobot);
router.delete('/robots/:id', requireRole('ADMIN'), ctrl.removeRobot);

router.get('/protocols/list', ctrl.listProtocols);
router.post('/conference/upload', requireRole('ADMIN', 'ACCOUNTANT'), upload.single('file'), ctrl.uploadConferenceFile);
router.post('/protocols/:id/confirm', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.confirmProtocol);

module.exports = router;
