# Acessos, publicacao e historico do Contabil Gestao

Atualizado em: 23/06/2026

Este documento centraliza os acessos, as configuracoes de hospedagem, o procedimento de atualizacao e as principais modificacoes realizadas no sistema.

## 1. Enderecos do sistema

| Servico | Finalidade | Endereco |
|---|---|---|
| Sistema publicado | Frontend para os usuarios | https://nibo-ten.vercel.app |
| API publicada | Backend do sistema | https://nibo-clone-api.onrender.com |
| Verificacao da API | Confirma se o backend esta funcionando | https://nibo-clone-api.onrender.com/health |
| Repositorio | Codigo-fonte e historico de publicacoes | https://github.com/anacarolinastudi-debug/nibo |
| Vercel | Hospedagem do frontend | https://vercel.com |
| Render | Hospedagem do backend | https://dashboard.render.com |
| Supabase | Banco de dados PostgreSQL | https://supabase.com/dashboard |

## 2. Logins do sistema

Os logins abaixo sao criados pela carga inicial (`npm run seed`):

| Perfil | E-mail | Senha inicial |
|---|---|---|
| Administrador | admin@exemplo.com | senha123 |
| Contador | contador@exemplo.com | senha123 |
| Cliente de exemplo | joao@paoquente.com.br | senha123 |

Importante:

- Estes sao acessos de demonstracao.
- Troque as senhas antes de cadastrar dados reais.
- O acesso automatico de demonstracao foi removido. O sistema deve abrir na tela de login.
- Contas criadas posteriormente devem ser administradas pelo proprio sistema ou pelo banco.

## 3. Acessos administrativos

### GitHub

- Repositorio: `anacarolinastudi-debug/nibo`
- Branch de publicacao: `main`
- Nao enviar: `.env`, `node_modules`, `dist`, `uploads`, arquivos ZIP ou senhas.

### Render

- Servico: `nibo-clone-api`
- Plano atual: gratuito.
- URL: `https://nibo-clone-api.onrender.com`
- Diretorio raiz: `backend`
- Build:

```text
npm install && npx prisma generate && npx prisma migrate deploy
```

- Inicializacao:

```text
npm start
```

Variaveis configuradas no Render:

| Variavel | Finalidade | Valor esperado |
|---|---|---|
| `DATABASE_URL` | Conexao com o Supabase | URI do Session Pooler, porta 5432, com `sslmode=require` |
| `FRONTEND_URL` | Autoriza o frontend | `https://nibo-ten.vercel.app` |
| `JWT_SECRET` | Assinatura segura dos logins | Valor secreto gerado e guardado no Render |

Nao registrar neste documento os valores completos de `DATABASE_URL` ou `JWT_SECRET`.

### Supabase

- Utilizado como banco PostgreSQL.
- Para migracoes do Prisma, utilizar o **Session Pooler** na porta `5432`.
- O Transaction Pooler na porta `6543` pode travar `prisma migrate deploy`.
- A senha usada na URI e a senha do banco PostgreSQL do projeto Supabase.
- Caracteres especiais na senha devem ser codificados na URL. Exemplo: `@` vira `%40`.

### Vercel

- Projeto: `nibo`
- Dominio principal: `https://nibo-ten.vercel.app`
- Diretorio raiz no repositorio publicado: `front-end`
- Framework: Vite
- Build: `npm run build`
- Saida: `dist`
- Variavel:

```text
VITE_API_URL=https://nibo-clone-api.onrender.com/api
```

## 4. Como publicar novas atualizacoes

1. Finalizar e testar as alteracoes localmente.
2. Executar o build do frontend:

```text
cd frontend
npm run build
```

3. Validar o backend quando houver mudancas no banco:

```text
cd backend
npx prisma validate
npx prisma generate
```

4. Enviar ao GitHub somente o codigo do projeto, incluindo novas migracoes em `backend/prisma/migrations`.
5. A Vercel publica o frontend automaticamente apos a atualizacao da branch `main`.
6. O Render publica o backend automaticamente e executa as migracoes.
7. Aguardar o status `Deploy live` no Render e `Ready` na Vercel.
8. Testar `/health`, login, clientes, calendario, conferencia e protocolos.

