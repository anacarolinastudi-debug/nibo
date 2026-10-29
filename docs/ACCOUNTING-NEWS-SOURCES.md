# Fontes de noticias contabeis

## Validacao final da implementacao (substitui o levantamento inicial abaixo)

Coleta local real em 2026-10-29: 278 publicacoes, 13 fontes cadastradas.
Retornaram itens: Receita Federal (30), Ministerio da Fazenda (30), eSocial
(29), CFC RSS (10), COMSEFAZ (6), CONFAZ/convenios do ano corrente (35),
MT (20), Agencia Para/Fazenda (30), PE (30), MG (23) e PR (35).
Bahia apresentou falha de conexao TLS; RS retornou zero itens reconhecidos.
Falhas ficam visiveis no painel, sem desativar certificados nem apagar historico.
Portanto existem fontes operacionais nas cinco regioes, mas nao cobertura
individual das 27 UFs ou dos municipios. Nao ha fonte municipal nesta entrega.

Os enderecos exatos estao no registro imutavel accountingNewsSources.js.
Somente listagens oficiais/metadados RSS e trechos curtos sao armazenados,
sem material da IOB, parecer juridico ou importacao completa dos arquivos.
Cada fonte retorna no maximo 35 itens por verificacao. Datas ausentes nao sao
inventadas. CONFAZ prioriza maiores numeros do ano, sem inferir UF ou vigencia.

Coleta diaria a partir das 07:00 America/Cuiaba, GitHub Actions as 11:00 UTC
com retentativa as 12:00 UTC (o provedor pode atrasar). Servidor verifica a
cada 30 minutos/inicializacao/leitura, respeitando horario, trava e intervalo
persistentes. Atualizacao manual tem intervalo de 30 minutos. Falhas parciais
podem ser retentadas. O endpoint publico daily apenas atualiza cache publico,
nao aceita URLs nem opera dados empresariais. Status publico e limitado.

HTTPS com hosts exatos, redirects restritos, 18 segundos por fonte e tres
consultas concorrentes. Limite de 2 MiB; excecao explicita para a listagem
SharePoint de PE (8 MiB). Sem cookies, credenciais ou desativacao de TLS.
Historico no PostgreSQL, marcas por escritorio/usuario/artigo, contas inativas
e clientes bloqueados. RLS habilitado nas quatro tabelas; API autenticada.
Backup existente exporta todas as tabelas publicas, incluindo essas novas.

Testes: accounting-news-parser.test.js, accounting-news-service.test.js,
accounting-news-integration.cjs (somente banco local) e updates-ui.cjs.
Auditoria npm: sem alertas nas duas bibliotecas novas; alertas preexistentes
em Express/transitivas, Zod, nodemailer e node-forge nao foram misturados com
uma atualizacao ampla nesta entrega. Nao constitui certificacao de seguranca.

## Historico do levantamento preliminar

Os resultados abaixo sao o retrato anterior a implementacao e nao descrevem
a cobertura final acima.

## Escopo deste levantamento

Retrato do registro inicial em `backend/src/data/accountingNewsSources.js`,
consultado em 2026-10-29. Este documento foi escrito sem novas pesquisas.
Ampliacoes posteriores do registro precisam de validacao propria; os numeros
abaixo nao devem ser interpretados como cobertura automatica dessas ampliacoes.

O registro inicial tem seis fontes: uma federal, uma nacional e quatro
secretarias estaduais (MG, BA, PR e RS). Todas sao `NEWS`, area `fiscal`,
formato `html`. Nao ha feed RSS validado, fonte municipal ou fonte de
legislacao cadastrada neste retrato.

## URLs e evidencia disponivel

| ID | Pagina oficial | Evidencia obtida na pesquisa anterior |
| --- | --- | --- |
| `receita-federal` | https://www.gov.br/receitafederal/pt-br/assuntos/noticias | Pagina recuperada pela ferramenta web; colecao de noticias com titulos e links. |
| `comsefaz` | https://comsefaz.org.br/novo/noticias/ | Pagina recuperada pela ferramenta web; seis noticias com titulos. |
| `sef-mg` | https://www.fazenda.mg.gov.br/noticias | Resultado web da pagina oficial mostrou listagem do ano corrente. Nao houve validacao direta do HTML pelo Node. |
| `sefaz-ba` | https://www.sefaz.ba.gov.br/noticias/ | Resultado web da pagina oficial mostrou listagem paginada com titulos de noticias. |
| `sefaz-pr` | https://www.fazenda.pr.gov.br/Noticias | Resultado web da pagina oficial mostrou titulos de noticias em nivel h3. |
| `sefaz-rs` | https://www.fazenda.rs.gov.br/noticias?classificacao=52399 | Resultado web da listagem filtrada mostrou nove entradas e titulos em nivel h3. |

