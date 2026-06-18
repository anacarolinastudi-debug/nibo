# Deploy gratuito recomendado

## 1. Banco no Supabase

1. Crie um projeto em https://supabase.com.
2. Copie a connection string PostgreSQL em Project Settings > Database.
3. Use a connection string como `DATABASE_URL` no Render.
4. Inclua `?sslmode=require` no final se ainda nao existir.

## 2. Backend no Render

1. Suba este projeto para um repositório GitHub.
2. No Render, escolha New > Blueprint e selecione o repo.
3. O arquivo `render.yaml` cria o serviço `nibo-clone-api`.
4. Configure as variáveis:
   - `DATABASE_URL`: string do Supabase.
   - `FRONTEND_URL`: URL final da Vercel.
   - `JWT_SECRET`: pode usar o gerado pelo Render.
5. O build roda `prisma migrate deploy` automaticamente.

## 3. Frontend na Vercel

1. Na Vercel, importe o mesmo repositório.
2. Configure:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Variável:
   - `VITE_API_URL=https://SEU-BACKEND.onrender.com/api`

## 4. Rodar seed opcional

No Render Shell ou localmente com `DATABASE_URL` do Supabase:

```bash
cd backend
npm run seed
```

Logins de exemplo criados pelo seed:

- `admin@exemplo.com` / `senha123`
- `contador@exemplo.com` / `senha123`
- `joao@paoquente.com.br` / `senha123`

## Observação sobre PDFs

O backend já cria registros de conferência e protocolo. O upload local funciona em desenvolvimento, mas em hospedagem gratuita o armazenamento local não é ideal. O próximo passo recomendado é ligar o upload ao Supabase Storage usando as variáveis já previstas em `backend/.env.example`.
