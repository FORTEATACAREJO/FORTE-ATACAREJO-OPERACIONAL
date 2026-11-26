# Auditoria FORTE OP / PEDIDOS FT — lote 01 de 05
Data: 25/11/2026. Base de produção conhecida: c20fed0ab09e4a1c64580dddb5cc7e8934f69524 (#124).
Escopo: revisão inicial de diff, metadados, checks e comparação dirigida com main. Nenhum merge ou alteração de produção. Não equivale à homologação integral.

| PR | SHA auditado | Mergeável | Checks PR (qualidade / financeiro-frete / WhatsApp / Connect) | Classificação |
|---|---|---|---|---|
| #125 | b0fcb521eaa0f917f63f5f01c8a1bbe230711be1 | Sim | OK / OK / OK / OK | Candidato; homologação funcional ampliada pendente |
| #117 | c03e5b49e5a9329d3804352c2a4191439d845b96 | Não | Falha / Falha / OK / OK | Sobreposição com main; comparar residual, não mesclar |
| #114 | 9822ea96c518636f32b204968144159449b88bd0 | Não | Falha / Falha / OK / OK | OS única já presente em main; comparar residual, não mesclar |
| #109 | 3f5f93676aa8b064d49ee92a649cf64044eae1da | Não | OK / OK / OK / OK | Rebase/reimplementação seletiva e validação financeira necessárias |
| #88 | 453e30ec5898b8221dc11fbe8de6b0c73dfb6efe | Sim | OK / OK / OK / OK | Candidato separado; testes atuais e integração coordenada pendentes |

## Evidências e critérios de encerramento
- #125: 9 arquivos, mudanças em OrdersWorkspace, PedidosFT, FleetLinkManager, navegação e testes. Diff mostra seis etapas, seleção independente de frota, ações centrais, tratamento de consulta de frota indisponível. Descrição do PR ainda cita oito campos. Testar persistência efetiva de vínculo/desvínculo, placa ocupada, erro de consulta, troca de OS, alterações não salvas via navegador, recuperação de documentos e fechamento. CI verde não comprova dispositivo real ou integrações reais. Não publicar até auditoria global.
- #117: 7 arquivos. Diff inclui troca via LOAD_ASSIGN, prévia Pedro e aprovação cadastral. main contém changeDossierDriver e onChangeDriver em OrdersWorkspace e PedidosFT. Não reaplicar branch antiga; comparar o comportamento e testes com main e #125. Confirmar preservação de OS, limpeza de vínculo e bloqueio de expedição sem documentos.
- #114: 16 arquivos. Diff inclui geração de OS, remoção de FC visual e mudanças em cadastros/PDF. main em orders-workflow/domain.mjs contém nextOS e codigo:os. O deploy #124 é referência de OS única. Comparar itens residuais de PDF, relatórios e apresentação; não mesclar branch antiga.
- #109: 8 arquivos. Diff inclui catálogo comum, condições por cliente e seleção de prazos completos, validação de vendas e deduplicação. Quatro checks históricos verdes não removem conflito. Verificar 7/14/21, 7/14/21/28, seleção múltipla, dados históricos, custo/modalidade Banco Fibra, persistência por empresa e cálculo de vencimentos. Tentativa de consulta de caminho supplier-payment-preferences.mjs em main retornou 404; usar listagem exata de arquivos antes de nova consulta.
- #88: 3 arquivos. Diff inclui cursor beforeMessageId, botão CARREGAR MENSAGENS ANTIGAS, deduplicação e teste de 455 mensagens. main em WhatsappInbox.jsx não contém beforeMessageId/loadOlder/texto do botão. Validar nova paginação sem perda/duplicação, concorrência, isolamento por empresa e compatibilidade com FORTE ATENDE. Não enviar mensagens reais.

## Controle de continuidade
Inventário inicial dos 22 PRs operacionais: 125,117,114,109,88,79,71,70,64,63,62,60,58,57,56,47,46,30,25,22,13,8.
Lote 02: 79,71,70,64,63.
Lote 03: 62,60,58,57,56.
Lote 04: 47,46,30,25,22.
Lote 05: 13,8.
PRs criados somente para relatórios de auditoria não integram a fila de PRs operacionais. Consultar relatórios existentes antes de repetir consultas; invalidar classificação se SHA ou base mudar. Registrar classificação e lacunas por lote; testar botões, operações e permissões em homologação, sem dados reais. Não considerar conflitos resolvidos por inventário inicial. Consolidação final deve listar todos os 22, testes e bloqueios. Publicação só após aprovação global, sem merges em bloco.
