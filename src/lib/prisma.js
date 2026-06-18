const { PrismaClient } = require('@prisma/client');

// Instância única do Prisma reaproveitada em toda a aplicação.
// Evita abrir uma conexão nova com o banco em cada requisição.
const prisma = new PrismaClient();

module.exports = prisma;
