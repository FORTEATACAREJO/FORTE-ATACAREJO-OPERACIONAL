# Nanapay — Conta, Pedir outra e Chamar garçom
Data da implementação: 16/11/2026
Ambiente: `https://nanapay-forte.onrender.com` (homologação).

## Entrada do cliente

- Um QR Code **por restaurante**, sem exigir QR por mesa, aponta para `/?code=XXXXXXXX`. O estabelecimento também mostra o mesmo código de 8 caracteres para digitação.
- O cliente informa mesa e primeiro nome; o servidor resolve o código para o restaurante e associa a mesa existente à mesma comanda enquanto aberta.
- O código identifica somente o estabelecimento: **não** permite acesso ao caixa ou às credenciais administrativas.
- Todos os dados continuam simulados e temporários, pois o banco permanente ainda não foi provisionado.

## Tela do cliente

1. **Conta detalhada**: itens efetivamente lançados pelo PDV, quantidades, valor unitário, subtotal, valores pagos, saldo e operações de devolução.
2. **Peça novamente com um toque**: lista de nomes únicos, apenas de produtos ativos já lançados nesta comanda, com botão **Pedir outra**. Funciona mesmo quando o item original não está no menu online, pois o servidor identifica produto e referência do item registrado no PDV.
3. Clicar em **Pedir outra** solicita **1 unidade adicional**, com identificação do cliente e mesa. A conta não é acrescida até o PDV aprovar o pedido; solicitações repetidas são idempotentes por identificador.
4. **Chamar garçom**: botão grande envia chamado com identificador, nome, mesa, data/hora. O cliente acompanha os estados “Aguardando”, “Garçom a caminho”, “Atendido”. Enquanto um chamado está ativo, novos toques não geram várias notificações; após atendimento pode chamar novamente.
5. Cardápio completo e formulário tradicional permanecem disponíveis abaixo; por eles ainda é possível escolher outros produtos e quantidades.

## Tela do garçom

- Painel exclusivo do estabelecimento recebe chamadas e pedidos com mesa, nome e horário; atualização automática a cada 4 segundos.
- Garçom autorizado pode clicar **Estou a caminho** / **Atendido** para atualizar somente o chamado.
- Pedidos aguardando aparecem destacados, mas **aceitar, recusar, cancelar ou cobrar itens permanece responsabilidade do PDV**. O painel não confere essas permissões ao garçom.
- Opcionalmente, o navegador exibe notificações do sistema com a permissão dada pelo atendente e o painel aberto. **Não existe push persistente em segundo plano com aplicativo fechado** nesta demonstração.

## Homologação automática

`nanapay/tests/quick-actions.mjs` valida via HTTP:
- Código curto e QR vinculando o mesmo estabelecimento/mesa.
- Tela com conta acima dos botões de nova solicitação e acima do cardápio.
- Produto lançado no PDV e ausente do cardápio online reaproveitado com **Pedir outra**.
- Solicitação sem cobrança até aprovação no PDV, pedido duplicado não relançado.
- Chamado de garçom sem autenticação rejeitado; chamada válida visível na mesa correta.
- Confirmação **a caminho/atendido** por garçom, sem acesso ao PDV.
- Isolamento entre restaurantes e bloqueio de novos pedidos se o admin desativar o canal.

**Status:** funcionalidade de demonstração homologada via testes HTTP e GitHub Actions. Não equivale a autorização de uso comercial, conexão com PDV real, cobrança recorrente ou persistência após reinicialização.
