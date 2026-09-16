const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financial.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/summary', ctrl.summary);

router.get('/accounts', ctrl.listAccounts);
router.post('/accounts', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createAccount);

router.get('/categories', ctrl.listCategories);
router.post('/categories', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createCategory);

router.get('/transactions', ctrl.listTransactions);
router.post('/transactions', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createTransaction);
router.patch('/transactions/:id/pay', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.markPaid);

router.get('/receipts', ctrl.listReceipts);
router.post('/receipts', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createReceipt);
router.get('/receipts/:id/pdf', ctrl.receiptPdf);

module.exports = router;
