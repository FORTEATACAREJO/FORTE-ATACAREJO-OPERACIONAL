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
- A homologação `forte-fiscal-pr91-homologacao.onrender.com` publica o commit `de5c7e0` de 09/11, na branch `spec/parametrizacao-legal-mg-go-20261104`, com auto deploy desligado. O deploy ao vivo continua sendo `dep-dbp34b7f3r2c73etp460`. Não houve novo deploy: o commit publicado já é o conferido.

## Execução de 09/11 — Fiscal e Frete
A ordem de execução autorizou escrita no Fiscal e a migração do Frete. O que foi feito fica limitado ao que pôde ser conferido sem o código fiscal e sem inventar cadastro.

### Fiscal
O token deste agente continua sem acesso a `github.com/FORTEATACAREJO/FORTE-FISCAL`. Sem esse repositório não há como continuar o código das PRs #91 e #94 nem publicar uma versão nova na homologação. A homologação já está no commit `de5c7e0` e foi deixada como está.

Conferência no banco `xmfpvvmvdkepmnvtdoio`, sem alterar documento, numeração, XML, protocolo, certificado, evento ou teste:

- A tabela de corte de produção não tem linha. O corte permanece desligado.
- A NFC-e modelo 65, série 889, número 4, ambiente de homologação, UF GO, permanece cancelada.
- Os 18 cenários de `tax_homologation_tests` continuam pendentes. Nenhum foi marcado como aprovado sem retorno da SEFAZ.
- As duas exclusões de produto citam CIPLAN e 33 kg. A exclusão foi preservada.
- Não há linha em `nfce_settings`. Nada foi inserido para não abrir emissão.

Nenhuma transmissão real foi feita. `cutover_enabled` não foi ligado.

### Frete, da base MC-6 para o Operacional
A cópia das 151 linhas em `frete_migracao.snapshots` foi conferida de novo e não foi refeita. As assinaturas de época de motoristas, veículos, rotas e usuários coincidem entre a origem `nkynfboqwfxhhxcsrawl` e o snapshot. Não há incremento posterior à captura. Os dois veículos apontam para motoristas existentes.

Nenhum dos 23 motoristas tem, ao mesmo tempo, CPF, telefone, CNH, Pix, proprietário e veículo com placa e capacidade. Por isso nada foi gravado em `fc_motoristas` nem em `fc_veiculos`, que seguem com 0 linhas. Não foi inventado CPF, CNH, telefone, Pix ou capacidade.

A migration `frete_pendencias_sem_inventar_dados` criou três tabelas no schema `frete_migracao`, com RLS e sem permissão para `anon` ou `authenticated`:

- `pendencias`: 23 cadastros. Faltam capacidade em 21, CNH em 14, proprietário em 12, Pix em 9, CPF em 8 e telefone em 6. O registro guarda só o identificador e o nome do campo ausente.
- `usuarios_reconciliacao`: 4 identidades, todas com `login_criado=false`. Nenhum login foi criado e nenhuma credencial foi copiada.
- `conferencias`: o resultado registrado é ausência de incremento e ausência de cadastro completo.

A origem no projeto MC-6 não foi alterada nem apagada. O código público do MC-6 continua sendo o aplicativo de frete.

## Testes executados nesta sessão
- `npm run test:core`: 285 testes, 0 falhas. Inclui identidade, migração anterior, plano novo, permissão por tela e atalhos da home.
- `npm run test:rules`: concluído sem falha.
- `checks/workspace-navigation.browser.mjs` com Chrome local, larguras 390 e 1280: os dois passaram. A home mostra Vendas externas, Carga direta, Fretes e motoristas e o site em `/site/`.
- `checks/operations-navigation.test.cjs`: passou; os quatro painéis comerciais permanecem.

Não foi executado o fluxo autenticado em produção, QA em aparelho físico, nem a suíte Playwright ao vivo contra os domínios publicados.

## Acesso do perfil motorista — 2026-11-10
A migration `20261110020000_frete_motorista_acesso.sql` ainda não foi aplicada no Supabase operacional. O ensaio ficou no PGlite.

- Perfil `MOTORISTA` aprovado, com o termo aceito, recebe só o app `frete`. Vendas, financeiro, carga direta, pátio e site continuam fechados.
- Solicitação de frete revogada, cadastro pendente ou troca de senha não entram.
- A função `fc_cargas_do_motorista` devolve a carga do CPF da sessão. Pix, preço, título e caminho de arquivo não saem na resposta. `anon` não executa a função e a leitura direta de `fc_app_state` não mostra a linha.
- Na PWA, `?app=frete` mostra Minhas cargas. O cadastro comercial e o botão de liberar não aparecem nesse modo. Cadastro inativo ou em conferência não é selecionado para a carga.
- A origem operacional aceita a consulta de sessão do frete. O cadastro público novo continua no app vendas; não foi aberta outra central de atalhos.
- `npm run test:core`: 304 testes, 0 falhas. Chrome local em 390 px e 1280 px abriu Minhas cargas sem pix, preço ou arquivo.
