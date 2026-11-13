# SFT — cartão de crédito recorrente e nuvem compartilhada (implementação real)
Atualizado em 12/11/2026.

## O que foi implementado
1. Supabase projeto próprio `tusmlfhzwlzwnoxfhomt`: tabela pública protegida de planos `sft_recurring_plans`; contratos, eventos e auditoria de preços no schema `private`.
2. Plano `SFT_FISCAL_MENSAL_NUVEM`, modalidade `CREDIT_CARD`, ciclo `MONTHLY`, hospedagem `SHARED_CLOUD`; **valor não publicado**, sem precificação inventada.
3. Master pode aprovar um valor **apenas para testes** com justificativa; cliente administrador autorizado pode preparar o contrato.
4. Edge Function **implantada** `sft-billing-asaas-sandbox`, código versionado em `sft-billing/edge-functions/sft-billing-asaas-sandbox/index.ts`.
5. Backend usa Checkout hospedado no Asaas: `billingTypes = ["CREDIT_CARD"]`, `chargeTypes = ["RECURRENT"]`, `subscription.cycle = "MONTHLY"`. Dados de cartão ficam no Asaas, não nas tabelas do SFT.
6. Webhook com `asaas-access-token` próprio e consulta ao endpoint de cobrança do Asaas **antes** de contabilizar confirmação. Event ID gravado com restrição única; duplicatas não dão licença repetida.
7. Alteração de licença só por RPC server-only e contrato correto, assinatura externa previamente vinculada, valor igual ao plano, status confirmado/recebido e competência válida. Outras empresas não consultam esse contrato.
8. Interface `/admin.html` do Render atualizada com planos, definição de preço sandbox e solicitação de checkout de teste.
9. Ambiente **somente SANDBOX** por construção. Nenhum código de produção, credencial real, cobrança verdadeira ou emissão fiscal foi habilitado.

## Endereços
Painel: https://sistemas-forte-tech.onrender.com/admin.html

Função (JSON, não HTML):
- `GET https://tusmlfhzwlzwnoxfhomt.supabase.co/functions/v1/sft-billing-asaas-sandbox/health`
- `POST https://tusmlfhzwlzwnoxfhomt.supabase.co/functions/v1/sft-billing-asaas-sandbox/checkout` — exige JWT do administrador, URL de origem do Render, empresa e plano.
- `POST https://tusmlfhzwlzwnoxfhomt.supabase.co/functions/v1/sft-billing-asaas-sandbox/webhook` — somente Asaas com `asaas-access-token` válido.

O `GET /health` não inclui informações sigilosas; mostra booleanos de configuração. Supabase mostra função ACTIVE, mas um teste HTTP externo não pôde ser confirmado neste ambiente.

## Necessário antes de testar com Asaas
1. Criar a conta **separada** Asaas Sandbox: https://sandbox.asaas.com/.
2. Gerar a API key somente nesse ambiente e configurar o webhook com **outro token de alta entropia** de 32–255 caracteres. A chave de API do Asaas **não** deve ser reutilizada como authToken.
3. Configurar as variáveis na área de *Edge Function Secrets* do **projeto correto**:  
   - `ASAAS_SANDBOX_API_KEY`  
   - `ASAAS_WEBHOOK_TOKEN`  
   Nunca inserir tokens no GitHub, frontend, e-mail ou chat.
