require('dotenv').config();
require('express-async-errors'); // permite usar async/await nas rotas sem try/catch repetitivo

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const clientsRoutes = require('./routes/clients.routes');
const demandsRoutes = require('./routes/demands.routes');
const usersRoutes = require('./routes/users.routes');
const financialRoutes = require('./routes/financial.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const payrollRoutes = require('./routes/payroll.routes');
const documentsRoutes = require('./routes/documents.routes');
const obligationsRoutes = require('./routes/obligations.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Disponibiliza os arquivos enviados (documentos) publicamente via URL
app.use('/uploads', express.static('uploads'));

// Rota de saúde, útil para checar se o servidor está de pé depois do deploy
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/demands', demandsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/obligations', obligationsRoutes);

// Precisa ser o último middleware
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
