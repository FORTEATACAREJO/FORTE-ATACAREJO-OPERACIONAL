# FORTE — Plano de consolidação em três repositórios
**Data:** 2026-11-09  
**Situação:** planejamento e execução segura em branch; nenhuma exclusão, corte produtivo ou migração de dados autorizada por este documento.

## Arquitetura aprovada
1. **FORTE ATACAREJO OPERACIONAL**: continuar o código de `FORTEATACAREJO/FORTE-VENDAS` (PR #57, ainda draft); incorporar gradualmente fretes/motoristas, financeiro, vendas externas, carga direta, balcão, site, Itaú e WhatsApp no mesmo produto com telas móveis e permissões. Renomear o repositório somente após conferir integrações/URLs e ter procedimento de reversão.
2. **FORTE FISCAL**: continuar `FORTEATACAREJO/FORTEFISCAL` e PR #91, com Supabase, autenticação, estoque e emissão independentes. Nunca migrar seus dados para Operacional.
3. **FORTE MC-6**: criar um **novo repositório privado** de engenharia para desenhos, CAD, cálculos, especificações, lista de peças, segurança e código de CLP; sem compartilhar certificados/segredos nem dados financeiros. Não publicar desenhos sensíveis em repositório público.

No GitHub, somente esses **3 repositórios ativos** serão o destino. Primeiro arquivar como legados, com preservação e possibilidade de restauração, os demais 5 repositórios; só discutir exclusão irreversível após prova de migração, retenção histórica e novo aceite.

## Inventário auditado por conectores em 2026-11-09
- **GitHub:** 7 repos existentes: `FORTE-VENDAS` (público), `FORTEFISCAL` (privado), `FORTE-FRETE`, `FORTE-FINANCEIRO`, `FORTE-VENDA-EXTERNA`, `FORTE-CARGA-DIRETA`, `SITE-FORTE-ATACAREJO`. Repo MC-6 ainda não criado. Nenhum dos cinco legados foi arquivado/excluído.
- **Supabase:** `FORTE VENDAS` 84 tabelas / 26 Edge Functions; `FORTE FRETE` 38 tabelas / 19 Edge Functions; `FORTE FISCAL` 69 tabelas / 11 Edge Functions. Os três aparecem ativos/saudáveis. A estrutura final empresarial preserva **dois projetos**, Operacional e Fiscal. A base Frete será descontinuada apenas após migração integral homologada.
- **Dado crítico:** `FORTE FRETE.public.motoristas` tem 23 registros, `veiculos_motorista` 2, `rotas` 5, `documentos_motorista` 1, `usuarios_app` 4; a tabela `FORTE VENDAS.public.fc_motoristas` tem 0, assim como `fc_veiculos`. Não eliminar Frete nem os arquivos de Storage, Auth ou funções.
- **Render:** 11 serviços no workspace FORTEATACAREJO: `forte-vendas`, `forte-vendas-app`, `forte-itau-api`, `forte-whatsapp-api`, `forte-frete`, `forte-financeiro`, `forte-venda-externa`, `forte-carga-direta`, `site-forte-atacarejo`, `forte-fiscal`, `forte-fiscal-pr91-homologacao`. Vários ainda fazem auto-deploy da `main`. Um único repositório pode exigir vários serviços técnicos; consolidar URLs, código e bancos sem forçar um único processo Render.
- **Cursor:** GitHub acessível. MCP Supabase **genérico de toda a organização e com escrita** foi detectado pelo agente; a configuração segura `.cursor/mcp.json` existe na PR #58, mas só deve ser considerada ativa após teste de sessão restrito. MCP Render estava sem autenticação comprovada no Cursor, embora o serviço Render esteja acessível pelo ChatGPT.

## Autorização de desenvolvimento ao Cursor
Autorizado a **inspecionar**, criar/editar código e testes, trabalhar em branches de funcionalidade/revisão, executar build/lint/testes, redigir plano de migração e abrir PRs para as partes Operacional e Fiscal nos repositórios correspondentes.
**Não autorizado automaticamente:** merge em `main`, tornar repositórios públicos, deploy, cortar emissores, modificar Produção, aplicar migrations/DML em bancos reais, manipular Auth/Storage, apagar ou desativar serviços/repositórios, modificar RLS, variáveis de ambiente ou segredos. Essas ações requerem comprovação de backup, prévia revisão de impactos e aceite específico do proprietário.
MCP do Operacional deve ser restrito a `gtwecfyffjszghnvtlzr` com `read_only=true`; não usar conexão genérica que mostre Fiscal/Frete e ferramentas de escrita. Render MCP: usar consultas e logs em leitura com confirmação humana para qualquer ação de mudança. OAuth na conta Cursor não é autorizado por alterações neste repositório.

## Plano de trabalho no Cursor — execução em etapas
1. **Conferência:** mapear quais módulos e recursos de cada repo legado já existem na branch da PR #57; gerar matriz módulo → código → URL → banco/tabelas/Auth/Storage/Edge Functions/segredos → testes. Não recomeçar trabalhos concluídos.
2. **Recuperabilidade:** produzir backup completo verificável (dados, schema, Storage, Auth, documentos, logs/históricos necessários) e ensaiar restauração; registrar hashes, contagens e critérios de aceite sem publicar dados sensíveis.
3. **Frete → Operacional:** mapear 23 motoristas, veículos, documentos, permissões, rotas, cadastros e históricos; resolver divergências e idempotência com chaves estáveis; validar contagens, vínculos e acessos mobiles antes de desligar sistema anterior.
4. **Código e UX:** finalizar navegação e recursos reais de Financeiro, Frete/Motorista, Vendas Externas, Carga Direta, administração do site, Itaú e WhatsApp dentro do Operacional, preservando APIs e webhooks.
5. **Homologação:** testar perfis/autorizações, estoques operacionais, pagamentos, webhooks, PDFs/anexos, desempenho mobile e RLS; verificar CI e aprovar checklist de corte, monitoramento e rollback.
6. **Corte controlado:** preparar migração de URLs/domínios/OAuth/Render/instalações PWA, revisão de privacidade e renome do repo; atuar apenas com aprovação específica. **Somente após o aceite** marcar antigos serviços/repositórios como legados, arquivar e encerrar sem perda de dados.
7. **MC-6:** após criar repo **privado**, versionar documentação de engenharia independente dos dois sistemas, sem acoplamento de bancos.

## Evidências e referência cruzada
- Operacional: PR #57 (`chore/forte-atacarejo-operacional-unificacao-20261109`); Cursor/MCP: PR #58.
- Fiscal: PR #91 e Cursor/MCP PR #92, sem merge/produção.
- Revisar os números deste inventário na data do corte; valores aqui refletem consulta de 2026-11-09.

**Gates para excluir/arquivar:** cópia preservada, teste restore, matriz de equivalência funcional, reconciliação dados/arquivos/Auth, testes QA/CI e assinatura do responsável para cada desativação. Nenhuma dessas evidências foi declarada concluída por este documento.
