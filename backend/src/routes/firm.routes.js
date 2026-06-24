const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/firm.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadMemory = require('../middleware/uploadMemory');

router.use(requireAuth);

router.get('/', ctrl.getFirm);
router.put('/', requireRole('ADMIN'), ctrl.updateFirm);
router.post('/logo', requireRole('ADMIN'), upload.single('file'), ctrl.uploadLogo);
router.post('/certificate', requireRole('ADMIN'), uploadMemory.single('file'), ctrl.uploadCertificate);
router.delete('/certificate', requireRole('ADMIN'), ctrl.removeCertificate);

module.exports = router;
