# Agentes de desenvolvimento — FORTE ATACAREJO OPERACIONAL

## Escopo e arquitetura
- Este repositório FORTE-VENDAS é a base do **FORTE ATACAREJO OPERACIONAL**. O objetivo é reunir Vendas, Balcão, Carga Direta, Vendas Externas, Financeiro, Fretes/Motoristas, WhatsApp e site institucional na mesma plataforma com interfaces móveis por perfil.
- **FORTE FISCAL é um sistema separado**, com repositório, banco Supabase, autenticação, estoque e motor fiscal próprios. Não unificar os bancos nem executar migrações cruzadas.
- A base legada do FORTE FRETE ainda deve ser reconciliada antes da migração definitiva. Não presumir que dados, anexos, usuários e permissões estejam migrados nem desativar o sistema antigo por conta própria.
- O cartão Supabase exibido como **FORTE MC 6** (`nkynfboqwfxhhxcsrawl`, criado em 2026-09-20) é o banco legado do Frete. Não inicializar schema de máquina nele, não apagar registros e não tratar o rótulo como migração concluída. MC-6 precisa de projeto novo, ou segue sem Supabase até o aceite do custo de US$ 10/mês.
- O projeto da máquina de telas/colunas MC-6 é um projeto de engenharia separado, não um módulo comercial.
- Preservar autorização por módulo e por perfil, trilhas de auditoria, reservas de estoque, regras de preços e segregação entre estoque operacional e fiscal.

## Fluxo de trabalho obrigatório
1. Antes de editar, conferir o branch ativo, as PRs abertas (em especial a PR #57 e, quando relevante, #56), as mudanças em andamento e a estrutura real do código.
2. Trabalhar em branch de desenvolvimento com PR de revisão; não fazer merge ou alterações diretas em `main`. O Render possui serviços com auto deploy em `main`.
3. O MCP Supabase deste projeto é **somente leitura** e específico do banco Operacional. Consultas devem ter escopo mínimo; não imprimir CPFs, dados de clientes ou dados sensíveis no chat ou logs.
4. Não executar deploy, migrações DDL, modificações de RLS, importação/exclusão de dados, alteração de variáveis de ambiente ou movimentação de anexos sem aprovação específica.
5. Nunca inserir no código ou nas respostas certificados A1, chaves bancárias, tokens, senhas, service_role, credenciais do WhatsApp ou dados pessoais.
6. Conferir build, testes relevantes, RLS e fluxos móveis; reportar evidência executada e pendências reais. Não marcar testes não rodados como aprovados.

## Contexto tecnológico
- Node/npm; workspace `apps/web`, `packages/core`; scripts do projeto em `package.json`.
- Serviços ativos no Render. A conexão MCP Render pode consultar logs/serviços; qualquer alteração ou deploy depende de aprovação humana.
- GitHub via clone e controle de versão nativos do Cursor. MCPs não substituem revisão de código, CI e homologação.

**Status:** integração para agente de desenvolvimento, não liberação de produção.

## Ordem de continuidade autorizada — 09/11/2026
- **AUTORIZADO ao Cursor:** ler o repositório, codificar, refatorar e corrigir módulos, produzir testes/build e abrir novas PRs em branches de desenvolvimento; preservar os trabalhos existentes. Ler `docs/CONSOLIDACAO_3_REPOS_20261109.md` antes da primeira alteração.
- **Destino final de GitHub:** três repositórios ativos: FORTE ATACAREJO OPERACIONAL (renomear FORTE-VENDAS após corte controlado), FORTEFISCAL independente, FORTE MC-6 novo e privado. Os cinco repositórios comerciais legados são fontes para migração e não devem ser excluídos até backup/reconciliação/QA/aceite.
- O Supabase FRETE tem registros que ainda não aparecem no Operacional. Faça **mapeamento e código de migração testável**, mas não rode migração em produção nem apague o banco/Storage/Auth; não exponha dados pessoais.
- Repositório FORTE-VENDAS está atualmente **público**. Não publicar arquivos CAD sensíveis, segredos, documentos internos ou dados pessoais. Solicitar mudança administrativa de privacidade antes da versão final.
- **BLOQUEADO até aceite específico:** mesclar em main, deploy, DDL/DML produtivo, limpar tabelas, desativar serviços Render, deletar/arquivar repositórios, trocar URLs/OAuth e alterar emissão fiscal. O Cursor não ganha autenticação OAuth do Render/Supabase apenas porque há arquivo MCP no Git.
