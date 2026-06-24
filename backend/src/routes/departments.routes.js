const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/departments.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.listDepartments);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createDepartment);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.updateDepartment);
router.delete('/:id', requireRole('ADMIN'), ctrl.removeDepartment);

router.get('/client-matrix/list', ctrl.getClientMatrix);
router.post('/client-matrix', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.upsertClientMatrix);

router.get('/firm-roles/list', ctrl.listFirmRoles);
router.post('/firm-roles', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createFirmRole);
router.delete('/firm-roles/:id', requireRole('ADMIN'), ctrl.removeFirmRole);

module.exports = router;
