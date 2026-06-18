// Captura qualquer erro lançado nas rotas (graças ao express-async-errors)
// e devolve uma resposta JSON consistente, sem quebrar o servidor.
function errorHandler(err, req, res, next) {
  console.error(err);

  // Erros de validação do Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Dados inválidos.',
      details: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
  }

  // Erros conhecidos do Prisma (ex.: violação de unique)
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Já existe um registro com esse valor único (ex.: CNPJ ou e-mail).' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro não encontrado.' });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Erro interno do servidor.' : err.message;
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
