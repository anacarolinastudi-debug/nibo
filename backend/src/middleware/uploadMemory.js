const multer = require('multer');

// Usado para arquivos sensíveis (ex.: certificado digital) que nunca devem
// tocar o disco sem criptografia — ficam só em memória até serem
// criptografados e gravados no banco.
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = uploadMemory;
