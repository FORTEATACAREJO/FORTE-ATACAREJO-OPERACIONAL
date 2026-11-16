# Nanapay — Relatório de homologação técnica da demonstração
Data: 16/11/2026

## Identificação oficial
- Aplicativo: **Nanapay** (uma única plataforma: administrador, garçom e cliente).
- Serviço: `nanapay-forte` no Render, `https://nanapay-forte.onrender.com`.
- Branch: `homolog/nanapay`.
- Fonte em `nanapay/`, sem arquivos do antigo produto.
- Entrega **exclusivamente em homologação / demo**: nenhuma integração financeira ou PDV real foi autorizada.

## Matriz automatizada — aprovada no GitHub Actions
A suíte `nanapay/tests/smoke.mjs` executa o servidor real localmente e usa HTTP para conferir operações. A suíte `nanapay/tests/identity.mjs` valida o adaptador futuro de autenticação com respostas simuladas. `nanapay/database/test-tenant-security.sql` roda contra um PostgreSQL 17 isolado, SEM acessar bancos empresariais.

| # | Critério | Resultado |
|---|---|---|
| 01 | Site cliente, painel do restaurante, manifesto e ícones aprovados (192/512) acessíveis | APROVADO |
| 02 | Nome de instalação Nanapay em Android/iOS e cache atualizado | APROVADO EM TESTE AUTOMÁTICO |
| 03 | Código de estabelecimento no QR e entrada informando mesa + primeiro nome | APROVADO |
| 04 | Mesa diferente = comanda distinta; mesma mesa aberta = mesma comanda | APROVADO |
| 05 | Dois restaurantes não compartilham contas, clientes ou chaves | APROVADO |
| 06 | Lançamento pelo PDV antes do primeiro cliente contabilizado corretamente | APROVADO |
| 07 | Administrador configura restaurante; garçom só consulta; cliente não lê credenciais | APROVADO |
| 08 | Garçom revogado perde acesso imediatamente | APROVADO |
| 09 | Pedido do cliente não é cobrado antes de aceite pelo PDV | APROVADO |
| 10 | Solicitação repetida não gera pedido duplicado; alteração do mesmo identificador é rejeitada | APROVADO |
| 11 | Pedido aceito é cobrado uma vez; recusado não é cobrado; entrega é registrada | APROVADO |
| 12 | Troca de mesa requer confirmação do PDV; pedido posterior usa a nova mesa | APROVADO NO PROTÓTIPO |
| 13 | Serviço de 10% por cliente é opcional e afeta o rateio | APROVADO |
| 14 | Divisão da conta e pagamento parcial alteram o saldo somente após confirmação de caixa | APROVADO |
| 15 | Repetição do identificador de pagamento é idempotente; conflito é rejeitado | APROVADO |
| 16 | Devolução pendente não abate; recusa mantém item e motivo; aprovação no PDV abate | APROVADO |
| 17 | Pagamentos, movimentações e mudanças têm data/hora no histórico | APROVADO |
| 18 | Quitação requer saldo zero e nenhuma solicitação pendente; fechamento não é automático | APROVADO |
| 19 | Comanda fechada mantém histórico consultável durante a sessão de demonstração | APROVADO |
| 20 | RLS em 11 tabelas futuras, isolamento por chave composta e auditoria sem UPDATE | APROVADO EM POSTGRESQL ISOLADO |
| 21 | Auth por empresa, funções de administrador/garçom e revogação simulados | APROVADO EM TESTE UNITÁRIO |

### Limitações obrigatórias — não homologadas para produção real
1. **Persistência:** o serviço atual armazena contas, credenciais e históricos em RAM, com sessões de 3 horas. Reinício/redeploy apaga o estado. O SQL futuro está preparado e testado, mas **não aplicado em banco exclusivo**.
2. **Autenticação empresarial:** tokens aleatórios de demo; login real de administrador e garçom requer Supabase Auth ou alternativa com banco exclusivo, sem custo adicional não autorizado.
3. **PDV real:** o simulador usa comandos de caixa de teste. Yunes, TOTVS, Colibri e demais fornecedores não têm credenciais ou integração homologada. **Troca de pessoa de uma mesa para outra no PDV real, transferência de itens entre comandas e conciliação definitiva** ainda devem ser validadas antes de uso comercial.
4. **Cobrança da licença:** R$ 4,99/mês aprovado comercialmente; **sem cobrança real, sem cadastro de cartão, sem faturamento recorrente** no sistema atual.
5. **Privacidade e concorrência:** sessão atual é experimental; antes de produção é necessária autorização por comanda, trilhas imutáveis em banco e testes de resistência/reinício, múltiplos operadores e sincronização com o PDV.
6. **Aparelhos reais:** validação automatizada de arquivos PWA e ícones não substitui confirmação visual de instalação no Chrome Android e Safari iPhone.

### Ajustes implementados nesta rodada
- Chave de pagamento idempotente (`requestId`) no backend e no PDV simulado: repetição da mesma transação não debita duas vezes, conflito retorna HTTP 409.
- Repetição do identificador de pedido com dados divergentes bloqueada.
- Correção de subtotal quando caixa lança item antes de qualquer cliente entrar na mesa.
- Janela temporária de reaproveitamento do QR do restaurante após quitação, em vez de apagar o restaurante imediatamente na limpeza da memória.
- Testes adicionais de duas empresas isoladas, clientes antes/depois do lançamento, idempotência e segunda quitação.
- Todos os resultados são de **homologação do protótipo**, não autorização de produção.

## Critério para liberação comercial
O status só poderá mudar para **HOMOLOGADO PARA PRODUÇÃO** após ativar banco persistente e autenticação, integrar pelo menos um PDV real com auditoria e transferência, habilitar pagamentos recorrentes de forma segura (se autorizados), executar testes ponta a ponta com dispositivo real e obter autorização final da Forte.

**Não foi criada assinatura paga, novo projeto Supabase nem houve modificação dos sistemas FORTE-OP, FORTE FISCAL ou MC-6.**
