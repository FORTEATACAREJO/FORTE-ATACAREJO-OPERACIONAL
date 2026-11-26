# Auditoria FORTE OP / PEDIDOS FT — lote 02/05
25/11/2026. Continuidade do PR documental #126. Revisão estática de diffs, arquivos, checks por SHA e comparação dirigida com main; não é homologação integral.

| PR | Branch | SHA | Base SHA | Mergeável | Qualidade / Financeiro-Frete / WhatsApp / Connect |
|---|---|---|---|---|---|
| #79 | fix/pedidos-ft-conferencia-operacional-20261122 | 87468d812aa5bcd3d0d83a846a643a25ada91d87 | 6905c6595be25639e55240cb3d0bcc311d1e65b3 | Não | OK/OK/OK/OK |
| #71 | fix/forte-atende-login-cpf | d8ed133b8cec6e185eb7a2c4f117ff5a8b427d83 | cd43142a319b5acc8762fd9b31748bc62fb9f93d | Não | Falha/OK/OK/OK |
| #70 | feature/forte-atende-portal-20261120 | 01bcd5a233a56860297db6c2717a1e57676f8fdb | cd43142a319b5acc8762fd9b31748bc62fb9f93d | Não | Falha/OK/OK/OK |
| #64 | cursor/frete-perfil-motorista-4d6b | 7eb5f7d6cfcf1e267d97b0245a85b89c9fa37a70 | cd8c2f6b6b655551996122e410bd2663bbbf1df1 | Não | OK/OK/OK/OK |
| #63 | cursor/adaptador-snapshot-frete-4c17 | 227c68e2eea3f7b3af6e891ba610e088f758aaa5 | ac17303eb81495f6d02a2bdb85c23ab7685cbbff | Sim | OK/OK/OK/OK |

## #79 — conflito, sobreposição parcial
11 arquivos: apps/web/src/{OrdersWorkspace.jsx,PedidosFT.jsx,orders-reports.js,pedidos-ft-model.mjs,supplier-pallet-preferences.mjs}; checks/{orders-reports.test.mjs,orders-workflow.test.mjs,pedidos-ft-model.test.mjs}; supabase/functions/orders-workflow/{capacity.mjs,domain.mjs,supplier-pallet-preferences.mjs}.
Diff: compra sem motorista, regra de paletes e frete preservada, dossiê e capacidade. Dependências declaradas #72, #74–78, issue #73; versões de Edge Functions e permissões Juliana/Pedro precisam de confirmação atual. Main contém supplierPalletRule no domínio e modelo do dossiê, e SUPPLIER_CREATE/EDIT no módulo de capacidade; presença de símbolos não prova equivalência. Comparar residual com #124/#125; testar compra sem motorista, expedição bloqueada, edição sem alterar regra histórica, CIF/FOB, PDF com produtos separados e documentos por cliente. Não mesclar branch antiga.

## #71 — superado quanto à origem CORS; conflito e falha de qualidade
Arquivo supabase/functions/login-cpf/index.ts. Diff adiciona origem HTTPS de homologação. Main já contém https://forte-atende-homologacao.onrender.com na lista exata, com POST/origem inválida recusados. Não reaplicar; confirmar autenticação e autorização com usuário fictício, rejeição de origem indevida e limite de tentativas. Dependência FORTE ATENDE #70 e implementação independente em SISTEMAS-FORTE-TECH. Não alterar credenciais.

## #70 — conflito, correção/homologação necessária
9 arquivos: apps/web/{atende.html,public/forte-atende-icon.svg,public/manifest-atende.webmanifest,src/ForteAtende.jsx,src/atende-main.jsx,src/atende.css,vite.config.js}; docs/FORTE_ATENDE_PORTAL_20261120.md; supabase/migrations/20261120145000_forte_atende_contacts_campaigns.sql.
Diff inclui portal, CRUD contatos/campanhas, opt-out e RLS; programação apenas planejamento. Main não contém ForteAtende.jsx no caminho consultado (404); comparar com portal independente e #88 antes de reimplementar. Migração aplicada segundo descrição histórica, não verificada ao vivo. Testar isolamento, autorização, concorrência, editar/pausar, opt-out, erro/sucesso, histórico e e-mail sem envio. Não habilitar campanhas ou duplicar migração.

## #64 — conflito, dependência de #57, homologação sandbox
12 arquivos: apps/web/src/{App.jsx,FreteMotoristaOperacao.jsx,frete-motorista-operacao.mjs,module-access.mjs}; checks/{frete-perfil-motorista-db.test.cjs,frete-perfil-motorista-ui.test.cjs,frete-perfil-motorista.test.mjs,module-access.test.mjs}; package.json; supabase/functions/access-standard/index.ts; supabase/migrations/20261110011800_frete_perfil_motorista.sql; tests/access-standard/edge-tests.mjs.
Diff inclui acesso exclusivo Frete, RPCs de cargas próprias, aceite/recusa e referência SHA-256. Base declarada PR #57, não main. Main App.jsx não referencia FreteMotoristaOperacao; arquivo e module-access.mjs retornaram 404. Quatro checks verdes históricos, qualidade denominada Forte Vendas. Migração não aplicada segundo descrição. Testar conta motorista sem acesso a Vendas/Financeiro, recusa sem motivo, duplo clique, carga alheia, hash imutável, sandbox e ausência de ativação cadastral. Não aplicar migração real.

## #63 — mergeável na base informada, não apto a produção
12 arquivos: apps/web/src/{App.jsx,FretePendenciasPainel.jsx,Mc6Acesso.jsx,frete-snapshot.mjs,mc6-acesso.mjs}; checks/{frete-pendencias-ui.test.mjs,frete-snapshot-fixture.mjs,frete-snapshot.test.mjs,mc6-acesso.test.mjs}; package.json; tools/migracao-frete/{adaptar-snapshots.mjs,revisao/002_pendencias_snapshot.sql}.
Diff inclui adaptador de snapshot, revisão manual de pendências e componente MC6 não relacionado. Main App.jsx não referencia FretePendenciasPainel e arquivo retorna 404. Separar MC6 do fluxo comercial; não misturar equipamento e Frete. Dependências de captura/migração #60 e unificação #57 a verificar em lote 03. Descrição histórica registra checksum divergente em veiculos_motorista e pendências Auth/Storage; não assumir dados atuais. Testar JSON inválido, empresa alheia, edição sem inventar dados, preparação apenas inativos, duplicidade e preservação do legado. Não copiar dados, arquivos, credenciais ou aplicar SQL em produção.

## Continuidade
10/22 PRs com revisão inicial documentada; nenhum liberado para produção. Próximo lote 03: 62,60,58,57,56. Depois 04: 47,46,30,25,22; 05: 13,8. Os checks são resultados históricos no SHA indicado, não testes executados nesta auditoria. Não houve reprodução em navegador ou correção de código nesta etapa. Manter bloqueio de publicação até auditoria funcional e consolidação.