4. Cadastrar como URL do webhook o endpoint `/webhook` acima; assinar `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, estornos e chargebacks.
5. Habilitar a URL de retorno OTP do portal no Supabase e validar login Master com e-mail real confirmado. Criar uma empresa de teste e atribuir ao usuário ADMIN.
6. Definir preços comerciais por sistema e plano antes de faturar clientes; a interface atual publica preços **somente para Sandbox**.
7. Testar jornada ponta a ponta com cartões de teste Asaas: checkout, primeira cobrança, webhook, vínculo da assinatura, pagamento válido, renovação, falha, atraso, pagamento duplicado, reembolso, chargeback, cancelamento, retry e conciliação.

## Limitações técnicas deliberadas
- **Produção desabilitada.** Não utilizar credencial Asaas de produção no parâmetro `ASAAS_SANDBOX_API_KEY`.
- Eventos e assinaturas ainda não vinculados, inclusive quando a referência externa não é preservada pelo provedor, ficam **pendentes para conciliação**, sem concessão da licença. Essa associação deve ser homologada com dados reais do sandbox.
- Não existe fluxo homologado de cancelamento/alteração de cartão, estorno, e-mails automáticos, reconciliação diária, tolerância contratual, impostos sobre a assinatura ou cobrança em produção. São gates para go-live.
- A licença comercial paga autoriza somente o uso do produto adquirido, e **nunca** autoriza emissão fiscal não homologada.
- O cadastro de empresa atualmente exige Master; onboarding comercial self-service ainda precisa ser programado e testado.
- Plano de IA, consumo, custo e pagamento recorrente da IA são adicionais e não estão incluídos automaticamente no plano fiscal.
- Para disparar checkout de cartão verdadeiro é imprescindível conta Asaas de produção, habilitação comercial, testes e aprovação final.

## Testes executados em Supabase
- Plano sem preço não fica ativo; valor de teste publicado transacionalmente por Master fictício.
- Administrador de CNPJ pode iniciar contrato; sem pagamento licença não é liberada.
- RPC de serviço anexa checkout e assinatura de teste; evento idempotente simulado com valor exato confirma mensalidade; licença passa a ativa.
- Usuário autenticado não associado ao CNPJ não visualiza o contrato.
- Testes executados dentro de `BEGIN ... ROLLBACK` para não gerar clientes, preços ou licenças fictícios persistentes.
- Auditoria do Supabase: zero avisos de segurança no último check.

## Documentação Asaas (validada)
- https://docs.asaas.com/docs/checkout-com-assinatura-recorrente
- https://docs.asaas.com/docs/sobre-os-webhooks
- https://docs.asaas.com/docs/faq-de-webhooks
- https://docs.asaas.com/docs/sandbox
- https://docs.asaas.com/docs/link-do-checkout-e-redirecionamento-do-cliente


## Atualização de homologação — 13/11/2026

### Cadastro empresarial self-service com aprovação
- Usuário autenticado por e-mail pode solicitar um CNPJ via formulário no painel \`/admin.html\`.
- As solicitações são armazenadas em \`public.sft_company_signup_requests\`, com RLS permitindo ao solicitante consultar apenas os seus registros; o Master visualiza a fila.
- Formulário aceita CNPJ numérico ou alfanumérico validado no banco. CNAE, setor e regime informados são **declarações não verificadas**.
- E-mail não confirmado não pode solicitar; aprovação exige Master e justificativa documentando checagem externa de representação.
- Após aprovação, o novo solicitante ganha perfil ADMIN apenas no CNPJ autorizado, mas empresa continua com \`regime = A_DEFINIR\`, sem licença, sem estoque anterior e sem autorização de emissão fiscal.
- Testes SQL \`BEGIN/ROLLBACK\`: e-mail não confirmado bloqueado, usuário comum não aprova, Master vincula solicitante e CNPJ, regime continua pendente e licença não é liberada.

### Reconciliador de cobrança v2 (Edge Function ativa)
- Confirmado no código que o Checkout já possui \`externalReference\`; preservado no request.
- \`CHECKOUT_PAID\` vincula somente o id do checkout à fila de eventos; não concede licença.
- \`SUBSCRIPTION_CREATED\` verifica no Asaas a assinatura (\`ACTIVE\`, \`MONTHLY\`, cartão, valor do contrato e referência); se a referência não for preservada pelo provedor, a assinatura fica **pendente de conciliação**, sem associar CNPJ por nome ou e-mail.
- Recuperação pontual via \`GET /v3/subscriptions/{id}/payments\`, consulta e verifica cada cobrança confirmada, permitindo recuperar eventos de pagamento recebidos antes da associação da assinatura.
- Evento duplicado só pode ser vinculado a um CNPJ se metadados de pagamento/assinatura conferirem. 
- Nova tabela privada \`sft_billing_settled_payments\` impede usar uma mesma cobrança como pagamento de empresas diferentes. Reprocessar o mesmo pagamento não renova a licença novamente.
- Testes transacionais SQL aprovados para eventos órfãos, associação posterior, duplicidade e vigência, com rollback.
- Transmissão de cobranças **em produção desabilitada**. Não há conta Asaas Sandbox, chave API ou webhook token configurados nesta etapa. Código publicado e validado por sintaxe, mas **ainda não foi exercitado contra o Asaas ao vivo**.

### Prévias, validação e próximos bloqueios
- Login Master com e-mail real e allowlist de redirecionamento do Supabase Auth ainda requer teste integrado no navegador.
- Não configurar preços de assinatura comerciais ou tokens de pagamento em produção sem aprovação.
- Para integração de cartão de teste, é necessária uma conta Asaas Sandbox; configurar chaves no cofre de segredos, registrar webhook e homologar os eventos, incluindo estorno, inadimplência e cancelamento. Não enviar segredos pelo chat.
- Falta habilitar operação comercial: contratos jurídicos, NFS-e do SaaS, tratamento de inadimplência, backup/restauração, monitoramento, suporte e parametrizações fiscais homologadas.
