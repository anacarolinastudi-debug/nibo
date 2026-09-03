const { verifyToken } = require('../utils/jwt');

// Garante que a requisição tem um token válido e popula req.user.
// req.user passa a conter: id, role, accountingFirmId, clientId (se for usuário do portal)
function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não enviado.' });
  }

  const token = header.replace('Bearer ', '');

  try {
    const payload = verifyToken(token);
    // O token guarda o id do usuário em "sub" (padrão JWT). Expomos também
    // como "id" porque boa parte dos controllers usa req.user.id.
    req.user = { ...payload, id: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// Restringe uma rota a determinados papéis (roles).
// Uso: requireRole('ADMIN', 'ACCOUNTANT')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Você não tem permissão para essa ação.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
