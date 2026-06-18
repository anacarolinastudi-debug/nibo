# Contábil Gestão — Sistema de Gestão Contábil

Sistema web para escritórios de contabilidade gerenciarem demandas, clientes,
financeiro, notas fiscais e folha de pagamento — inspirado no Nibo.

## Como o projeto está organizado

```
nibo-clone/
├── backend/      → API (Node.js + Express + Prisma + PostgreSQL)
├── frontend/     → Interface web (React + Vite + Tailwind)
└── docker-compose.yml → PostgreSQL local, pronto pra usar
```

## O que já está implementado

- Modelo de dados completo no banco (`backend/prisma/schema.prisma`), com todas
  as tabelas e relações: escritórios, usuários, clientes, demandas,
  documentos, financeiro, notas fiscais e folha de pagamento.
- Autenticação por login/senha com token (JWT), com 3 perfis: ADMIN, ACCOUNTANT (contador) e CLIENT (portal do cliente). Tela de cadastro do escritório (`/registrar`).
- **Gestão de demandas** completa (criar, listar, mudar status, comentar) — front-end em formato kanban.
- **Cadastro de clientes** (empresas atendidas pelo escritório).
- **Financeiro**: contas bancárias, plano de contas (categorias), lançamentos de receita/despesa, baixa de pagamento com atualização automática de saldo, resumo mensal.
- **Notas fiscais**: emissão de NF-e/NFS-e como registro interno (com itens e cálculo de total), fluxo rascunho → emitida/cancelada.
- **Folha de pagamento**: cadastro de funcionários e geração de folha mensal com cálculo de INSS, IRRF, FGTS e salário líquido.
- **Documentos**: upload de arquivos (notas, extratos, contratos etc.) com metadados, armazenados localmente em `backend/uploads`.
- Multi-tenant: cada escritório só vê os próprios dados; usuários do portal do cliente só veem os dados da própria empresa.

### Avisos importantes

- **Notas fiscais**: o "número" e status aqui são apenas controle interno. Emissão real perante a SEFAZ exige um provedor homologado de NF-e/NFS-e (ex.: eNotas, Focus NFe, PlugNotas) — integração que pode ser adicionada depois.
- **Folha de pagamento**: as faixas de INSS/IRRF usadas no cálculo (`backend/src/utils/payrollCalculator.js`) são baseadas em valores de 2024/2025 e servem para o sistema funcionar de ponta a ponta. Antes de usar com dados reais, um contador precisa validar e atualizar essas faixas com a legislação vigente.
- **Upload de documentos**: hoje os arquivos ficam salvos no disco do próprio servidor (pasta `backend/uploads`). Em produção, se for armazenar muitos arquivos, vale migrar para um serviço de armazenamento (ex.: S3, Cloudflare R2) — posso te ajudar nessa adaptação quando chegar a hora.

### Possíveis próximos passos

Relatórios/exportações mais elaborados (ex.: balancete em PDF), gestão de
usuários internos pela interface (hoje só via API), conciliação bancária via
Open Finance, e a integração real de emissão de notas fiscais. Me avise qual
desses é prioridade e eu continuo.

## Passo a passo para rodar na sua máquina

### 1. Pré-requisitos
Instale, se ainda não tiver:
- [Node.js](https://nodejs.org) versão 18 ou superior
- [Docker](https://www.docker.com/) (mais fácil pra rodar o banco) — ou um PostgreSQL instalado manualmente

### 2. Subir o banco de dados
Na pasta raiz do projeto:
```bash
docker compose up -d
```
Isso cria um banco PostgreSQL local na porta 5432, com usuário `postgres` e senha `senha123`.

### 3. Configurar e rodar o backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # cria as tabelas no banco
npm run seed                         # popula com dados de exemplo (opcional)
npm run dev                          # inicia a API em http://localhost:4000
```

### 4. Configurar e rodar o frontend
Em outro terminal:
```bash
cd frontend
npm install
npm run dev   # inicia em http://localhost:5173
```

### 5. Acessar
Abra `http://localhost:5173` no navegador. Se você rodou o `npm run seed`, use:
- **Admin do escritório:** admin@exemplo.com / senha123
- **Contador:** contador@exemplo.com / senha123
- **Portal do cliente:** joao@paoquente.com.br / senha123

Se preferir não usar o seed, crie a primeira conta chamando a rota
`POST /api/auth/register-firm` (veja o corpo esperado em `backend/src/controllers/auth.controller.js`) — uma tela de cadastro também pode ser adicionada ao frontend.

## Quando for colocar no seu servidor (produção)

1. **Banco de dados**: contrate um PostgreSQL gerenciado (Railway, Render, Supabase, RDS da AWS, ou um PostgreSQL instalado no seu próprio servidor) e coloque a string de conexão na variável `DATABASE_URL`.
2. **Backend**: pode rodar com `npm run prisma:deploy` (aplica as migrações sem perguntar nada, ideal pra produção) seguido de `npm start`. Hospede em qualquer servidor que rode Node.js (uma VPS, Railway, Render, ou um servidor próprio com PM2/Docker).
3. **Frontend**: rode `npm run build` dentro de `frontend/`, isso gera uma pasta `dist/` com arquivos estáticos prontos — pode subir em qualquer hospedagem de site estático (Vercel, Netlify, Cloudflare Pages, ou o próprio servidor via Nginx).
4. Configure `FRONTEND_URL` no backend e `VITE_API_URL` no frontend (variável de ambiente) para apontarem um pro outro, com os endereços reais.
5. **Segurança**: troque o `JWT_SECRET` por um valor aleatório forte antes de ir pra produção, e nunca exponha o arquivo `.env`.

Quando chegar nessa etapa, me avise — posso te ajudar a revisar a configuração antes do deploy ou adaptar para a hospedagem específica que você escolher.
