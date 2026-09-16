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
router.delete('/transactions/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.removeTransaction);

router.get('/receipts', ctrl.listReceipts);
router.post('/receipts', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.createReceipt);
router.put('/receipts/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.updateReceipt);
router.get('/receipts/:id/pdf', ctrl.receiptPdf);
router.delete('/receipts/:id', requireRole('ADMIN', 'ACCOUNTANT'), ctrl.removeReceipt);

module.exports = router;
