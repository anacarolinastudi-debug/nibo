const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const { loginRateLimit } = require('../middleware/loginRateLimit');

router.post('/register-firm', loginRateLimit, ctrl.registerFirm); // cria escritório + admin
router.post('/login', loginRateLimit, ctrl.login);
router.post('/password-reset', loginRateLimit, ctrl.requestPasswordReset);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
