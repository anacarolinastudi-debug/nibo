const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/whatsapp.controller');
const { requireAuth } = require('../middleware/auth');

// Endpoints públicos exigidos pela Meta (sem autenticação de usuário).
router.get('/webhook', ctrl.verifyWebhook);
router.post('/webhook', ctrl.receiveWebhook);

router.use(requireAuth);

router.get('/status', ctrl.getStatus);
router.get('/conversations', ctrl.listConversations);
router.post('/conversations', ctrl.createConversation);
router.get('/conversations/:id/messages', ctrl.getConversationMessages);
router.post('/conversations/:id/messages', ctrl.sendMessage);

module.exports = router;
