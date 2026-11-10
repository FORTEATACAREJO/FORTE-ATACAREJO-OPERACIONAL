# ADR — Arquitetura oficial FORTE ATACAREJO OPERACIONAL
Data: 2026-11-09
Status: APROVADA COMO DIRETRIZ; IMPLANTAÇÃO EM ETAPAS, SEM CORTE NESTA PR.

## Identidade e fronteiras definitivas

Há **somente dois sistemas empresariais**:

1. **FORTE ATACAREJO OPERACIONAL** — substitui a marca FORTE VENDAS; um aplicativo, uma autenticação por perfil, um repositório operacional e um projeto Supabase operacional. Nele ficam vendas, compras, balcão, vendas externas, cargas diretas, fretes, motoristas, estoque real, pallets, financeiro, caixa, bancos, WhatsApp, Gmail, site institucional e administração.
2. **FORTE FISCAL** — aplicativo totalmente independente: repositório, Supabase, identidade, certificado A1, estoques fiscais e emissão próprios. Mantém capacidade de emitir documentos sem vendas registradas no Operacional. Integração eventual somente por API restrita, auditada, opcional e sem acoplamento de disponibilidade ou banco compartilhado.

**FORTE MC-6 / FORTE CAD** é projeto de engenharia, não terceiro sistema comercial. Seus modelos, ferramentas e agentes poderão ficar na área `engineering/mc6` do futuro monorepo operacional, com pipeline e acesso segregados, sem interferir no runtime ou no banco comercial.

A **Central de Agentes FORTE** é infraestrutura de desenvolvimento/orquestração (ex.: n8n + executor CAD/código + GitHub), não outro sistema da empresa. Seus agentes não recebem credenciais de produção indiscriminadas e não comandam dispositivos industriais reais.

## Organização alvo

```text
FORTE-ATACAREJO-OPERACIONAL/       # repositório PRIVADO pretendido
  apps/operacional-web/             # única PWA adaptativa (admin, balcão, vendedor, motorista, carga direta)
  apps/site/                        # site institucional, mesmo domínio e repositório
  services/api/                     # integrações operacionais autorizadas
  services/workers/                 # automações e fila
  packages/core/
  packages/financeiro/
  packages/frete/
  packages/vendas-externas/
  engineering/mc6/                  # engenharia; fora do deploy do Operacional
  infra/                            # Render/Supabase; sem segredos
  workflows/n8n/                    # fluxos versionados, sem credenciais
  tests/

FORTEFISCAL/                        # repositório PRIVADO e aplicação independentes
```

Um único sistema funcional não significa obrigatoriamente um único processo no Render: API, workers, PWA e rotinas podem ser serviços técnicos separados, mas sem frontends/sistemas independentes para o usuário.

## Banco de dados

- Reutilizar o banco operacional atual e migrar para ele, com mapeamento e reconciliacão, os dados históricos/ativos do banco legado de fretes.
- Preservar IDs/relacionamentos, arquivos Storage, autenticação, Edge Functions, políticas RLS, logs, PDFs/documentos e histórico. Não copiar tabelas por nome nem sobrescrever sem reconciliar.
- Fiscal segue inteiramente separado; não unir Supabase, autenticação ou estoques. Credenciais e segredos jamais incluídos em repositório.
- Antes de qualquer migração: backups verificáveis, migração ensaiada em homologação, controle de duplicidade e plano de retorno, bloqueio de gravações concorrentes durante corte.
- Desativação/remoção de bancos legados somente após período de leitura, confronto de contagens e totais e aceite operacional.

## Interfaces e permissões

Uma PWA adaptativa: Master/Admin, Balcão, Vendedor Externo, Carga Direta, Motorista, Financeiro e Site. Cada papel vê apenas seu módulo; limites de acesso por empresa/unidade e autorização no servidor. Financeiro é MÓDULO, não aplicativo próprio; Frete é MÓDULO, não aplicativo de loja; Vendas Externas e Carga Direta são MODOS de tela no mesmo sistema.

## Agentes de IA

Central n8n pode monitorar GitHub/Render, executar testes e abrir PRs nos repositórios permitidos. Operacional e Fiscal com credenciais separadas e escopos mínimos; alteração de dados reais, deploy, emissão fiscal, operações bancárias, assinatura digital, exclusão e comandos físicos exigem aprovação humana explícita. Logs auditáveis e orçamento de IA com limite.

## Regras de transição

- A marca antiga pode permanecer somente em redirecionamentos/instalações antigas até migração assistida.
- Não apagar repositórios, bancos, serviços, registros, históricos e buckets antes de aceitação de corte.
- Não promover esta PR à produção sem smoke tests de mobile, autenticação, estoque, financeiro, frete, site, integrações e rollback.
- Renomear repositório e projeto Supabase somente após mapear CI, domínios, webhooks, URLs OAuth, service workers, instalações Android, redirects, apps de terceiros e integração Render.
