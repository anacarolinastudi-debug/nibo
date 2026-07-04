const jwt = require('jsonwebtoken');

const fallbackSecret = 'contabil-gestao-fallback-secret';

function getJwtSecret() {
  return process.env.JWT_SECRET || fallbackSecret;
}

function generateToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = { generateToken, verifyToken };
