# Acessos, publicacao e historico do Contabil Gestao

Atualizado em: 24/06/2026

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
npm install && npx playwright install chromium && npx prisma generate && npx prisma migrate deploy
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
| `CERT_ENCRYPTION_KEY` | Criptografa o certificado digital salvo no banco (Radar e-CAC) | Valor secreto gerado pelo Render |
| `PLAYWRIGHT_BROWSERS_PATH` | Forca o Chromium a instalar dentro de `node_modules` | `0` (literal) |
| `NODE_OPTIONS` | Habilita algoritmos antigos do OpenSSL, exigidos por certificados e-CNPJ mais antigos | `--openssl-legacy-provider` |

Nao registrar neste documento os valores completos de `DATABASE_URL`, `JWT_SECRET` ou `CERT_ENCRYPTION_KEY`.

Observacao sobre o build: o passo `playwright install --with-deps` (que instala dependencias de sistema via apt-get) **quebra o build no Render free**, porque exige privilegios de root que o ambiente de build nao concede. Usar sempre `playwright install chromium` sem `--with-deps`.

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
- Barra azul lateral (Rail) unificada num unico componente (`NiboRail`), usada em todas as paginas, evitando inconsistencia visual ao navegar. Reduzida a apenas Ajuda + avatar do usuario.
- Menu lateral branco com secoes em formato acordeao (`SideMenuSection`): clique no cabecalho expande/recolhe os sub-itens, com rolagem propria.
- Menu do usuario (clique no avatar "AC"): nome/e-mail reais, com opcao "Sair" funcional.
- Removido o item "Comece rapido" do topo do menu lateral.

### Formularios (modulo novo)

- Tela `/formularios`: lista com abas Ativos/Inativos, busca, filtro por departamento.
- Editor (`/formularios/:id`): abas Estrutura/Visualizacao, paleta de blocos (texto curto/longo, sim/nao, multipla escolha, dropdown, data, upload, avaliacao, logica condicional, validacao), paginas multiplas, painel de configuracoes por bloco, undo/redo.
- Modelo `Form` no banco, com paginas/blocos guardados em JSON.

### Conferencia (reconstruida com dados reais)

- Deixou de usar dados mockados; passa a consumir a API (`ProtocolDocument`) de ponta a ponta.
- Lista agrupada por cliente (codigo, nome, CNPJ, contagem de documentos).
- Filtros (Cliente/Departamento/Obrigacao/Tipo de entrega) agora filtram a lista de fato.
- Painel de identificacao do documento com visualizador de PDF (iframe) e formulario completo (tipo, numero, competencia, vencimento, valores, recalculo, tipo de entrega, protocolar como Correcao/Complemento, observacao para o cliente).
- Aviso de protocolo duplicado (mesma obrigacao + competencia) com escolha de Correcao/Complemento.
- Upload agora salva a `fileUrl` real (antes ficava `null`).
- Campos novos em `ProtocolDocument`: tipo/numero do documento, pagar at, valores principal/total, recalculo, protocolar como, observacao.

### Relacionamento (caixa de entrada WhatsApp)

- Tela `/relacionamento`: lista de conversas + thread de mensagens, estilo WhatsApp.
- Modelos `WhatsAppConversation` e `WhatsAppMessage`.
- Webhook `GET`/`POST /api/whatsapp/webhook` pronto para a verificacao e recebimento de mensagens da Meta Cloud API (WhatsApp Business).
- Envio real de mensagem so funciona com `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` configurados (ainda nao configurado em producao). Sem isso, a mensagem fica salva localmente como "nao enviada", sem quebrar o restante do sistema.
- **Pendente:** criar a conta Meta Business / WhatsApp Cloud API, gerar as credenciais e configurar o webhook apontando para `https://nibo-clone-api.onrender.com/api/whatsapp/webhook`.

### Radar e-CAC (em desenvolvimento — robo ainda nao validado contra o site real)

