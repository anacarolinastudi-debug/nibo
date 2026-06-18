const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/documents.controller');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', upload.single('file'), ctrl.upload);
router.delete('/:id', ctrl.remove);

module.exports = router;
