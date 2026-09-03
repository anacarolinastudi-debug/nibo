// Criptografia simétrica (AES-256-GCM) usada para guardar o certificado
// digital e a senha dele no banco. Nunca armazenamos esses dados em texto
// puro — só o conteúdo criptografado, decifrado em memória no momento do uso.
const crypto = require('crypto');

function getKey() {
  const secret = process.env.CERT_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('CERT_ENCRYPTION_KEY não configurada neste ambiente.');
  }
  // Aceita tanto uma chave hex de 64 caracteres quanto qualquer string,
  // normalizando sempre para 32 bytes via hash.
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(buffer) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer, 'utf8');
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decrypt(encoded) {
  const key = getKey();
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { encrypt, decrypt, isConfigured: () => Boolean(process.env.CERT_ENCRYPTION_KEY) };