- Tela `/radar-ecac`: tabela por cliente com ultima verificacao, status e botao "Sincronizar agora". Job agendado diario (6h) para clientes ativos.
- Modelos `TaxPendencyCheck` e `TaxPendency`.
- Robo em `backend/src/services/ecac.service.js`, usando Playwright com certificado digital (`clientCertificates`, suportado nativamente desde versoes recentes do Playwright, sem precisar instalar o certificado no sistema operacional).
- O certificado digital (.pfx) e a senha sao enviados pela tela Configuracoes > Escritorio e guardados **criptografados** (AES-256-GCM, chave `CERT_ENCRYPTION_KEY`) no banco, por escritorio — nunca em variavel de ambiente ou texto puro.
- **Status em 24/06/2026:** login com certificado digital e abertura do Chromium ja funcionam em producao. A etapa de localizar o CNPJ do cliente na lista de procuracoes (`selectOutorgante`) ainda esta sendo ajustada — os seletores/URLs do e-CAC real (`#/procuracoes`, `#/situacao-fiscal`) sao estimativas, nunca verificadas contra o site oficial.
- Erros do robo agora incluem links publicos (`/uploads/ecac-debug/*.png` e `*.html`) com a screenshot e o HTML da pagina no momento da falha, pra facilitar o diagnostico remoto sem acesso ao servidor.
- **Proximo passo:** usar um token de sessao (NAO a senha) para chamar a sincronizacao diretamente via API e inspecionar os artefatos de depuracao, ajustando os seletores reais do e-CAC.

### Configuracoes (modulo novo)

- Tela `/configuracoes` com sub-abas: Escritorio, Equipe, Departamentos, Responsabilidades. (Abas "Atalhos", "API" e "Avancado" sao apenas placeholder "Em breve", ou foram removidas a pedido.)
- **Escritorio:** dados do escritorio (CNPJ, nome, CRC, e-mail), logotipo, endereco, e a secao de certificado digital (upload .pfx + senha, exibicao de validade/titular, remocao).
- **Equipe:** lista de usuarios do escritorio + modal "Novo usuario".
- **Departamentos:** CRUD com modal (nome + responsavel). 5 departamentos padrao sao criados automaticamente na primeira visita.
- **Responsabilidades:** 3 sub-abas — "Dos clientes" (matriz cliente x departamento x responsavel, editavel por linha), "Dos departamentos" (departamento/encarregado), "Do escritorio" (cargos internos + "Novo cargo").
- Modelos novos: `Department`, `ClientDepartmentResponsible`, `FirmRole`.

### Correcao de bug critico (autenticacao)

- O token JWT guarda o id do usuario no campo `sub` (padrao JWT), mas varios controllers liam `req.user.id` (sempre `undefined`). Isso fazia o campo "responsavel" ficar `null` silenciosamente em varias acoes (upload de conferencia, confirmacao de protocolo, etc.).
- Corrigido no middleware central (`backend/src/middleware/auth.js`): `req.user` agora expoe tanto `sub` quanto `id`.

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
- Configurar a conta Meta Business / WhatsApp Cloud API para o modulo Relacionamento funcionar de ponta a ponta.
- Concluir os ajustes do robo do Radar e-CAC (ver secao "Radar e-CAC" acima e item abaixo).

### Continuar amanha: Radar e-CAC

Onde paramos em 24/06/2026, fim do dia:

- Certificado digital ja cadastrado em Configuracoes > Escritorio, e um cliente de teste ja configurado.
- Login no e-CAC com o certificado e abertura do Chromium **ja funcionam** em producao (depois de corrigir 3 problemas de infraestrutura: instalacao do Chromium sem `--with-deps`, `PLAYWRIGHT_BROWSERS_PATH=0` para o navegador persistir entre build e runtime, e `NODE_OPTIONS=--openssl-legacy-provider` para o certificado antigo ser aceito).
- Falta validar a etapa de localizar o CNPJ do cliente na lista de procuracoes do e-CAC (`selectOutorgante` em `backend/src/services/ecac.service.js`) e a extracao da tabela de pendencias (`scrapePendencies`). As URLs usadas (`#/procuracoes`, `#/situacao-fiscal`) sao estimativas, nunca confirmadas contra o site real.
- Erros do robo agora trazem links publicos para a screenshot e o HTML da pagina no momento da falha (`/uploads/ecac-debug/...`), pra diagnosticar sem precisar de acesso ao servidor.
- Pedido ao usuario: fornecer um token de sessao (`localStorage.getItem('token')` no navegador, **nunca a senha**) para chamar a sincronizacao diretamente via API e inspecionar os artefatos de depuracao, em vez de pedir para clicar em "Sincronizar agora" a cada ajuste.

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
