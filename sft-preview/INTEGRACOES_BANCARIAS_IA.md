# Sistemas Forte Tech — Integrações Bancárias e IA

**Escopo:** módulo multiempresa independente do APP CFOP e do FORTE FISCAL.
**Estado:** infraestrutura de preparação e sandbox. **Nenhum banco, parceiro Open Finance ou modelo de IA foi conectado.**

## Contratos de integração
- `integration_connections`: cada conexão pertence a um CNPJ/empresa. Apenas configurações em sandbox, sem credenciais e sem transferência de dados.
- `bank_account_profiles`: conta bancária vinculada à conexão e empresa. Os dados exibidos são limitados à identificação e quatro últimos dígitos.
- `bank_statement_entries`: recebimento futuro de extratos normalizados, usando chave de idempotência por conta e referência externa, sem escrita direta pelo navegador.
- `bank_reconciliation_suggestions`: sugestões pendentes, sem baixa/contabilização automática.
- `ai_agent_profiles`: agentes previstos por finalidade e empresa, com revisão humana obrigatória, exportação de dados desativada.
- `ai_assistance_requests`: fila de metadados, sem prompt bruto ou documentos.
- `ai_review_suggestions`: resultado futuro pendente de revisão humana, sem permissão de escrita pelo navegador.
- `private.integration_event_receipts`: recibos de eventos, apenas hashes e metadados. Não expor diretamente na API.

## Conector bancário — implantação futura
1. Escolher banco, parceiro de API ou provedor de Open Finance **que aceite o produto e a empresa**; contratar, credenciar e validar modalidade de acesso (especialmente para pessoa jurídica).
2. Validar requisitos de consentimento do cliente, escopos, autorização, expiração e revogação conforme fluxo do parceiro e regras do Banco Central. Um simples cadastro de conexão no sistema **não constitui consentimento Open Finance**.
3. Conservar `client_secret`, certificados, tokens OAuth e segredos de assinatura **apenas no gerenciador de segredos do backend**, nunca nas tabelas públicas, no JavaScript, no GitHub ou nos logs.
4. Implementar adaptador específico por provedor no servidor com autenticação/mTLS/OAuth (quando necessário), requisições assinadas, limite de chamadas, retries controlados, timeout e observabilidade.
5. Validar assinatura de webhook sobre bytes brutos, timestamp contra replay, tenant/conta do evento, escopos, validade do consentimento e idempotência **antes de processar eventos**. Não usar evento não verificado como comprovação de crédito.
6. Normalizar saldo/extrato como valores decimais exatos (string ou centavos inteiros), com moeda, data, identificador externo e conta; não usar números float para valores monetários.
7. Homologar duplicidades, reversões, falhas de rede, paginação e conciliação manual; só então permitir, com aprovação separada, operações bancárias reais. **Iniciação de pagamento, transferências, Pix e cobranças não estão implementadas.**

## Integração de IA — implantação futura
1. Escolher provedor/modelo, condições de tratamento e retenção, limites de custo e credenciais do backend.
2. Aprovar por empresa e finalidade quais dados poderão ser compartilhados. Como padrão, **nenhuma informação empresarial é enviada**; dados pessoais, bancários e fiscais devem ser minimizados/mascarados e só transmitidos sob base legal e controles apropriados.
3. O conector deve aceitar **somente objetos estruturados com campos permitidos**, não instruções extraídas diretamente de notas, e-mails, XML, extratos ou páginas externas. Conteúdo externo é dado não confiável.
4. Validar JSON de saída, referências, confiança e fontes legais. A IA só sugere; nunca homologa NCM/CEST, tributos, emissão, pagamentos ou ajustes de estoque.
5. Toda sugestão deve ser revisada, aprovada/rejeitada e auditada por humano autorizado. Aplicar rate-limit, orçamento por empresa, retenção mínima e possibilidade de exclusão.
6. Testar prompt injection, vazamento entre empresas, respostas inventadas, falhas de API e tratamento de custos antes de ativar um modelo.

## Acesso e isolamento
- O front-end utiliza apenas chave **publishable** do Supabase e políticas RLS com `company_id`.
- Perfis ADMIN/CONTADOR podem visualizar configurações; apenas ADMIN cadastra conexões e agentes. Contador pode registrar solicitação de IA sem dados brutos.
- Tabelas de extratos, sugestões de conciliação e resultados da IA são de leitura para usuários autorizados; preenchimento será **somente por adaptadores de servidor autenticados**.
- **Não há dados financeiros ou prompts reais no banco nesta fase**.

## Infraestrutura atual
Supabase: `tusmlfhzwlzwnoxfhomt` (organização atual FORTE ATACAREJO, banco independente).
Render: https://sistemas-forte-tech.onrender.com/
Painel protegido: https://sistemas-forte-tech.onrender.com/admin.html
Base de código: branch `site/sistemas-forte-tech-preview-20261112` no repositório operacional, **pendente migrar para um repositório dedicado**.

## Etapas pendentes para operar
- Validar primeiro login Master e URLs de retorno no Supabase Auth.
- Contratar e autenticar bancos/parceiros e provedor de IA; instalar segredos no backend com rotação.
- Completar adapters reais, consentimentos, revogação e webhooks verificados; testar cenários ponta a ponta com cada empresa.
- Estabelecer LGPD, termos, limites por conta, retenção, backup e recuperação.
- Homologar regras tributárias antes de qualquer conclusão fiscal; NF-e/NFC-e/NFS-e ainda não estão operacionais.

**Regra irrevogável neste estágio:** nenhuma conexão recebe status ATIVO, nenhum agente transmite dados e nenhum módulo inicia pagamentos.
