const fileStorage = require('../services/fileStorage.service');

// Envia ao navegador um arquivo guardado, depois que a rota já conferiu a permissão.
async function sendStoredFile(res, ref, fileName, mimeType) {
  const buffer = await fileStorage.readFile(ref);
  if (!buffer) {
    return res.status(404).json({ error: 'O arquivo não está mais disponível no armazenamento.' });
  }
  const safeName = String(fileName || 'arquivo').replace(/["\r\n]/g, '');
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `inline; filename="${safeName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(buffer);
}

module.exports = { sendStoredFile };
