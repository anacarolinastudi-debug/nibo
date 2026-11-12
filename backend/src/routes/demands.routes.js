const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/demands.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

// Modelos, processos e responsabilidades são da equipe do escritório.
// Usuários do portal do cliente só lidam com as próprias demandas.
const staffOnly = requireRole('ADMIN', 'ACCOUNTANT');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/templates/list', staffOnly, ctrl.listTemplates);
router.post('/templates', staffOnly, ctrl.createTemplate);
router.put('/templates/:id', staffOnly, ctrl.updateTemplate);
router.delete('/templates/:id', staffOnly, ctrl.removeTemplate);
router.get('/processes/list', staffOnly, ctrl.listProcesses);
router.post('/processes', staffOnly, ctrl.createProcess);
router.put('/processes/:id', staffOnly, ctrl.updateProcess);
router.get('/process-templates/list', staffOnly, ctrl.listProcessTemplates);
router.post('/process-templates', staffOnly, ctrl.createProcessTemplate);
router.put('/process-templates/:id', staffOnly, ctrl.updateProcessTemplate);
router.post('/responsibilities/transfer', staffOnly, ctrl.transferResponsibilities);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/status', ctrl.updateStatus);
router.post('/:id/comments', ctrl.addComment);
router.delete('/:id', staffOnly, ctrl.remove);

module.exports = router;
