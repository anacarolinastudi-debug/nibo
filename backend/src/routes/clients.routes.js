const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clients.controller');
const { lookupCnpj } = require('../services/cnpjLookup.service');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/contacts/list', ctrl.listContacts);
router.post('/setup/clear', requireRole('ADMIN'), ctrl.clearForSetup);
router.post('/contacts', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createContact);
router.put('/contacts/:contactId', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.updateContact);
router.delete('/contacts/:contactId', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.removeContact);
// Dados públicos da Receita Federal para preencher o cadastro pelo CNPJ.
router.get('/cnpj-lookup/:cnpj', requireRole('ADMIN', 'ACCOUNTANT'), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await lookupCnpj(req.params.cnpj));
});
router.get('/:id', ctrl.getById);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.create);
router.put('/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.update);
router.delete('/:id', requireRole('ADMIN'), ctrl.remove);

module.exports = router;