Se a publicacao automatica nao iniciar:

- Render: `Manual Deploy` > `Deploy latest commit`.
- Vercel: `Deployments` > selecionar o ultimo deploy > `Redeploy`.

## 5. Estrutura do projeto

```text
nibo-clone/
|-- backend/       API Node.js, Express, Prisma e PostgreSQL
|-- frontend/      Interface React, Vite e Tailwind
|-- render.yaml    Configuracao do backend no Render
|-- DEPLOY.md      Guia resumido de publicacao
|-- README.md      Informacoes gerais do projeto
`-- ACESSOS_E_HISTORICO.md
```

Observacao: no repositorio do GitHub, a pasta do frontend foi publicada com o nome `front-end`. Localmente ela se chama `frontend`.

## 6. Funcionalidades e modificacoes realizadas

### Autenticacao

- Login por e-mail e senha com JWT.
- Rotas internas protegidas.
- Remocao do acesso automatico de demonstracao.
- Perfis ADMIN, ACCOUNTANT e CLIENT previstos no backend.

### Obrigacoes e calendario

- Calendario com navegacao entre meses e data atual.
- Abertura das tarefas ao selecionar um dia.
- Agrupamento das tarefas por atividade ou cliente.
- Expansao das tarefas ao clicar no cliente.
- Baixa e conclusao das tarefas.
- Cores de situacao:
  - vermelho: tarefa atrasada;
  - amarelo: vence hoje ou esta proxima;
  - cinza: aberta dentro do prazo;
  - verde: concluida dentro do prazo;
  - rosa: concluida fora do prazo.

### Conferencia e protocolos

- Upload de PDFs.
- Associacao do documento ao cliente e a obrigacao.
- Identificacao automatica ou selecao manual.
- Protocolo com arquivo, cliente, data, responsavel e status.
- Leitura do CPF/CNPJ no PDF para localizar o cliente cadastrado.

### Robos de leitura

- Extracao de texto dos PDFs no backend com `pdf-parse`.
- Identificadores configuraveis manualmente.
- Priorizacao do identificador mais especifico.
- Regras iniciais para:
  - DARF previdenciario;
  - DAS mensal;
  - FGTS Digital;
  - parcelamento do Simples Nacional (PARCSN);
  - parcelamento MEI (PARCMEI);
  - DAE eSocial.
- Criacao automatica do vinculo cliente-obrigacao quando ambos sao reconhecidos.

### Configuracoes de obrigacoes

- Cadastro e edicao de obrigacoes recorrentes.
- Frequencia, mes, dia de vencimento e regra de dia nao util.
- Simulacao de vencimento.
- Vinculo individual entre obrigacao e cliente.
- Grupos de obrigacoes e vinculo em lote.
- Matriz de vinculos com iniciais do responsavel.
- Transferencia de responsabilidades.

### Relatorios

- Produtividade geral e por departamento.
- Mapa de pendencias.
- Auditoria de protocolos.
- Filtros por status e mes.

### Clientes

- Nova area inspirada no fluxo do Nibo.
- Abas mantidas: `Meus clientes` e `Contatos`.
- Abas removidas por decisao do projeto: `Convites` e `Grupos`.
- Removida a separacao de clientes por licenca.
- Busca, filtro por regime tributario e filtro de ativos/arquivados.
- Cadastro e edicao em painel lateral.
- Pessoa juridica ou pessoa fisica.
- Dados fiscais, endereco, atividade, CNAE, e-mail e telefone.
- Preferencias de acesso a documentos e lembretes tributarios.
- Arquivamento sem exclusao do historico.
- Contatos vinculados aos clientes.
- Permissoes dos contatos por departamento.

### Tarefas e processos

- Substituicao do quadro antigo de demandas pela area `Tarefas & Processos`.
- Abas de Tarefas, Processos e Configuracoes.
- Lista de tarefas com busca, filtros, status, cliente, departamento, prazo e responsavel.
- Criacao de tarefa em branco ou a partir de modelo salvo.
- Painel lateral para criar e editar tarefas.
- Checklist editavel e opcionalmente obrigatorio para concluir.
- Formularios associados a tarefa.
- Configuracoes de notificacao de atraso, aprovacao e checklist obrigatorio.
- Alteracao de status diretamente na listagem.
- Cadastro de modelos reutilizaveis de tarefa.
- Inicio e acompanhamento de processos por cliente, departamento, prazo e andamento.
- Persistencia de modelos, processos, checklist, formularios e configuracoes no PostgreSQL.
- Processos iniciados a partir de modelos com etapas predefinidas.
- Modelo inicial de abertura de empresa com etapas fiscais, cadastrais e contratuais.
- Botao `Detalhes` na listagem de processos.
- Kanban horizontal de etapas e tarefas do processo.
- Bloqueio automatico de uma etapa enquanto a etapa anterior estiver pendente.
- Conclusao de tarefas diretamente no Kanban e calculo automatico do andamento.
- Informacoes de cliente, responsavel, datas, instrucoes e complemento no detalhe do processo.
- Persistencia das etapas e do progresso de cada processo no PostgreSQL.
- Configuracoes divididas em Modelos de tarefas, Modelos de processos e Responsabilidades.
- Busca e filtro por departamento nas listas de modelos.
- Editor visual de modelos de processo com titulo, instrucoes e departamento.
- Criacao e edicao de etapas ordenadas do processo.
- Criacao de tarefas em cada etapa com prazo relativo em dias.
- Calculo automatico da duracao total do modelo.
- Transferencia em lote de tarefas e processos abertos entre usuarios do escritorio.

### Interface

- Fonte e tamanhos revisados.
- Acentuacoes corrigidas.
- Icones substituidos por `lucide-react`.
- Remocao de banners promocionais e icones desnecessarios.
- Tabelas responsivas, com colunas de status legiveis e rolagem horizontal controlada.

## 7. Migracoes recentes do banco

- Modulo de obrigacoes, grupos, vinculos, robos e protocolos.
- Ampliacao do cadastro de clientes.
- Criacao da tabela de contatos dos clientes.
- Dados fiscais, endereco, atividade, CNAE e preferencias adicionados aos clientes.

As migracoes ficam em:

```text
backend/prisma/migrations
```

## 8. Pendencias e cuidados antes do uso real

- Trocar todas as senhas de demonstracao.
- Nao compartilhar capturas contendo senhas, chaves ou connection strings.
- Configurar Supabase Storage ou outro armazenamento persistente para PDFs. O disco gratuito do Render pode ser apagado em reinicializacoes.
- Revisar permissoes dos usuarios internos.
- Testar robos com mais modelos de guias antes do uso em grande escala.
- Confirmar se tabelas tributarias e calculos de folha estao atualizados com a legislacao vigente.
- Configurar dominio proprio e politica de backup do banco.

## 9. Recuperacao e diagnostico

- API indisponivel: verificar `Logs` e `Events` no Render.
- Erro de banco: conferir `DATABASE_URL`, porta 5432, Session Pooler e `sslmode=require`.
- Frontend sem acessar a API: conferir `VITE_API_URL` na Vercel e `FRONTEND_URL` no Render.
- Alteracao nao apareceu: confirmar o commit na branch `main` e refazer o deploy.
- Plano gratuito do Render: a primeira requisicao pode demorar aproximadamente 50 segundos apos inatividade.

## 10. Seguranca

Nunca enviar ao GitHub ou registrar neste documento:

- senha real do Supabase/PostgreSQL;
- `JWT_SECRET`;
- service role key do Supabase;
- arquivos `.env`;
- documentos fiscais reais de clientes;
- tokens de acesso do GitHub, Vercel ou Render.

As senhas administrativas devem permanecer nos gerenciadores oficiais de cada servico ou em um gerenciador de senhas confiavel.
