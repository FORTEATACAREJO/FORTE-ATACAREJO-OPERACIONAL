# Evidências da continuidade da PR #57
**Data:** 2026-11-09  
**Branch:** `chore/forte-atacarejo-operacional-unificacao-20261109`  
**Situação:** revisão em branch. Nenhum merge, deploy, DDL/DML de produção, exclusão ou desligamento foi executado.

## Correção de código
A home unificada chamava o grupo inteiro de vendas de “Vendas externas” e o grupo de estoque/paletes de “Fretes e motoristas”. A tela `motorista` não pertencia a nenhum grupo, então quem não era administrador era devolvido ao início ao continuar uma carga.

- “Vendas externas” abre a tela `externas`.
- “Carga direta” abre a tela `clientes`.
- “Fretes e motoristas” abre a tela `motorista`.
- Financeiro e Integrações continuam nos grupos já existentes.
- A bandeira `venda-externa` abre só `externas`. A bandeira `carga-direta` abre `clientes` e `diretas`. A bandeira `frete` abre `motorista`. Nenhuma delas abre o Financeiro.
- Quem já pode operar Vendas ou Logística também consegue abrir `motorista`, que é o passo seguinte da carga.
- O atalho `?app=financeiro` não herda essas telas.

O acesso inicial da PWA continua exigindo aprovação no módulo Vendas. Usuário só de Frete, Venda Externa ou Carga Direta ainda não entra por essa porta. A administração do site não foi copiada: ela depende do pacote de acesso legado e da Central de Apps, e o rodapé público segue apontando para o serviço antigo durante a transição.

## Migração preparada, não aplicada
O validador puro de motorista da PR #57 foi mantido. O plano novo cobre motorista, veículo, rota, documento e usuário com chave `FORTE_FRETE:{entidade}:{id}`.

- Repetir o mesmo conteúdo preserva o registro.
- Dado mais antigo ou incompleto não cobre um cadastro mais novo e apto.
- Senha, token e bytes de anexo são recusados.
- Todo item gravado fica com `ativo=false`.
- O SQL está em `tools/migracao-frete/revisao/001_staging_frete_operacional.sql`, fora de `supabase/migrations`. Cria apenas o schema `migracao_frete`, com RLS e sem grant para `anon` ou `authenticated`. Não grava em `fc_app_state` e não promove cadastro.

O ensaio rodou no PGlite local. As contagens de 23 motoristas, 2 veículos, 5 rotas, 1 documento e 4 usuários permanecem as da auditoria já registrada; esta sessão não reconsultou o banco. Backup e restauração de produção não foram executados.

## Matriz dos cinco legados

| Origem | O que já está no Operacional | URL que permanece | Banco | Pode desligar |
| --- | --- | --- | --- | --- |
| FORTE-FRETE | Consulta de motorista, ponte de aceite e pagamento de frete no Financeiro | `forte-frete.onrender.com` | Supabase Frete, separado | Não |
| FORTE-FINANCEIRO | Módulo Financeiro na PWA, restrito a master com nuvem pronta | `forte-financeiro.onrender.com` | Tabelas financeiras do Operacional | Não |
| FORTE-VENDA-EXTERNA | Tela `externas` | `forte-venda-externa.onrender.com` | Operacional, após aprovação de Vendas | Não |
| FORTE-CARGA-DIRETA | Telas `clientes` e `diretas` | `forte-carga-direta.onrender.com` | Operacional | Não |
| SITE-FORTE-ATACAREJO | HTML e imagens públicas em `apps/web/public/site/` | `site-forte-atacarejo.onrender.com`, inclusive `/admin.html` | Sem banco próprio nesta cópia | Não |

FORTE FISCAL permanece repositório, serviço e banco separados. Nenhum dado fiscal foi lido ou alterado.

## Serviços Render lidos em 2026-11-09
Consulta somente leitura. Nada foi alterado.

| Serviço | Papel | Auto deploy da `main` | Destino até o corte |
| --- | --- | --- | --- |
| forte-vendas | PWA operacional | Sim | Permanece; é o frontend alvo |
| forte-vendas-app | Processo que inicia `itau-server.mjs` | Sim | API técnica; não unificar processo nesta etapa |
| forte-itau-api | API Itaú, também `itau-server.mjs` | Sim | Permanece separado |
| forte-whatsapp-api | API WhatsApp | Não; branch própria | Permanece separado |
| forte-financeiro | Frontend legado | Sim | Só depois do aceite |
| forte-venda-externa | Frontend legado | Sim | Só depois do aceite |
| forte-carga-direta | Frontend legado | Sim | Só depois do aceite |
| forte-frete | Frontend legado | Sim | Só depois do aceite |
| site-forte-atacarejo | Site e administração | Sim | Páginas públicas já copiadas; admin continua aqui |
| forte-fiscal | Emissão fiscal | Sim | Independente |
| forte-fiscal-pr91-homologacao | Homologação fiscal | Não | Independente |

## Privacidade, nome e MC-6
`FORTE-VENDAS` continua público. Não houve mudança de visibilidade, renome, domínio, OAuth ou webhook. O repositório privado de engenharia da MC-6 não foi criado e nenhum CAD foi adicionado. Esses passos continuam bloqueados até aceite específico, com o Operacional privado antes de receber desenho ou documento interno.

## Testes executados nesta sessão
- `npm run test:core`: 285 testes, 0 falhas. Inclui identidade, migração anterior, plano novo, permissão por tela e atalhos da home.
- `npm run test:rules`: concluído sem falha.
- `checks/workspace-navigation.browser.mjs` com Chrome local, larguras 390 e 1280: os dois passaram. A home mostra Vendas externas, Carga direta, Fretes e motoristas e o site em `/site/`.
- `checks/operations-navigation.test.cjs`: passou; os quatro painéis comerciais permanecem.

Não foi executado o fluxo autenticado em produção, QA em aparelho físico, nem a suíte Playwright ao vivo contra os domínios publicados.
