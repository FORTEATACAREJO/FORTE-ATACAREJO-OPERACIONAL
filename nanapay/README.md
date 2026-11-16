# Nanapay — homologação inicial

**Titular do projeto:** FORTE ATACAREJO LTDA. (futura empresa Nanapay controlada pela FORTE, conforme estrutura societária a formalizar).

## Isolamento

Esta pasta está em uma branch exclusiva de homologação do repositório público FORTE OPERACIONAL, **sem alterações no branch main nem nos serviços operacionais existentes**. Contém apenas uma **demonstração pública com dados inventados**, sem segredos e sem código proprietário definitivo. O ambiente de produção do Nanapay deverá ficar em repositório privado independente.

## Executar

```sh
cd nanapay-homologacao
node server.mjs
```

Acesse `http://localhost:10000`. Ao iniciar, o servidor cria uma mesa fictícia isolada por visitante. A aba do caixa recebe uma credencial efêmera exclusiva da demonstração; links de clientes são apenas de consulta e contestação. Cada instância de demonstração expira automaticamente após 3 horas. A persistência até quitação na versão comercial exigirá um banco durável e conciliação com o PDV.

## Funcionalidades

- Conta atualizada via eventos enviados por SSE, com consulta de segurança a cada 5 segundos;
- Simulador do garçom (lançar/cancelar produto);
- Conferência de consumo, contestação, serviço opcional de 10%;
- Rateio em partes iguais, por consumo ou do saldo restante;
- Pagamentos presenciais simulados, sempre lançados pelo caixa, sem dinheiro movimentado;
- Compartilhamento de acesso à comanda por link (QR Code e conectores reais pendentes);
- API sanitizada, chave de operador separada do link do cliente;
- Nenhum cartão de pagamento, CNPJ ou dado real é processado.

## Restrições — não homologado para produção

Armazenamento em memória é **volátil** e reinicia em cada implantação. Não há autenticação de restaurante real, LGPD operacional, backups, controles antispam, conectores com PDV externo ou cobrança de licença. Código meramente ilustrativo e público. Para entrar em produção, migrar para banco isolado PostgreSQL, autenticação e RBAC/RLS, HMAC e idempotência, observabilidade, monitoramento e infraestrutura próprias.

O preço aprovado para a licença futura é R$ 4,99/mês por estabelecimento; cliente final será gratuito. O Nanapay não recebe pagamento pelo celular na primeira fase, por decisão expressa da FORTE.

## Independência futura

- Construir repositório privado `FORTEATACAREJO/Nanapay` assim que disponível;
- Criar banco exclusivo e ambiente seguro de homologação;
- Migrar código e configuração por infraestrutura como código, sem dependência dos bancos do FORTE FISCAL e OPERACIONAL;
- A marca e a tecnologia serão atribuídas à futura pessoa jurídica Nanapay conforme documentação societária, com a FORTE ATACAREJO LTDA. como controladora.

## Atualização — QR único e trocas de mesa (13/11/2026)

- QR Code único do restaurante, contendo apenas identificador do estabelecimento, não um QR exclusivo de cada mesa.
- Cliente informa número da mesa e primeiro nome; o aplicativo obtém a sessão de comanda referente àquela mesa no ambiente demonstrativo.
- Botão **Trocar mesa** ao lado do número atual; troca fica pendente até confirmação pelo **PDV simulado**, que continua sendo a interface usada pelo garçom.
- Número da mesa atual é um atributo do participante. O vínculo da comanda (itens, pagamentos e eventos) permanece igual, ainda que o participante mude de lugar.
- A conta **não é automaticamente quitada ao zerar o saldo**; somente o PDV pode confirmar quitação, e o histórico permanece acessível ao titular da sessão até essa confirmação.
- IMPORTANTE: o protótipo público usa dados inteiramente fictícios, memória volátil e acesso a mesas de demonstração apenas pelo número. Não é seguro para contas reais sem verificação adicional da mesa, acesso autorizado, RLS e banco persistente.

## Diretriz: aceitação e recusa SOMENTE no PDV (13/11/2026)

A interface Nanapay do cliente `/` não possui abas, botões nem autorização para cancelar lançamentos ou aprovar/recusar devoluções. A pessoa pode solicitar a devolução, mas o item fica cobrado até a confirmação originada do **sistema do restaurante**.

Integração de produção: o PDV recebe a solicitação (identificador de comanda, item, participante, motivo) e envia decisão assinada de forma idempotente com `status=aprovada|recusada`, horário, ID externo de cancelamento e motivo obrigatório na recusa. **Somente** o registro confirmado do cancelamento no PDV poderá abater o saldo no Nanapay. A recusa mantém o item e mostra motivo e horário ao cliente. Nenhuma escolha do cliente tem autoridade para mudar a soma.

Para teste sem um PDV real, existe um **simulador técnico separado** em `/pdv-simulado`. Não é parte do Nanapay entregue a clientes nem um novo sistema a ser utilizado por garçons. A página apenas representa mensagens que, em operação real, deverão vir do PDV já existente. A rota pública de demonstração `/api/demo` não fornece chave de operador. A rota `/api/pdv-demo/create` é exclusiva da homologação e **deve ser removida/substituída** por autenticação empresarial real antes de produção.

## Evolução 14/11/2026 — Nanapay, plataforma única e três camadas

- **Cliente**: acesso pelo QR Code único, nome e mesa, na raiz `/`, sem acesso ao painel e sem confirmação de devoluções.
- **Administrador do restaurante**: acesso autenticado em `/painel` por credencial aleatória do próprio estabelecimento; configura nome, habilita pedidos, consulta comandas, gera QR Code e cadastra ou revoga acessos de garçons.
- **Garçom**: acesso individual em `/painel`, somente para visualização de mesas, pedidos e devoluções pendentes. **Não pode** modificar configurações, criar contas ou aprovar devoluções no Nanapay.
- **PDV real (futuro)**: continua sendo a única fonte autorizada para aceitar/recusar devoluções, lançar/cancelar itens, registrar pagamentos e quitação. `/pdv-simulado` é apenas infraestrutura de testes e não é uma quarta camada do aplicativo.
- **Licença**: valor previsto de **R$ 4,99/mês**, cobrança recorrente no cartão escolhido pelo administrador; **nenhuma cobrança, armazenamento de cartão ou assinatura ativa nesta demonstração**.
- **Identidade visual**: nome Nanapay, marca em preto/verde, ícone vetorial que adapta o símbolo N + recibo + cartão aprovado; o material raster final deve ser sincronizado com as versões PNG do PWA antes da distribuição.

### Limitações antes de produção

O ambiente atual permanece **volátil em memória**, com credenciais de demonstração obtidas pela criação pública de um restaurante fictício, sem login empresarial definitivo, dados pessoais persistentes, pagamentos reais ou integração homologada com PDVs. É necessário migrar para banco com isolamento por restaurante, autenticação real, auditoria imutável e gateway autorizado de cobrança antes de disponibilizar comercialmente. Preservar a regra de que o cliente não deduz itens unilateralmente.
