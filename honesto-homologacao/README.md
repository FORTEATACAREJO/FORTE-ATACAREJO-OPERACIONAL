# HONESTO — homologação inicial

**Titular do projeto:** FORTE ATACAREJO LTDA. (futura empresa HONESTO controlada pela FORTE, conforme estrutura societária a formalizar).

## Isolamento

Esta pasta está em uma branch exclusiva de homologação do repositório público FORTE OPERACIONAL, **sem alterações no branch main nem nos serviços operacionais existentes**. Contém apenas uma **demonstração pública com dados inventados**, sem segredos e sem código proprietário definitivo. O ambiente de produção do HONESTO deverá ficar em repositório privado independente.

## Executar

```sh
cd honesto-homologacao
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

O preço aprovado para a licença futura é R$ 4,99/mês por estabelecimento; cliente final será gratuito. O HONESTO não recebe pagamento pelo celular na primeira fase, por decisão expressa da FORTE.

## Independência futura

- Construir repositório privado `FORTEATACAREJO/HONESTO` assim que disponível;
- Criar banco exclusivo e ambiente seguro de homologação;
- Migrar código e configuração por infraestrutura como código, sem dependência dos bancos do FORTE FISCAL e OPERACIONAL;
- A marca e a tecnologia serão atribuídas à futura pessoa jurídica HONESTO conforme documentação societária, com a FORTE ATACAREJO LTDA. como controladora.

## Atualização — QR único e trocas de mesa (13/11/2026)

- QR Code único do restaurante, contendo apenas identificador do estabelecimento, não um QR exclusivo de cada mesa.
- Cliente informa número da mesa e primeiro nome; o aplicativo obtém a sessão de comanda referente àquela mesa no ambiente demonstrativo.
- Botão **Trocar mesa** ao lado do número atual; troca fica pendente até confirmação pelo **PDV simulado**, que continua sendo a interface usada pelo garçom.
- Número da mesa atual é um atributo do participante. O vínculo da comanda (itens, pagamentos e eventos) permanece igual, ainda que o participante mude de lugar.
- A conta **não é automaticamente quitada ao zerar o saldo**; somente o PDV pode confirmar quitação, e o histórico permanece acessível ao titular da sessão até essa confirmação.
- IMPORTANTE: o protótipo público usa dados inteiramente fictícios, memória volátil e acesso a mesas de demonstração apenas pelo número. Não é seguro para contas reais sem verificação adicional da mesa, acesso autorizado, RLS e banco persistente.
