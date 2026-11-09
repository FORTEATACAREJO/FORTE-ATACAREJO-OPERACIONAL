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

O acesso inicial da PWA aceita aprovação de Vendas ou do módulo de Frete. A administração pública do site deixou de apontar para `site-forte-atacarejo.onrender.com`, que não responde mais, e volta para a raiz do próprio domínio.

## Migração preparada, não aplicada
O validador puro de motorista da PR #57 foi mantido. O plano novo cobre motorista, veículo, rota, documento e usuário com chave `FORTE_FRETE:{entidade}:{id}`.

- Repetir o mesmo conteúdo preserva o registro.
- Dado mais antigo ou incompleto não cobre um cadastro mais novo e apto.
- Senha, token e bytes de anexo são recusados.
- Todo item gravado fica com `ativo=false`.
- O SQL está em `tools/migracao-frete/revisao/001_staging_frete_operacional.sql`, fora de `supabase/migrations`. Cria apenas o schema `migracao_frete`, com RLS e sem grant para `anon` ou `authenticated`. Não grava em `fc_app_state` e não promove cadastro.

O ensaio do SQL rodou no PGlite local. A releitura abaixo conferiu as contagens críticas direto nas tabelas, sem copiar cadastro e sem imprimir documento, telefone ou chave. Backup e restauração de produção não foram executados.

## Matriz dos cinco legados

| Origem | O que já está no Operacional | Situação vista nesta releitura | Banco | Pode apagar |
| --- | --- | --- | --- | --- |
| FORTE-FRETE | Consulta de motorista, ponte de aceite e pagamento de frete no Financeiro | Repositório público agora chamado FORTE-MC-6. URL `forte-frete.onrender.com` no ar | Mesmo projeto Supabase, nome visível FORTE-MC-6 | Não |
| FORTE-FINANCEIRO | Módulo Financeiro na PWA, restrito a master com nuvem pronta | Repositório público e serviço Render ausentes. URL responde 404 | Tabelas financeiras do Operacional | Não |
| FORTE-VENDA-EXTERNA | Tela `externas` | Repositório público e serviço Render ausentes. URL responde 404 | Operacional | Não |
| FORTE-CARGA-DIRETA | Telas `clientes` e `diretas` | Repositório público e serviço Render ausentes. URL responde 404 | Operacional | Não |
| SITE-FORTE-ATACAREJO | HTML e imagens públicas em `apps/web/public/site/` | Repositório público e serviço Render ausentes. O rodapé do site incorporado volta para `/` | Sem banco próprio nesta cópia | Não |

FORTE FISCAL permanece serviço e banco separados. O nome visível do projeto é FORTE-FISCAL. Nenhum dado fiscal foi copiado ou alterado.

## Releitura depois das alterações de nome — 2026-11-09
Consulta somente leitura. Esta sessão não renomeou, não apagou, não fez deploy e não gravou em banco.

### GitHub
- `FORTE-VENDAS` redireciona para `FORTE-ATACAREJO-OPERACIONAL`. O repositório continua público.
- `FORTE-FRETE` redireciona para `FORTE-MC-6`. O repositório continua público e o conteúdo segue sendo o aplicativo FORTE FRETE. Não é um repositório novo de engenharia e não recebeu CAD nesta sessão.
- `FORTE-FISCAL` não aparece para este token. O Render ainda liga o serviço fiscal a `github.com/FORTEATACAREJO/FORTE-FISCAL`.
- `FORTE-FINANCEIRO`, `FORTE-VENDA-EXTERNA`, `FORTE-CARGA-DIRETA` e `SITE-FORTE-ATACAREJO` não resolvem no GitHub público e não têm redirecionamento.

### Supabase
Os três projetos continuam ativos e saudáveis. Mudou o nome visível; o identificador técnico é o mesmo.

| Nome visível agora | Identificador | O que a leitura encontrou |
| --- | --- | --- |
| FORTE-ATACAREJO-OPERACIONAL | `gtwecfyffjszghnvtlzr` | Base operacional. `fc_motoristas` e `fc_veiculos` seguem com 0 linhas. |
| FORTE-MC-6 | `nkynfboqwfxhhxcsrawl` | Continua sendo a base do Frete: 23 motoristas, 2 veículos, 5 rotas, 1 documento de motorista e 4 usuários. Não apagar nem tratar como banco vazio de engenharia. |
| FORTE-FISCAL | `xmfpvvmvdkepmnvtdoio` | Base fiscal separada. Nenhum dado foi copiado para o Operacional. |

### Render
Seis serviços permanecem. O deploy ao vivo não mudou: o site operacional publica o commit de 27/10 e o endereço `forte-frete.onrender.com` publica o commit de 26/10. Os dois ainda fazem auto deploy da `main`. O serviço do Frete foi renomeado para FORTE-MC-6 e aponta para o repositório de mesmo nome, mas a URL pública antiga continua de pé.

Estão ausentes no workspace e respondem 404: `forte-financeiro`, `forte-venda-externa`, `forte-carga-direta`, `site-forte-atacarejo` e `forte-vendas-app`. Esta sessão não os removeu e não os recriou. `forte-fiscal.onrender.com` e a homologação fiscal responderam. `forte-itau-api` e `forte-whatsapp-api` continuam cadastrados; a raiz HTTP não respondeu 200 nesta verificação.

## Privacidade e engenharia
Os dois repositórios visíveis, Operacional e MC-6, estão públicos. O MC-6 público é o código do Frete. Desenho, CAD e documento interno continuam fora do Git até existir um repositório privado de engenharia, separado dessa base que ainda guarda os motoristas.

## Acesso autorizado ao FORTE-FISCAL
Leitura feita com autorização explícita. Nenhum dado fiscal foi copiado para o Operacional, nenhuma migração foi aplicada e nenhum deploy foi disparado.

- O repositório `github.com/FORTEATACAREJO/FORTE-FISCAL` continua invisível para o token deste agente. Não há clone nem PR fiscal aberta a partir daqui.
- O projeto Supabase `xmfpvvmvdkepmnvtdoio` está ativo e saudável, com o nome FORTE-FISCAL. A última migração registrada é `pr91_preserve_xml_unit_value_precision`. Há 11 Edge Functions ativas, entre elas o motor `fiscal-engine-ledger`.
- Em produção, `forte-fiscal.onrender.com` publica o commit `f631f3c` de 04/11, vindo da `main`, com auto deploy ligado.
- A homologação `forte-fiscal-pr91-homologacao.onrender.com` publica o commit `de5c7e0` de 09/11, na branch `spec/parametrizacao-legal-mg-go-20261104`, com auto deploy desligado.

## Testes executados nesta sessão
- `npm run test:core`: 285 testes, 0 falhas. Inclui identidade, migração anterior, plano novo, permissão por tela e atalhos da home.
- `npm run test:rules`: concluído sem falha.
- `checks/workspace-navigation.browser.mjs` com Chrome local, larguras 390 e 1280: os dois passaram. A home mostra Vendas externas, Carga direta, Fretes e motoristas e o site em `/site/`.
- `checks/operations-navigation.test.cjs`: passou; os quatro painéis comerciais permanecem.

Não foi executado o fluxo autenticado em produção, QA em aparelho físico, nem a suíte Playwright ao vivo contra os domínios publicados.
