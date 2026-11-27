# Consolidação documental — inventário inicial FORTE OP / PEDIDOS FT
26/11/2026. Fonte: cinco relatórios relidos nesta execução, PRs documentais #126–130 (branches audit/operacional-lote-01 a 05-20261125, arquivos docs/auditoria/2026-11-25/lote-NN.md). Não é aprovação final nem autorização de merge. Base de produção histórica #124 c20fed0ab09e4a1c64580dddb5cc7e8934f69524; deploy atual não verificado nesta execução.

| PR | SHA histórico | Checks históricos | Classificação inicial |
|---|---|---|---|
|125|b0fcb521eaa0f917f63f5f01c8a1bbe230711be1|4/4|Candidato, homologação pendente|
|117|c03e5b49e5a9329d3804352c2a4191439d845b96|2/4|Conflito, sobreposição|
|114|9822ea96c518636f32b204968144159449b88bd0|2/4|Conflito, OS parcialmente superada|
|109|3f5f93676aa8b064d49ee92a649cf64044eae1da|4/4|Conflito, correção seletiva|
|88|453e30ec5898b8221dc11fbe8de6b0c73dfb6efe|4/4|Candidato, homologação|
|79|87468d812aa5bcd3d0d83a846a643a25ada91d87|4/4|Conflito, sobreposição|
|71|d8ed133b8cec6e185eb7a2c4f117ff5a8b427d83|3/4|Conflito, CORS superado|
|70|01bcd5a233a56860297db6c2717a1e57676f8fdb|3/4|Conflito, correção|
|64|7eb5f7d6cfcf1e267d97b0245a85b89c9fa37a70|4/4|Conflito, depende 57|
|63|227c68e2eea3f7b3af6e891ba610e088f758aaa5|4/4|Separar MC6, homologar|
|62|7fc8f1aaf732ca05f888f96dbbb8772aa4d03f50|4/4|Depende 60, homologar|
|60|5ebb1c91af575dbaaeaab08de70cc2e93049518c|4/4|Depende 58/57, backup pendente|
|58|c0d75dba2bf872a889e774474ef09703163b4763|3/4|Check ausente, desenvolvimento|
|57|5247cad847eb9e0f3431f6e32bb116b17263b802|4/4|Conflito, revisão seletiva|
|56|2938be003f133d913ffea087dcf1b29d9e14e6c9|4/4|Conflito, sobreposição|
|47|554666aca2f9f792261ede6c1b00fc9e0ae0f68f|2/4|Sobreposição provável|
|46|39ca409ac74655db572c091b98b4891c513aff36|2/4|Conflito, balcão|
|30|8c33415045d2974dc1dd8d0fa2dc359aa9c5f415|2/4|Conflito, Frete externo|
|25|815de21d6b33b59f1a7e1caf415030527dda5d00|1/4|Conflito, depende 22|
|22|a9fcc6140eef3139bf5f0c285e5a888a0a93fd8e|0/4 confirmados|Conflito, segurança parcial|
|13|4ce9270cf69c3003b8faf8e50008e210213b27f2|1/4|Documentação, homologação|
|8|c59ab36a19b8ec6d802f349d07695ea6e0f7682e|1/4|Conflito, segurança parcial|

Arquivos, bases, branches e evidências detalhadas nos relatórios originais; lacunas de metadados do lote 01 devem ser preenchidas quando houver verificação específica. Nenhum dos 22 está aprovado para publicação. Inventário atual de PRs e main ainda deve ser reconfirmado; não repetir consultas históricas sem necessidade.

## Matriz de homologação (todos pendentes de evidência nova)
- OS e seis campos, compra, paletes, frota: #125/117/114/79. Testar navegação, voltar, retorno ao campo, vínculo/desvínculo, placa ocupada, troca OS, CIF/FOB, compra sem motorista, documentos por cliente, fechamento.
- Vendas, condições de pagamento e financeiro: #109/46/47. Testar 7/14/21, seleção múltipla, vencimentos, rascunho, conciliação, faturamento simulado, duplo clique, erro servidor, CNPJ divergente.
- Frete, perfis e migração: #64/63/62/60/58/57/56/30. Testar carga própria, isolamento, aceite idempotente, documentos, hash, backup restaurável, rollback, permissões, preservar Fiscal independente. Não aplicar migração real.
- WhatsApp/e-mail: #88/71/70/25/22/13. Testar paginação, histórico, não lidas, roteamento, assinatura, consentimento, falha parcial, anexos e opt-out com mocks, sem envio real.
- Itaú: #8/22. Testar chaves descartáveis, CSR inválido, timeout, erros HTTP simulados e ausência de segredos em logs. Sem cobrança ou acesso bancário real.
- Todos os cenários de UI: desktop e mobile, todos os botões, links, atalhos, modais, formulários, salvar/editar/cancelar, voltar, duplo clique, mensagens e persistência. Registrar cenário, SHA/base, ambiente, comando, resultado, evidência e lacuna.

## Próxima execução
Revisão residual em grupos de até cinco, começando por #22/#25/#13/#8 (segurança e contratos simulados), depois demais grupos conforme dependências. Priorizar #125 somente após revisão geral. Reproduzir falhas antes de corrigir em branches atualizadas; não mascarar testes. Este documento é preliminar e deve receber evidências posteriores antes de encerramento. Gate: quatro checks verdes no SHA exato, ausência de conflito/regressão, auditoria funcional completa, deploys live verificados em PEDIDOS FT srv-dc22hrmq1p3s73bjbksg e FORTE OP srv-daq10dbncjis73946ge0. Não mesclar relatórios, não publicar em bloco. Nenhum teste novo, correção, merge ou deploy nesta execução.
