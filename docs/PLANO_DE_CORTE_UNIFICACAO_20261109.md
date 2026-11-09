# Plano de migração sem interrupção — FORTE ATACAREJO OPERACIONAL

Status: checklist de execução; nenhuma migração de dados ou desligamento é autorizado por este documento.

## Estado alvo

DOIS sistemas: FORTE ATACAREJO OPERACIONAL e FORTE FISCAL. Módulo MC-6 integrado ao processo de engenharia/agentes, não à base fiscal ou operacional comercial.

## Fase 0 — Inventário e proteção (obrigatória)

- Registrar SHA da versão publicada de cada legado, URL, Render service ID, projeto Supabase, bucket, Edge Function, integração externa, autenticação e origem de dados.
- Inventariar referências entre repositórios, scripts de build, CI, domínios, favicon, PWA, notificações, WhatsApp, Gmail, Itaú, Omie/Connect, redirecionamentos e secrets (somente nomes dos segredos; nunca seus valores).
- Produzir backup do banco de fretes e do banco operacional e validar uma restauração em ambiente isolado.
- Auditar presença de segredos antes de tornar público/privado qualquer repositório. Repositório operacional alvo deve ser privado.

## Fase 1 — Consolidação funcional no monorepo

- Manter `FORTE-VENDAS` como repositório fonte até renomeação segura.
- Incorporar funcionalidades e testes dos legados Financeiro, Frete, Vendas Externas, Carga Direta e Site. Não duplicar o que já funciona em `apps/web`.
- Criar uma única PWA com menus condicionados por perfil. Não depender da Central de Apps externa para executar módulos.
- Preservar atalhos antigos como redirecionamentos temporários de compatibilidade; registrar instalações ativas antes de remover `financeiro.webmanifest`.
- Unificar componentes responsivos para Motorista/Vendedor Externo/Carga Direta sem múltiplos logins/silos.
- Testes e2e por perfil e por unidade operacional; acesso negado auditado.

## Fase 2 — Supabase operacional

- Usar o projeto operacional existente como destino, com nome visível atualizado sem trocar a referência técnica antes de migrar os clientes.
- Levantar mapeamento coluna-a-coluna e vínculos Frete → Operacional: motoristas, veículos, vínculos, ordens, viagens, cargas, documentos, pagamentos, convites, aceite, auditoria, anexos e chaves externas.
- Verificar tabelas com nomes iguais mas esquemas diferentes, evitar `INSERT ... SELECT` indiscriminado.
- Importar por lotes idempotentes com referência de origem e hash, sem sobrescrever dados mais recentes e sem perder documentos.
- Testar Edge Functions, políticas RLS, storage, realtime, limites de permissões e divergências de estoque.
- Reconciliar totais e registros ativos, ensaiar rollback; somente depois congelar escrita no legado.

## Fase 3 — Nome, domínio e Render

- Alterar a identidade visual para FORTE ATACAREJO OPERACIONAL (esta PR já prepara o nome PWA e caminhos de compatibilidade).
- Renomear GitHub para `FORTE-ATACAREJO-OPERACIONAL` somente após revisar links, deploys, OAuth e permissões. Tornar privado antes de incorporar código/documentação internos restritos.
- Consolidar deploy frontal: uma interface operacional e site integrado, mantendo APIs e workers técnicos necessários.
- Verificar webhooks de terceiros e avisos de URL antiga. Desligar frontends legados apenas após transferência dos usuários e confirmação de funcionalidades.
- Renomear projeto Supabase sem criar banco substituto desnecessário; manter o ID e URL técnicos até validar a migração.
- Fiscal permanece como serviço e banco separados, sem nenhuma mudança de dados nesta etapa.

## Fase 4 — Central de Agentes FORTE / engenharia

- n8n (um orquestrador), executor de código isolado, GitHub PRs e Render logs/ambiente de homologação.
- Rotinas por repositório/produto: operacional, fiscal, MC-6; independência de permissões. Sem credenciais A1 ou bancárias em agente.
- Gates: teste + revisão + aprovação humana para deploy, banco, fiscal, financeiro, segurança e equipamento industrial.
- MC-6 pode residir em `engineering/mc6` como fonte de CAD (STEP/GLB/parametrização/testes), sem importar tabelas fiscais nem acoplar máquinas físicas ao ERP.

## Critérios de corte/aceitação

- Dados conciliados por contagem, chaves, amostras e totais de domínio; anexos e histórico acessíveis.
- Vendedor, motorista, operador de cargas e financeiro acessam somente a PWA operacional com identidade/permissões corretas.
- Testes de venda parcial/reserva, estoque real, pedidos, frete e documentos, integração bancária e WhatsApp aprovados.
- Fiscal continua emitindo independentemente, com estoque separado e certificados protegidos.
- Site institucional publicado no mesmo projeto operacional; URL antiga redirecionada.
- Backups/rollback comprovados, observabilidade 7 dias e aceite documentado antes de arquivar/pausar legados.

## Proibições imediatas

NÃO excluir banco de Frete, NÃO apagar repositórios, NÃO cancelar serviços Render, NÃO mover segredos, NÃO ligar agentes com permissões irrestritas, NÃO publicar em produção. Este pacote é preparação em branch isolada.