Evidencia web nao equivale a resposta HTTP validada no ambiente do coletor.
Resultados de busca podem refletir conteudo indexado anteriormente. Nenhuma
dessas seis fontes tem coleta ponta a ponta certificada por este levantamento.

## Cobertura geografica real

| Regiao | Secretarias estaduais no registro inicial |
| --- | --- |
| Norte | Nenhuma |
| Nordeste | BA |
| Centro-Oeste | Nenhuma |
| Sudeste | MG |
| Sul | PR, RS |

Portanto, a cobertura estadual inicial e de 4 das 27 UFs, em tres das cinco
regioes. Receita Federal e COMSEFAZ tem alcance institucional nacional, mas
isso nao demonstra coleta individual das 27 secretarias.

`UF_NAMES` contem as 27 siglas apenas como dicionario de nomes. A presenca de
uma UF nesse objeto nao significa que exista fonte ou coleta para ela.

## Limitacoes da coleta

- A tentativa de validacao direta com `node --use-system-ca` foi interrompida.
  Nao foram confirmados status HTTP, tipo de conteudo, redirecionamentos,
  quantidade de artigos extraidos ou disponibilidade pelo backend.
- Os prefixos e padroes de links sao restricoes de candidatos, nao provas de
  compatibilidade do parser. Ainda precisam ser confrontados com o HTML real.
- MG ainda precisa de verificacao de compatibilidade dos titulos com os
  seletores do parser generico.
- BA e RS usam artigos com slugs na raiz. O prefixo `/` isolado e amplo;
  aplicar tambem `linkPattern` e limitar a links de titulos de noticias.
  O padrao de slug sozinho nao exclui toda pagina institucional.
- COMSEFAZ usa `/novo/`, com exclusoes de categorias, autores e paginacao.
  Ainda e necessario limitar candidatos aos titulos da listagem.
- RS usa uma classificacao de noticias de servico, nao a totalidade das
  noticias fazendarias. A pagina sem filtro apareceu sem entradas na evidencia
  web; nao substituir silenciosamente o endpoint filtrado.
- As listagens sao pontos de entrada limitados. Nao esta validada a coleta de
  paginacao, arquivos historicos ou todos os artigos de cada instituicao.
- O RSS raiz da Receita Federal foi excluido porque inclui imagens. O RSS da
  colecao de noticias ainda nao foi validado e nao foi cadastrado.
- Nao houve validacao individual de paginas de artigos nem testes do parser
  ou dos feeds nesta tarefa de documentacao.

## Indisponibilidade e itens fora deste retrato

O indice oficial https://www.sintegra.gov.br/links.html teve timeout na
ferramenta web e nao foi usado como fonte de coleta. Isso nao prova que o
servidor esteja indisponivel para todos os clientes.

Nao ha evidencia suficiente neste levantamento para classificar qualquer
fonte cadastrada como bloqueada por captcha, autenticacao ou mecanismo
anti-bot. Nao houve desativacao de TLS nem tentativa de contornar protecoes.

eSocial, ministerios da Fazenda e do Trabalho, CFC, listas anuais de legislacao
do CONFAZ e fontes estaduais do Norte e Centro-Oeste ficam fora do registro
inicial. Nao se afirma sucesso nem falha de coleta para esses endpoints.
Nao foi incluido material da IOB.

## Contrato e verificacao pendente

O modulo exporta CommonJS `{ SOURCES, UF_NAMES }`. O objeto exportado, o
array de fontes, cada fonte e seus arrays `allowedHosts` e `articlePrefixes`
sao congelados. Os hosts permitidos sao nomes exatos, sem curingas.

Para certificar novas fontes ou as fontes iniciais, validar separadamente:
resposta com TLS normal e certificados do sistema, URL final e host autorizado,
conteudo esperado e extracao de artigos pelo parser real. Para RSS, confirmar
itens de noticias e seus metadados, nao apenas uma resposta HTTP de sucesso.
Falhas devem ser registradas sem apresentar cobertura como operacional.

Esta tarefa alterou somente este documento; nao alterou o parser, os testes
nem o registro de fontes.
