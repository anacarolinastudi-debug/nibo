const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/demands.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/templates/list', ctrl.listTemplates);
router.post('/templates', ctrl.createTemplate);
router.put('/templates/:id', ctrl.updateTemplate);
router.delete('/templates/:id', ctrl.removeTemplate);
router.get('/processes/list', ctrl.listProcesses);
router.post('/processes', ctrl.createProcess);
router.put('/processes/:id', ctrl.updateProcess);
router.get('/process-templates/list', ctrl.listProcessTemplates);
router.post('/process-templates', ctrl.createProcessTemplate);
router.put('/process-templates/:id', ctrl.updateProcessTemplate);
router.post('/responsibilities/transfer', ctrl.transferResponsibilities);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/status', ctrl.updateStatus);
router.post('/:id/comments', ctrl.addComment);
router.delete('/:id', ctrl.remove);

module.exports = router;
