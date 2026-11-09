# Evidência — FORTE MC 6 é o Frete legado

Leitura em 2026-11-09, depois do alerta. Foram usados `list_projects` e SQL de contagem. Nenhuma linha, caminho de arquivo, e-mail ou corpo de função foi copiado. Não houve DDL, DML, pausa, restauração nem criação de projeto.

## Classificação conferida

| Nome no painel | project_ref | Criado em | Classificação |
| --- | --- | --- | --- |
| FORTE FISCAL | `xmfpvvmvdkepmnvtdoio` | 2026-09-03 | Fiscal, isolado. Nenhuma tabela foi lida. |
| FORTE ATACAREJO OPERACIONAL | `gtwecfyffjszghnvtlzr` | 2026-09-14 | Operacional. `fc_motoristas=0`, `fc_veiculos=0`, `fc_motorista_veiculos=0`, `fc_documentos=0`. |
| FORTE MC 6 | `nkynfboqwfxhhxcsrawl` | 2026-09-20 | Frete legado. O rótulo mudou; o banco não. |

Há três projetos na organização e nenhum quarto. O cartão MC 6 não é projeto novo.

## O que ainda está no Frete

- 38 tabelas públicas, 414 colunas, SHA-256 de schema `15ba07e0d16e62ade8c165517d48881af199101b1130f084e1e43184ab065f01`.
- Partida já conhecida: 23 motoristas, 2 veículos, 5 rotas, 1 documento de motorista, 4 usuários de aplicativo.
- Além da partida: 5 documentos de veículo, 2 vínculos motorista-veículo, 4 usuários de Auth, 56 migrations e 19 Edge Functions.
- Storage: 3 buckets privados. `motorista-documentos` tem 6 objetos e 15.708.136 bytes. 1 + 5 documentos explicam os 6 objetos. Os caminhos não foram exportados.
- Operacional: 84 tabelas públicas, 66 migrations, 26 Edge Functions, 5 buckets e 261 objetos. Nenhum motorista ou veículo de frete.

A migração Frete → Operacional não ocorreu.

## Código que esta branch executa

- `classificarProjeto()` recusa usar `nkynfboqwfxhhxcsrawl` como MC-6, recusa apagar, truncar, sobrescrever e pausar, e recusa criar projeto enquanto o custo de US$ 10/mês não tiver aceite. O Fiscal só pode ser preservado.
- `importarIdempotente()` planeja com a chave `forte-frete:<tabela>:<id>`, aceita `origem_cidade`/`destinos` e `arquivo_path`, não copia bytes e, com os quatro gates, grava só em memória. A segunda passagem da mesma chave não duplica. Hash diferente não sobrescreve. Origem menor não apaga o destino. Frete e Fiscal são recusados como alvo.
- `validarSelo()` e `ensaiarRestauracaoContagens()` conferem o selo. `backupRestauravel` fica falso.

## O que não foi feito

O backup fisico nao foi exportado: não há `pg_dump`, download de Storage nem export de Auth. O repositório é público e não há token da Management API.

O nome de exibição não foi corrigido. O MCP autenticado lista, lê, cria, pausa e restaura projeto; não expõe `PATCH /v1/projects/nkynfboqwfxhhxcsrawl`. Nenhuma dessas ações de escrita foi chamada. O nome pretendido, com `project_admin_write` limitado a esse ref, é `FORTE FRETE (LEGADO - NÃO APAGAR)`.

MC-6 pode começar sem Supabase. Projeto novo só depois do aceite explícito do custo já cotado.
