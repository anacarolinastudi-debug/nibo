const jwt = require('jsonwebtoken');

// Chave reserva só para desenvolvimento local. Em produção (Render ou
// NODE_ENV=production) a ausência de JWT_SECRET impede o servidor de emitir
// ou aceitar tokens, em vez de usar uma chave conhecida por qualquer pessoa.
const devFallbackSecret = 'contabil-gestao-dev-only-secret';

function isProduction() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isProduction()) throw new Error('JWT_SECRET não configurada neste ambiente.');
  return devFallbackSecret;
}

function generateToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = { generateToken, verifyToken, getJwtSecret, isProduction };
