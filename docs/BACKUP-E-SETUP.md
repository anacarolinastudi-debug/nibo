# Setup e backup da Young Contabil

## Desenvolvimento local

Na raiz do projeto, abra `Setup.cmd` ou execute `npm run setup`. O setup exige Node 22.19+ e as ferramentas PostgreSQL para Windows. Usa os arquivos de dependencias fixadas (`npm ci`) e certificados confiaveis do Windows, gera configuracoes locais sem sobrescrever `.env` existentes e prepara um PostgreSQL separado em `127.0.0.1:55432`, banco `young_dev`. Aplica as migracoes somente nesse banco local; nao executa seed, reset ou migracoes de producao.

Use `npm run setup -- --skip-install` para reutilizar as dependencias ja instaladas e `npm run setup:check` para uma verificacao sem alterar arquivos. Depois, em terminais separados, `npm run dev:api` e `npm run dev:web`. Interface: http://127.0.0.1:5176; API: http://127.0.0.1:4001. O banco local fica em `.local/postgres`; para para-lo: `"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D .local/postgres stop` (em PowerShell, prefixe com `&`).

## Backup diario

- Pasta: `%USERPROFILE%\Documents\Backups Young Contabil`.
- Tarefa Windows: `Young Contabil - Backup diario`, diariamente as 18h, no horario do computador.
- Tambem verifica ao entrar na conta do Windows, para recuperar horarios perdidos. Nao repete uma copia completa ja feita no mesmo dia.
- Exige computador ligado, internet e sessao do usuario iniciada. Nao e um backup independente do computador nem uma copia em nuvem.
- Retencao: 30 dias; so remove arquivos reconhecidos e antigos depois de uma nova copia completa e verificada.
- Conteudo: dump PostgreSQL consistente do schema `public`, uploads referenciados nos registros e configuracoes necessarias para recuperar as chaves criptografadas da aplicacao. Imagens embutidas no banco ja estao no dump. Arquivos externos ao servidor e arquivos nao referenciados no banco nao fazem parte da copia.
- Criptografia AES-256-GCM e compressao; verificacao autenticada e SHA-256 das entradas. Nao cria dump temporario sem criptografia no disco.
- Credenciais e chave de backup protegidas pelo Windows DPAPI e permissoes da conta, em `%LOCALAPPDATA%\YoungContabil\Backup`. A tarefa nao armazena a senha de login do Windows nem a chave administrativa do Render.
- A ferramenta Prisma e o executor sao copiados para essa pasta, para o backup nao depender da pasta do projeto.

O arquivo `status.json` registra a ultima copia concluida ou parcial; `backup.log` registra execucoes. Codigo de saida 0: completo; 2: parcial (faltam uploads); 1: falha. Copias parciais ficam com extensao `.partial` e nao provocam remocao de copias completas antigas. Arquivos parciais/interrompidos com mais de 30 dias sao removidos antes de uma nova tentativa, mesmo que a rede falhe. Uma falha de rede nao e registrada como sucesso. Um mutex do Windows impede execucoes simultaneas e permite recuperar interrupcoes sem apagar a trava de outro processo ativo.

## Executar e verificar manualmente

Para executar uma copia extra, abra `Backup-agora.cmd`. Para verificar uma copia ou extrair dados, no PowerShell:

```powershell
& "$env:LOCALAPPDATA\YoungContabil\Backup\Backup.ps1" -Force
& "$env:LOCALAPPDATA\YoungContabil\Backup\Backup.ps1" -Action Verify -BackupFile "CAMINHO_DO_BACKUP.youngbackup"
```

Nao abra nem compartilhe `config.dpapi`. Essa configuracao e necessaria para ler os backups e so pode ser aberta pela mesma conta Windows. A perda do perfil Windows/chave pode tornar as copias irrecuperaveis. Para migrar o computador, prepare antes uma transferencia segura de chave com assistencia; copiar somente os arquivos de backup nao transfere a chave. Uma copia adicional fora deste disco e recomendada contra defeito, furto ou perda do computador.

## Recuperacao controlada

```powershell
& "$env:LOCALAPPDATA\YoungContabil\Backup\Backup.ps1" -Action Extract -BackupFile "CAMINHO_DO_BACKUP.youngbackup" -Destination "C:\CAMINHO\PASTA_NOVA"
```

A extracao exige uma pasta nova, verifica a autenticidade antes de escrever e nao restaura banco automaticamente. A pasta extraida contem informacoes confidenciais, inclusive `recovery.json`; proteja-a e apague-a com cuidado apos o uso. O `database.dump` pode ser conferido com `pg_restore --list`. Teste a restauracao apenas em um banco local descartavel. Nunca aponte `pg_restore` para producao sem aprovacao especifica e sem outra copia validada.

Os uploads do sistema atual usam disco do servidor. Se um arquivo ja sumiu antes do backup, a ferramenta registra a ausencia, mas nao pode recupera-lo. Um deploy nao deve ser tratado como substituto de armazenamento persistente.

## Instalacao do agendamento

`scripts/Install-Backup.ps1` recebe a configuracao JSON por entrada padrao. Segredos nao devem aparecer em argumentos, arquivos versionados ou logs. Uma reinstalacao preserva a chave existente. Execute o primeiro backup, confira `verified: true` e teste o dump antes de considerar a instalacao validada.
