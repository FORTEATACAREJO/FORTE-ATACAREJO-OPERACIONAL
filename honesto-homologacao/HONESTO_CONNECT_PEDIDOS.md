# NANA PAY CONNECT — Solicitação de produtos do cliente ao PDV

Titular inicial do projeto: **FORTE ATACAREJO LTDA.**  (futura pessoa jurídica NANA PAY, controlada pela FORTE).

## Premissa de produto
O **cliente** é o usuário do NANA PAY. O **garçom não precisa instalar, abrir nem operar o NANA PAY**.

A única interface de trabalho do garçom continua sendo o software do restaurante. Na fase inicial, o cliente paga diretamente ao garçom ou caixa, nunca pelo NANA PAY. Na demonstração, a aba `PDV do restaurante (simulado)` serve **apenas para provar a comunicação** e **não representa um segundo aplicativo operacional para o garçom**.

## Opção independente por estabelecimento
`orders_enabled: false` por padrão em produção. Só habilitar depois de o restaurante **autorizar explicitamente** a recepção de pedidos e o fornecedor do PDV **homologar** o conector bidirecional. Se apenas leitura da comanda for possível, manter conferência/contestação/rateio e não mostrar o envio de pedidos.

## Passo a passo definitivo
1. O PDV autoriza uma sessão de comanda com identificador seguro e envia o cardápio vigente, preços, adicionais e disponibilidade.
2. Um cliente entra na mesa pelo QR Code e identifica seu próprio perfil. Para operação real, esse vínculo precisa de convite seguro/participante autenticado, e não de simples escolha do nome de terceiro.
3. Ele escolhe **chope**, quantidade e observação (ex.: “copo com gelo”, “sem limão”), e envia a solicitação.
4. NANA PAY CONNECT autentica o participante e encaminha a solicitação ao **conector previamente autorizado** pelo restaurante, com ID único e tentativas idempotentes. A solicitação informa ID da mesa/comanda, identificação do cliente, produto do cardápio, quantidade, observação, horário e ID único.
5. **O PDV do restaurante** apresenta o pedido na fila normal do garçom/cozinha, informando cliente e mesa. O garçom aceita/recusa no PDV que já usa.
6. O PDV responde **aceito** ou **recusado**. Se aceitar, o próprio PDV deve registrar o produto na comanda e enviar o evento de item lançado. Só esse evento autoriza inclusão na conta NANA PAY. A confirmação de entrega é um evento opcional posterior.
7. O NANA PAY mostra status atualizado ao consumidor. Sem resposta ou queda da internet: status “aguardando confirmação”; **nunca cobrar nem prometer atendimento automático**.

## Eventos previstos
- NANA PAY -> PDV: `customer_order.requested` com `order_id`, `establishment_id`, `session_id`, `table_id`, `customer_id`, `customer_display_name`, `menu_item_id`, `quantity`, `special_instructions` e `created_at`.
- PDV -> NANA PAY: `customer_order.accepted` (com `external_order_id`), `customer_order.rejected` (motivo), `order_item.recorded` (ID único do lançamento da comanda), `customer_order.delivered` (opcional), `order_item.cancelled` (quando aplicável).

Regras: todo evento deve possuir assinatura/autenticação e ID de idempotência, logs auditáveis, autorização por estabelecimento, rejeição de ID externo duplicado, expiração e reprocessamento de entregas falhas. Nunca confiar no preço enviado pelo cliente; o PDV deve validar preço, estoque, tamanho, horário e adicionais. O cliente pode alterar observações somente antes de o PDV aceitar, conforme política de atendimento.

## Fluxo de demonstração já implementado
- `POST /api/client/order`: solicita produto do cardápio mock, pessoa, quantidade e observação. NÃO cria item faturável.
- `POST /api/pdv/order-status` (credencial de demonstração): PDV simulado aceita, recusa ou marca como entregue. Na simulação, **aceitar** gera um lançamento no mesmo instante, representando a confirmação do PDV. Repetição não duplica o item.
- `POST /api/pdv/order-settings`: operador do PDV simulado habilita/desabilita a opção.
- `GET /api/session/:token`: expõe cardápio, solicitações, status e lançamentos da sessão fictícia.
- Atualização dos clientes por SSE e consulta de segurança.

## Limitações e requisitos antes de produção
A demo guarda informações em memória, usa nomes fictícios e **não se conecta a nenhum PDV verdadeiro**. O vínculo pessoa/comanda ainda não tem autenticação individual e o simulador de PDV é intencionalmente separado do fluxo comercial. O produto final exigirá banco persistente, RLS, autenticação do restaurante e dos participantes, chave de API restrita, filas/retries, limite de requisições, expiração e regras de cancelamento/estorno verificadas.

O cliente não deve enviar um pedido se a integração estiver offline ou incapaz de confirmar recepção. Oferecer alternativa “Chamar garçom” somente se o restaurante autorizar e o PDV tiver suporte a solicitações.

## Modelo de licenças
Consumidor gratuito. Restaurante R$ 4,99/mês por estabelecimento; recursos avançados opcionais não alteram a licença definida sem nova aprovação. Pagamento pelo celular permanece preparado apenas como capacidade futura, **desligada por padrão**.
