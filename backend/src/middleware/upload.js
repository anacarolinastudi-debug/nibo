const multer = require('multer');

// O arquivo fica em memória só até ser gravado pelo serviço de armazenamento
// (services/fileStorage.service.js), que usa o Supabase Storage em produção.
// Limite de 15MB por arquivo.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

module.exports = upload;
