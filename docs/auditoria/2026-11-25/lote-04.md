# Auditoria FORTE — lote 04/05
26/11/2026. Relatórios 01–03 lidos. Revisão estática dos cinco PRs, checks históricos por SHA, arquivos e comparação dirigida com main. Sem homologação nova.

| PR | Branch | SHA | Base SHA | Mergeável na base declarada | Qualidade / Financeiro-Frete / WhatsApp / Connect |
|---|---|---|---|---|---|
|47|audit/preservar-cadastro-cnpj-20261021|554666aca2f9f792261ede6c1b00fc9e0ae0f68f|aa61bf28420ac2fc4094fb6878c7c8324dbf0caf|Sim|OK/OK/ausente/ausente|
|46|fix/vendas-balcao-botoes-operacionais-20261021|39ca409ac74655db572c091b98b4891c513aff36|aa61bf28420ac2fc4094fb6878c7c8324dbf0caf|Não|OK/OK/ausente/ausente|
|30|feat/ciclo-carga-documentos|8c33415045d2974dc1dd8d0fa2dc359aa9c5f415|7304235260cf69dd76cd53876e92157d14829eb5|Não|OK/OK/ausente/ausente|
|25|audit/whatsapp-three-modules-20261013|815de21d6b33b59f1a7e1caf415030527dda5d00|983273dd0b3ed1d11d1c6b21fab69d5c548a3ea1|Não|OK/ausente/ausente/ausente|
|22|fix/whatsapp-webhook-signature-20261013|a9fcc6140eef3139bf5f0c285e5a888a0a93fd8e|fd15e4cd7c45af294106d2fe68eaca038876217d|Não|ausente/ausente/ausente/ausente|

## #47 — sobreposição provável; não mesclar sem comparar residual
Arquivos: apps/web/src/App.jsx, customer-address.js (mesmo diretório), checks/customer-address.test.mjs. Diff completa campos vazios, protege CNPJ divergente e preserva dados conferidos. Main contém mergeMissingCustomerDetails em App.jsx e customer-address.js. Testar consentimento, troca de CNPJ durante consulta, dados vazios, preservação de endereço/telefone e falha de rede com dados fictícios. Dois checks ausentes; presença de função não prova equivalência.

## #46 — conflito e sobreposição parcial
Arquivos: apps/web/src/{App.css,App.jsx,HomeCompactV47.jsx}, checks/{counter-balcao.browser.mjs,workspace-navigation.browser.mjs}, package.json, tests/current-account-simulation.cjs. Diff introduz commitCounterSale, confirmação do servidor, bloqueio de duplo clique e atalhos. Main App.jsx contém commitCounterSale e balcaoFastActions. Comparar residual, testar abertura caixa, nova venda/orçamento, adicionar item, produtos, exclusão apenas rascunho, boleto, erro servidor e preservação do rascunho, concorrência e permissões. Não emitir nota nem gerar cobrança real. Dois checks ausentes.

## #30 — conflito e dependência externa Frete
14 arquivos: apps/web/src/{FreteRequestsPanel.jsx,OrdersWorkspace.jsx,orders-reports.js}, checks/{ciclo-carga.test.mjs,frete-sync-edge.test.cjs}, docs/CICLO_CARGA_2026-10-18.md, integrations/forte-frete/vendas-frete-bridge/{driver-pdf.mjs,index.ts}, package.json, supabase/functions/orders-workflow/{capacity.mjs,domain.mjs,index.ts}, supabase/functions/sync-frete-acceptances/{index.ts,operation.mjs}. Diff inclui atualização após aceite, PDFs, conferência de quantidades e bloqueio fechamento FOB. Main FreteRequestsPanel.jsx não contém onRefresh; verificar implementação equivalente e contratos atuais, não reaplicar automaticamente. Dependência migração documentos_motorista_carga e bridge/frontend Frete da branch homônima. Testar aceite idempotente, OS preservada, documentos por motorista/empresa, XML/PDF originais, capacidade, comprovante FOB e sincronização sem painel aberto. Testes históricos citados pelo autor não foram repetidos; dois checks ausentes.

## #25 — conflito, depende #22
Arquivo whatsapp-server.mjs. Diff acrescenta encaminhamento opt-in Frete e nomes de destinos em logs. Base é branch #22 em SHA anterior ao head atual. Main não contém WHATSAPP_FRETE_WEBHOOK_ENABLED. Não ativar encaminhamento indiscriminado: verificar roteamento por evento/empresa, duplicidade, falha parcial, reenvio, ausência de conteúdo privado nos logs, Fiscal independente. Endpoint Frete e homologação pendentes; três checks ausentes.

## #22 — conflito, segurança parcialmente presente em main
Arquivos checks/whatsapp-webhook.test.mjs, itau-server.mjs, package.json, whatsapp-server.mjs. Diff introduz validação HMAC e testes de assinatura, GET e encaminhamento simulado; main whatsapp-server.mjs contém validSignature e timingSafeEqual. Comparar comportamento efetivo e regressão Itaú, rejeição de assinatura ausente/inválida, segredo ausente, corpo alterado e logs sem dados privados. Nenhum check retornado para SHA; não inferir aprovação. Não alterar segredos ou enviar mensagens.

## Continuidade
20/22 PRs com revisão inicial registrada. Próximo lote 05: #13 e #8. Nenhum teste novo executado, nenhuma falha reproduzida ou código corrigido nesta etapa. A comparação por símbolos é evidência parcial, não prova de equivalência. Nenhum merge ou publicação. Gate global permanece bloqueado. Após lote 05, consolidar e auditar cenários funcionais e alterações residuais em branches atualizadas, em lotes de até cinco.
