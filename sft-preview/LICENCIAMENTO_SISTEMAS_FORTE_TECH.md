# Sistemas Forte Tech — Licenciamento por Sistema e por Empresa

**Implementado no projeto exclusivo Supabase `tusmlfhzwlzwnoxfhomt`.**

## Modelo comercial

Cada **sistema** (produto de software) é contratado de forma independente por **empresa** (`company_id`, que contém uma raiz CNPJ e sua matriz/filiais).

- Uma empresa pode usar matriz e suas filiais com **uma licença empresarial do mesmo sistema**, enquanto estiverem cadastradas na mesma entidade jurídica.
- Outra empresa, ainda que pertença ao mesmo grupo econômico, precisa de **licença própria**.
- Licenciar o Setor Fiscal Multiempresa não licencia automaticamente o aplicativo independente Consulta Inteligente de CFOP e vice-versa.
- `SFT_CONSULTA_CFOP` está apenas registrado para **integração futura**; este código não integra nem altera o aplicativo CFOP real.
- Sistemas externos (FORTE FISCAL legado, FORTE OPERACIONAL, MC-6) **não foram alterados**. Somente após integrar seu serviço de autenticação ao controle de licenças terão fiscalização de uso equivalente.

## Catálogo e controle

`public.sft_system_catalog`: nome, código e status técnico de integração.

`public.sft_company_system_licenses`: vincula uma pessoa jurídica a um sistema, com:
- modalidades `ASSINATURA`, `TESTE`, `INTERNA`;
- status `PENDENTE`, `ATIVA`, `SUSPENSA`, `CANCELADA`;
- período `starts_at` e `ends_at`, **fim exclusivo**, testados no horário do servidor;
- plano e referência contratual, mas **sem valores de cobrança ainda**;
- uma licença por combinação empresa+software.

A vigência efetiva exige:
1. empresa ativa;
2. produto habilitado e tecnicamente integrado;
3. licença com status `ATIVA`;
4. início já atingido e vencimento ainda futuro.

Não há chave de licença no navegador: a autorização é por CNPJ, sistema e login autenticado, conferida no Supabase com relógio do servidor.

## Segurança

- `private.is_company_system_licensed(company_id,system_code)`: guarda do servidor.
- Funções de controle corporativo `private.can_access_company`, `private.can_access_establishment`, `private.has_company_role` e `private.can_manage_accounting` verificam a licença da plataforma.
- **36 tabelas empresariais** possuem, além de seus filtros por CNPJ, uma política RLS restritiva `license_sft_access_required`.
- Dados mínimos de cadastro da empresa e situação contratual continuam consultáveis por membros autorizados quando a licença expira, para permitir renovação.
- Administrador Master também precisa de licença válida para operar dados empresariais; pode consultar o registro da empresa e regularizar a licença sem ela.
- Nenhum cliente pode criar, atualizar ou ativar sua própria licença via API/SQL.
- `public.set_company_system_license`: fachada SECURITY INVOKER que delega ao serviço privado, autorizando somente Master identificado pelo `auth.uid()`. Justificativa obrigatória.
- `public.get_company_system_license_status`: retorno seguro, usando hora do servidor e exigindo permissão para consultar a empresa.
- Auditoria privada `private.sft_license_events` e trilha em `public.audit_entries`.

## Interface

O painel protegido `/admin.html` contém seção de licença. Quando não há licença válida, oculta módulos operacionais, mas exibe o estado e o formulário Master para concessão/renovação/suspensão. A versão pública de demonstração `/` permanece acessível sem licença, **sem dados reais**.

## Testes executados (transações revertidas)

- Sem licença: não há acesso a produto empresarial autenticado, mas empresa aparece para renovação.
- Licença ativa e no prazo: produtos do próprio CNPJ aparecem para membro autorizado.
- Suspensa, vencida ou início futuro: dados ficam bloqueados imediatamente.
- Outra licença de produto, inclusive Consulta CFOP ainda não integrada: não autoriza Setor Fiscal.
- RPC de concessão: Master autenticado permitido, usuário comum rejeitado.
- RPC de consulta: Master permitido, usuário sem vínculo rejeitado.
- Todas as linhas utilizadas nos testes foram **revertidas** via ROLLBACK; nenhuma empresa de demonstração foi preservada.

## Pendente antes da comercialização

1. Validar primeiro login Master, cadastro real do CNPJ e o primeiro fluxo de concessão via navegador.
2. Contratos, preço, cobrança, emissão de fatura, renovação por pagamento, cancelamento comercial, eventual período de tolerância e política de inadimplência — **ainda não implementados**.
3. Se cobrar assinatura recorrente, integrar prestador de pagamento confiável via webhook assinado e idempotência; jamais conceder licença apenas por confirmação de frontend.
4. Conectar cada sistema independente ao serviço de verificação, sem compartilhar bancos de dados de clientes ou tokens indevidamente.
5. Definir termos contratuais, LGPD e recuperação de acesso; testar ambientes e limitações de sessão.
6. Fiscal: homologação legal e SEFAZ permanece completamente separada de uma licença comercial.

**Proibido:** usar o status comercial para inferir homologação fiscal. Licença ativa nunca autoriza, por si só, emissão de NF-e/NFC-e/NFS-e.
