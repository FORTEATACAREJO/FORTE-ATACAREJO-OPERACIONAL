# HONESTO — QR Code único, cadastro por nome e cardápio digital

**Projeto:** FORTE ATACAREJO LTDA. | **Ambiente atual:** homologação pública com dados fictícios.

## Comportamento do cliente
- **Um único QR Code por estabelecimento** abre o HONESTO. O QR informa apenas a identidade do estabelecimento. O cliente digita o número da mesa e o primeiro nome; o sistema vincula o participante à comanda autorizada.
- Se o HONESTO ainda não está instalado, o cliente pode **acessar imediatamente sem download**, com opção de instalá-lo como PWA na tela inicial. Não há instalação automática nem publicação Android/iOS neste protótipo.
- **Primeiro acesso:** um único campo — primeiro nome ou nome de preferência (2 a 40 caracteres), sem CPF, telefone, e-mail, senha, conta financeira ou cartão.
- O nome é armazenado localmente para acelerar futuras visitas. Cada entrada na mesa cria uma sessão de participante com token aleatório diferente; nome, sozinho, **não autentica** para movimentação financeira. O token local é temporário e a operação real terá controles de vínculo do participante mais robustos.
- Após informar mesa e nome, mostrar imediatamente **cardápio** (inclusive em estabelecimentos com pedidos desativados), **conta ao vivo**, divisão do consumo e serviço opcional.
- Se o restaurante tiver habilitado a integração bidirecional e autorizado pedidos pelo HONESTO, mostrar botão de solicitar produtos com quantidade e observações. O pedido informa mesa/comanda, nome do solicitante e observação no **PDV normal do garçom**.
- Pedidos solicitados **não entram na conta** até o PDV aceitar e enviar o evento de lançamento. O PDV é autoridade de preço, disponibilidade e confirmação.
- O recebimento permanece **presencial com garçom/caixa**. O HONESTO não paga contas pelo celular na fase atual.

## Para o restaurante
- Um único QR por **estabelecimento** será permanente no produto final. O usuário digita a mesa. O servidor validará o vínculo com a comanda atual, impedindo que pessoas de outras mesas consultem contas indevidamente.
- O cliente usa o HONESTO; **o garçom não precisa operar o HONESTO**, somente o sistema de PDV que já utiliza.
- O administrador do PDV configura o conector e autoriza a recepção de pedidos. **Modo padrão: cardápio + acompanhamento da conta**, sem enviar pedidos até homologação e aceite.
- É possível apresentar cardápio e conferência mesmo se o software de PDV não suporta pedidos originados pelo consumidor.
- Regras de cardápio: produtos, preço, disponibilidades, complementos, restrições e imagens devem vir de fontes autorizadas do restaurante; o aplicativo nunca define preço final sozinho.
- A ativação de pedidos deve ser configuração por estabelecimento, não ser imposta pela plataforma.

## Fase demonstrativa implementada
- Cada `/api/demo` cria uma simulação de estabelecimento com QR único para todas as suas mesas, com dados fictícios voláteis que vencem em 3h ou ao reiniciar a hospedagem gratuita.
- `POST /api/client/join` recebe **somente nome** e devolve token e identificador por dispositivo/cliente, evitando edição direta dos 10% de outra pessoa.
- `GET /api/session/:token` mostra cardápio e lançamentos. Interface de entrada funciona sem conta e oferece instalação PWA opcional.
- QR gerado **localmente no navegador**, com biblioteca MIT versionada na pasta `vendor`, sem envio do endereço da sessão a serviços terceiros.
- Pedidos passam pela fila de teste e pelo PDV simulado; links de convidados não incluem chave do operador.

## Itens obrigatórios antes do lançamento comercial
- Repositório **privado exclusivo** para o HONESTO, banco PostgreSQL dedicado e armazenamento durável.
- Vinculação de mesas a QR permanentes com rotação segura das sessões, validade, prevenção a reuso e autorização para ver conta de determinada mesa.
- Documentação de privacidade e exclusão de dados; limitar dados tratados ao mínimo, política LGPD.
- Cardápio sincronizado via catálogo do restaurante, preço real do PDV e disponibilidade atualizada.
- Autenticação e auditoria do conector do PDV, assinatura, idempotência, retries, filas e conciliação.
- Publicação efetiva do aplicativo nas lojas (quando aprovada) e configuração dos links associados para abrir no app instalado.
- Pagamentos móveis seguem **desativados**, e o restaurante recebe os valores normalmente no caixa.

**Licença futura:** R$ 4,99/mês por estabelecimento; cliente final gratuito.

## Nova regra: mudança de mesa e continuidade

- O número atual fica visível junto ao botão **Trocar mesa**.
- O cliente informa a nova mesa; o HONESTO envia uma solicitação ao sistema de atendimento e só considera a troca concluída quando **o PDV autorizar**.
- A comanda continua com o mesmo identificador e preserva consumos anteriores, cancelamentos, pedidos, pagamentos parciais e histórico de transferências. O local atual passa a ser o da nova mesa para os pedidos futuros.
- **Saldo zero não encerra a conta automaticamente**. O encerramento só ocorre após recebimento do evento de quitação do PDV.
- Na versão comercial, o histórico terá persistência durável até quitação; políticas legais de conservação e exclusão serão formalizadas para registros fiscais e dados pessoais.
- Medida antiacesso indevido: saber o número de outra mesa e fornecer um nome NÃO basta para autorizar a visualização da conta. Antes de usar dados reais, a integração deverá prever confirmação discreta pelo PDV/garçom ou outra prova de presença autorizada, sem transformar o cadastro em um formulário extenso.
