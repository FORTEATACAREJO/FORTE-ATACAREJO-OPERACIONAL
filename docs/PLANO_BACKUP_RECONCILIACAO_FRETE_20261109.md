# Backup e reconciliação Frete → Operacional — 2026-11-09

Este plano é executável apenas em memória, sobre fixtures. `tools/migracao-frete/plano-importacao.mjs` não abre rede, não lê produção e `aplicarProducao()` não emite comando.

## O que entra no backup, antes de qualquer importação

Cada manifesto precisa ter, sem dados pessoais e sem segredo:

- schema, com SHA-256 do DDL exportado;
- dados das cinco entidades `motoristas`, `veiculos_motorista`, `rotas`, `documentos_motorista` e `usuarios_app`, com contagem e SHA-256 agregado;
- Auth, com contagem de usuários e SHA-256 do manifesto de identificadores, nunca senha, fator ou token;
- Storage, com quantidade de objetos e SHA-256 do manifesto de caminhos;
- Edge Functions do projeto Frete, com a lista de nomes e o SHA-256 do pacote;
- ensaio de restauração em ambiente isolado, com contagens e hashes conferidos.

`validarManifestoBackup()` rejeita manifesto incompleto, restauração fora de ambiente isolado e texto com e-mail, documento formatado ou marcador de segredo.

## Contagem de partida

A auditoria de 2026-11-09 registrou 23 motoristas, 2 veículos, 5 rotas, 1 documento e 4 usuários. `reconciliarContagens()` guarda esses números como contagem de partida. O campo `aceite` permanece falso. Divergência futura da fonte contra essa partida não apaga linha e não libera corte.

## Chave e conflito

A chave estável é `forte-frete:<tabela>:<id>`. Para usuário, o identificador de Auth prevalece quando existe. O plano:

- insere só registro que passa na allowlist e fica inativo, sem conceder acesso;
- ignora quando a mesma chave já tem o mesmo hash;
- recusa sobrescrita quando a chave existe com hash diferente;
- recusa segunda inclusão com o mesmo documento do motorista em outra chave;
- marca duplicidade na fonte e vínculo quebrado de veículo ou documento;
- não copia senha, token, e-mail ou documento do usuário;
- não copia bytes de documento: o plano guarda bucket, caminho e, se já houver, o hash do arquivo.

Linha incompleta permanece pendente. O plano não completa CPF, telefone, CNH, Pix, placa ou caminho de arquivo.

## Ensaio que esta branch realmente faz

`ensaiarRestauracao()` compara a identidade allowlist da fonte com uma cópia. Cópia fiel passa. Linha faltante, hash divergente ou linha extra falha e devolve apenas a chave estável. Isso prova o procedimento; não prova que um backup de produção exista.

`avaliarProntidao()` pode marcar uma simulação como pronta para homologação quando não há conflito, o manifesto é válido, a cópia confere e há revisão das pendências e aprovação humana. Mesmo nesse caso `aplicaProducao` fica falso. O corte continua dependendo de `permitirCorte()`, inclusive da conciliação validada e da aprovação humana.

## Auth, Storage e histórico

Auth é reconciliado por identificador, sem criar usuário e sem copiar credencial. Storage é reconciliado por manifesto de hashes, sem mover objeto. Histórico e funções de viagem, onboarding e aceite continuam no projeto Frete até um backup que passe neste validador e um ensaio fora desta suíte.

A sincronização já existente em `sync-frete-drivers` não substitui este plano: ela grava o estado da aplicação e não oferece chave de origem, hash nem recusa de sobrescrita.

## O que a releitura de 2026-11-09 conseguiu verificar

`tools/migracao-frete/censo-frete-20261109.mjs` guarda o selo, sem linhas e sem caminhos de arquivo. `validarSelo()` confere 38 tabelas, a partida 23/2/5/1/4, os 5 documentos de veículo, 4 usuários de Auth, 19 funções, 6 objetos e 15.708.136 bytes, o schema SHA-256 e o destino operacional zerado. `ensaiarRestauracaoContagens()` falha se uma tabela some ou muda de contagem. `backupRestauravel` permanece falso.

O cartão FORTE MC 6 é `nkynfboqwfxhhxcsrawl`, criado em 2026-09-20. `classificarProjeto()` não aceita esse ref como MC-6, não aceita apagar, pausar ou criar outro projeto, e não trata o nome de exibição como identidade. `importarIdempotente()` grava só em memória, recusa o próprio Frete e o Fiscal como destino, ignora a segunda passagem da mesma chave e recusa sobrescrita. `aplicarProducao()` continua sem comando.

O nome pretendido, quando houver `project_admin_write` limitado a esse ref, é `FORTE FRETE (LEGADO - NÃO APAGAR)`, no corpo `{"name":"FORTE FRETE (LEGADO - NÃO APAGAR)"}`. Esta sessão não tinha esse escopo. `create_project`, `pause_project` e `restore_project` não foram chamados.

## Bloqueios que impedem o backup real

- `github-privado-financeiro-fiscal`
- `mcp-supabase-operacional`
- `rotulo-mc6-no-frete`
- `backup-fisico-frete`
- `privacidade-github-e-mc6`
- `auth-redirect-site`
- `corte-producao`

O selo não substitui o dump. Sem arquivo de schema, dados, Auth, Storage e Edge Functions restaurado em ambiente isolado, o corte continua fechado.
