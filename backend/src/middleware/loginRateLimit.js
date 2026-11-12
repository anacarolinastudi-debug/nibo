// Limita tentativas de login por IP e por e-mail para dificultar adivinhação de senha.
// Guardado em memória: suficiente para uma única instância do backend (Render).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_EMAIL = 8;

const buckets = new Map();

function hit(key, now) {
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, fresh);
    return fresh;
  }
  entry.count += 1;
  return entry;
}

function cleanup(now) {
  if (buckets.size < 5000) return;
  for (const [key, entry] of buckets) if (entry.resetAt <= now) buckets.delete(key);
}

function loginRateLimit(req, res, next) {
  const now = Date.now();
  cleanup(now);
  const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
  const email = String(req.body?.email || '').trim().toLowerCase();
  const byIp = hit(`ip:${ip}`, now);
  const byEmail = email ? hit(`email:${email}`, now) : null;
  const blocked = byIp.count > MAX_PER_IP || (byEmail && byEmail.count > MAX_PER_EMAIL);
  if (blocked) {
    const resetAt = Math.max(byIp.count > MAX_PER_IP ? byIp.resetAt : 0, byEmail && byEmail.count > MAX_PER_EMAIL ? byEmail.resetAt : 0);
    res.set('Retry-After', String(Math.ceil((resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' });
  }
  next();
}

module.exports = { loginRateLimit, _reset: () => buckets.clear() };
