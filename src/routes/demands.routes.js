const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/demands.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/status', ctrl.updateStatus);
router.post('/:id/comments', ctrl.addComment);
router.delete('/:id', ctrl.remove);

module.exports = router;
