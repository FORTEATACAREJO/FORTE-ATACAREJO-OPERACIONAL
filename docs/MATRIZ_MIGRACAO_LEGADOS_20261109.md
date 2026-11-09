# Matriz de migração dos legados — 2026-11-09

Auditoria de código e de infraestrutura em leitura. Nenhum banco, Auth, Storage, Render ou repositório foi alterado. A fonte executável é `tools/consolidacao/matriz-legados.mjs`.

## Destino

Três repositórios ativos: FORTE ATACAREJO OPERACIONAL (hoje `FORTE-VENDAS`), FORTE FISCAL independente e FORTE MC-6 privado, ainda não criado. Dois bancos empresariais: operacional e fiscal. O banco do Frete só sai de operação depois de backup restaurável, reconciliação e aceite.

Nenhum serviço pode ser desligado nesta etapa.

## Repositórios

| Repositório | Papel | Leitura nesta sessão | SHA conferido |
| --- | --- | --- | --- |
| FORTE-VENDAS | base operacional, público | sim, branch `chore/cursor-mcp-forte-20261109` | `df5d018148846a3c3bb485e2c1f83df1afec75be` |
| FORTEFISCAL | definitivo e independente | não | pendente |
| FORTE-FRETE | legado | sim | `3162c0086feb4bfe4957f40d23c33b9ab34b5e91` |
| FORTE-FINANCEIRO | legado | não | pendente |
| FORTE-VENDA-EXTERNA | legado | sim | `f58199737f944bba94bcf5f615a4b312531adf18` |
| FORTE-CARGA-DIRETA | legado | sim | `de14ad6124452bccf265409192158a08d9f7f351` |
| SITE-FORTE-ATACAREJO | legado | sim | `f5324638ecfa4131f37712680d58350c47971e94` |

## Módulos

| Módulo | No operacional | URL atual | Lacuna segura |
| --- | --- | --- | --- |
| Frete e motorista | Diretório, painel, ponte de vendas, sincronização e validador puro | `forte-frete` | App móvel, iOS, Android e importação definitiva. A função `sync-frete-drivers` grava em `fc_app_state` e não é o importador de corte. |
| Financeiro | `FinanceiroHub` e portal interno | `forte-financeiro` | Paridade com o legado não comparada. |
| Venda externa | Função `mobile-vendas-externas` e atalho da PWA | `forte-venda-externa` | Cliente móvel de orçamentos e comissões continua no legado. |
| Carga direta | Função `mobile-carga-direta`, painel e testes já existentes | `forte-carga-direta` | Telas móveis de venda, compra, carga e aprovação continuam no legado. |
| Site | Página institucional em `apps/web/public/site/` | `site-forte-atacarejo` | Administração, Central e recuperação de senha continuam no domínio antigo. |

O que já estava na PR #57 e na PR #58 foi preservado. Esta matriz não recria navegação, marca ou o normalizador anterior.

## Render

Workspace `tea-daoniurm8hqs73fsi3p0`, consulta somente leitura em 2026-11-09. Onze serviços, nove com auto deploy. `forte-whatsapp-api` e `forte-fiscal-pr91-homologacao` não acompanham a `main`.

| Serviço | Corte futuro | Por que continua no ar |
| --- | --- | --- |
| forte-itau-api | API separada | Cobrança e boleto não cabem no site estático. |
| forte-whatsapp-api | API separada | Webhook em branch própria, sem auto deploy. |
| forte-vendas-app | API separada | Processo Node distinto da PWA; a duplicidade com a API Itaú fica só registrada. |
| forte-vendas | Frontend operacional | PWA de destino. O auto deploy da `main` continua, por isso esta branch não será mesclada aqui. |
| forte-financeiro | Frontend legado | Página migrável só após corte e paridade comprovada. |
| forte-venda-externa | Frontend legado | Página migrável só após corte. |
| forte-carga-direta | Frontend legado | Página migrável só após corte. |
| forte-frete | Frontend legado | Página migrável só após corte. O banco Frete não faz parte deste desligamento. |
| site-forte-atacarejo | Frontend legado | Site, administração e Central até o redirecionamento aprovado. |
| forte-fiscal | Fiscal independente | Fora da consolidação operacional. |
| forte-fiscal-pr91-homologacao | Fiscal independente | Homologação fiscal, também fora do corte comercial. |

## Supabase

Releitura de 2026-11-09, só com nome de projeto e contagens. Não houve DDL, DML, pausa, criação de projeto nem cópia de linha. O Fiscal não teve tabela lida.

| Cartão | project_ref | O que é | Criado em |
| --- | --- | --- | --- |
| FORTE FISCAL | `xmfpvvmvdkepmnvtdoio` | Fiscal independente. Permanece isolado. | 2026-09-03 |
| FORTE ATACAREJO OPERACIONAL | `gtwecfyffjszghnvtlzr` | Operacional. 84 tabelas públicas, 26 Edge Functions. `fc_motoristas=0` e `fc_veiculos=0`. | 2026-09-14 |
| FORTE MC 6 | `nkynfboqwfxhhxcsrawl` | Frete legado. 38 tabelas, 19 Edge Functions, 23 motoristas, 2 veículos, 5 rotas, 1 documento de motorista, 5 documentos de veículo, 4 usuários de aplicativo e 4 de Auth. | 2026-09-20 |

O rótulo FORTE MC 6 não é um projeto novo e não prova migração. O Operacional continua sem os motoristas. Há também 6 objetos no bucket privado `motorista-documentos`, somando 15.708.136 bytes; os caminhos não foram copiados. A contagem de partida 23/2/5/1/4 continua válida para aquelas cinco tabelas e não é aceite. `documentos_veiculo=5` fica fora dessa partida e entra no selo.

Não existe quarto projeto. MC-6 de engenharia pode começar sem Supabase. Um projeto novo só depois do aceite explícito de US$ 10/mês.

## Bloqueios de autorização

- `github-privado-financeiro-fiscal`: falta leitura de FORTE-FINANCEIRO e FORTEFISCAL para este agente.
- `mcp-supabase-operacional`: a releitura agregada usou o MCP genérico. A sessão read-only isolada do operacional continua ausente.
- `rotulo-mc6-no-frete`: `nkynfboqwfxhhxcsrawl` é Frete legado. O MCP visto não expõe PATCH de projeto, então o nome de exibição segue FORTE MC 6.
- `backup-fisico-frete`: o selo de metadados e o ensaio de contagens existem. O backup físico não foi exportado.
- `privacidade-github-e-mc6`: FORTE-VENDAS segue público e o repositório MC-6 privado ainda não existe. Nenhum CAD foi versionado. Nenhum projeto Supabase novo foi criado.
- `auth-redirect-site`: mover a administração muda Redirect URL do Auth e exige aceite.
- `corte-producao`: merge, deploy, RLS, Auth, Storage, domínio, OAuth e desligamento exigem aceite específico.
