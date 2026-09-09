const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/whatsapp.controller');
const { requireAuth } = require('../middleware/auth');

// Endpoints públicos exigidos pela Meta (sem autenticação de usuário).
router.get('/webhook', ctrl.verifyWebhook);
router.post('/webhook', ctrl.receiveWebhook);
router.post('/evolution/webhook', ctrl.receiveEvolutionWebhook);

router.use(requireAuth);

router.get('/status', ctrl.getStatus);
router.post('/evolution/connect', ctrl.connectEvolution);
router.get('/evolution/state', ctrl.testEvolutionConnection);
router.get('/evolution/webhook', ctrl.getEvolutionWebhook);
router.get('/evolution/qr', ctrl.getEvolutionQr);
router.get('/conversations', ctrl.listConversations);
router.post('/conversations', ctrl.createConversation);
router.get('/conversations/:id/messages', ctrl.getConversationMessages);
router.post('/conversations/:id/messages', ctrl.sendMessage);

module.exports = router;
