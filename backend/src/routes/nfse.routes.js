const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/nfse.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const uploadMemory = require('../middleware/uploadMemory');

// XMLs de NFS-e e certificados das empresas: só a equipe do escritório.
router.use(requireAuth, requireRole('ADMIN', 'ACCOUNTANT'));
// Notas mudam a cada busca: o navegador não pode guardar respostas (um
// "arquivos indisponíveis" antigo ficava no cache depois da recuperação).
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/clients', ctrl.listClients);
router.post('/clients/:clientId/certificate', uploadMemory.single('file'), ctrl.uploadCertificate);
router.delete('/clients/:clientId/certificate', ctrl.removeCertificate);
router.post('/clients/:clientId/sync', ctrl.syncNow);
router.get('/clients/:clientId/documents', ctrl.listDocuments);
router.get('/clients/:clientId/zip', ctrl.downloadZip);
router.get('/documents/:id/xml', ctrl.downloadXml);

module.exports = router;
