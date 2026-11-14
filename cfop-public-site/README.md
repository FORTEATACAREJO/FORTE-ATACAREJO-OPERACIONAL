# FORTECOMPANNY — Consulta Fiscal

**Nome anterior do aplicativo:** FORTE TECH — Consulta de CFOP. A mudança é apenas de marca, preservando o funcionamento e a infraestrutura.

Front-end PWA público para Render, independente do código operacional da branch main.

* A página é hospedada como HTML em `cfop-public-site/`.
* O backend público de estatísticas e sessões usa a Edge Function do Supabase, no projeto `yzsxtgmasssoflgqhizm`.
* O código fiscal é apenas orientativo, ainda não homologado e não deve ser usado como base única de emissão tributária.
* Nenhuma chave privada deve ser adicionada ao repositório.

Implantação: branch `deploy/forte-tech-cfop-publico-20261112`; publishPath `cfop-public-site`; buildCommand `echo build-ready`.

## Classificação de produto no assistente (13/11/2026)

- `classificacao.js`: tabela **curada e parcial** para alguns materiais de construção com referências à Receita Federal/NCM, CONFAZ/CEST e tabela CFOP.
- `assistente.html`: etapa 3 sugere NCM/CEST para produto compatível, distingue famílias e múltiplas classificações, pergunta situação de ICMS-ST, origem da mercadoria, contribuinte do comprador e data.
- Na etapa 4, mostra **hipótese de CFOP** apenas em condições declaradas compatíveis, nunca resultado tributário homologado; campos de CST/CSOSN, PIS/COFINS, IBS/CBS, base e alíquotas permanecem pendentes.
- Bloqueio de sugestão de CFOP escritural para pessoa física sem inscrição estadual comprando normalmente.
- Fontes, limites e plano para completar catálogo: [CLASSIFICACAO_FISCAL_REFERENCIAS_E_LIMITES.md](./CLASSIFICACAO_FISCAL_REFERENCIAS_E_LIMITES.md).
- **O catálogo não cobre todos os produtos/estados; ST não se conclui só por NCM ou CEST.** A emissão de NF-e continua fora do escopo.

## Importação local de XML da NF-e e consulta legal (13/11/2026)

- O `assistente.html` agora aceita **XML de NF-e do próprio usuário até 6 MB** na etapa 3, com itens selecionáveis. Leitor do navegador: `xml-nfe-local.js`.
- O arquivo **não é transmitido à FORTECOMPANNY**. É inspecionado localmente para recuperar descrição, NCM, CEST, CFOP e campos de ICMS, ICMS-ST (inclusive retido anteriormente), IPI, PIS, COFINS, IBS/CBS, GTIN e benefício fiscal, quando disponíveis. Não se extrai CNPJ/CPF, valores totais ou outros dados pessoais para as estatísticas.
- Se XML foi selecionado, a consulta não é registrada no endpoint de métricas, mesmo após edição. Apenas o NCM de 8 dígitos pode ser conferido no serviço público `cfop-ncm`.
- XML local **não tem autenticidade nem assinatura digital validada**. Dados fiscais de uma nota anterior são evidências do documento e não cálculo da nova compra/venda.
- A ficha fiscal oferece links oficiais de MG e GO para consulta da legislação de ST, mas **não determina automaticamente** MVA/PMPF/pauta/alíquotas e não declara o projeto homologado.
- LGPD e restrições de uso documentadas em `privacidade.html`.

## Marca e apresentação do aplicativo

- Nome comercial e PWA: **FORTECOMPANNY** (grafia aprovada em 13/11/2026).
- Aplicação: consulta fiscal orientativa (NCM, CEST, CFOP e dados tributários), sem homologação de emissão.
- Identificadores técnicos existentes, URL pública, branch, Supabase e serviço Render são mantidos para preservar integrações e histórico.
- A indicação da pessoa jurídica responsável nos termos de uso é independente da marca comercial do aplicativo.

## Implementação do ícone aprovado e verificações fiscais (13/11/2026)

- Identidade visual: `icon.svg` é a adaptação **vetorial otimizada** do conceito visual aprovado para a FORTECOMPANNY; `icon-maskable.svg` é a adaptação simplificada para a área segura dos atalhos Android.
- `manifest.json` declara as versões `any` e `maskable` em SVG, mantendo a identificação PWA existente e o nome curto **FORTECOMPANNY**.
- O `sw.js` incrementa o cache para `fortecompanny-v4`, preservando abordagem network-first e incluindo as duas versões de ícone.
- A consulta em `assistente.html` agora valida assincronamente o NCM de 8 dígitos junto à versão oficial RFB (existência e datas do registro) e cruza o CEST informado com os possíveis vínculos da compilação CEST por NCM/SH. **Não** atribui validade fiscal definitiva pela existência de um código.
- Se o vínculo NCM–CEST não estiver na compilação, a tela avisa que isso **não comprova** inexistência de CEST ou ST.
- `classificacao.js` evita sugestão de CFOP em nome de CPF simples sem IE e impede hipóteses com perfil incompatível com o contribuinte declarado.
- Botão **Imprimir / salvar PDF** usa o diálogo nativo do navegador, com folha de impressão sem campos de formulário e sem incluir dados da conta do usuário.
- Publicação verificada por HTTP: `icon.svg`, `icon-maskable.svg`, `manifest.json`, `assistente.html` e `classificacao.js` retornaram 200; nome do PWA e campos revisados conferidos.
- **Limite:** ainda não foi realizada homologação fiscal por UF e operação, nem navegação ponta a ponta autenticada com dados reais das APIs externas.

## Tela de pré-nota para classificação (14/11/2026)

Rota pública: **`/consulta-nfe.html`**, disponível na página inicial de `https://fortecompanny.com.br`.

- Fluxo semelhante à NF-e: **natureza da operação**, **remetente**, **destinatário**, município/UF, CNPJ/CPF e IE, **múltiplos itens** (até 30), descrição, unidade, quantidade, preço, **NCM, CEST, finalidade item a item**.
- Finalidades: revenda, ativo imobilizado, uso/consumo, construção/obra, industrialização, consumidor final, produção rural, prestação de serviço e outras.
- Naturezas: compra/venda, remessa, devolução, transferência, bonificação, consignação, conserto, comodato e retorno. Operações especiais **não** recebem CFOP automático sem regra específica homologada.
- Importação de itens de NF-e por XML no navegador; documentos e participantes **não são enviados** ao servidor por esta tela, exceto consulta de NCM/CEST exclusivamente por códigos.
- Motor `pre-nota-engine.js`, com base no catálogo `classificacao.js`. Os campos fiscais têm situação: **declarado**, **hipótese condicionada** ou **pendente**.
- Novas hipóteses CFOP para **compra de ativo** 1.551/2.551 (sem ST documentada) ou 1.406/2.406 (ST documental) e **compra uso/consumo** 1.556/2.556 ou 1.407/2.407; sempre condicionadas à legislação e tratamento real.
- Apresenta valor de mercadorias **sem simular impostos** e permite **imprimir/salvar PDF** via navegador; não emite NF-e nem DANFE.
- Testes reprodutíveis `node cfop-public-site/pre-nota-testes.cjs`. Testes de hipóteses não constituem homologação legal.
- Fontes estruturais: Portal NF-e, manual de orientação da NF-e e convênio SINIEF s/n, Receita Federal (Classif NCM), CONFAZ 142/18, RICMS MG 2023 e legislação GO.
- Acesso antigo por `/assistente.html` e simulador da página inicial continuam funcionando, preservando o histórico. Não alterar FORTE FISCAL nem sistemas da matriz/filial.
- **Pendente:** integrar provedores cadastrais gratuitos se ativados, versão e vigência tributária MG/GO, ST/MVA/PMPF/pauta e homologação completa de CST/CSOSN, ICMS, PIS/COFINS, IBS/CBS/cClassTrib.

## Atualização tributária oficial — monitoramento diário (14/11/2026)

- **Painel público:** `https://fortecompanny.com.br/fontes-oficiais.html`; link na página inicial.
- **API pública somente leitura:** `https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-fontes/status`, código versionado em `supabase/functions/cfop-fontes/index.ts`. Sem CPF/CNPJ ou segredos retornados.
- **Banco dedicado:** tabelas `cfop_fontes_oficiais` e `cfop_alertas_normativos`, RLS ativado e nenhum acesso anon/authenticated. Migração versionada em `sql/monitor-fiscal-20261114.sql`.
- **Agendamento Supabase Cron:** `fortecompanny-monitor-fontes-oficiais` (job 4), `0 11 * * *` GMT — 08h Brasília; usa apenas o Postgres existente e o módulo `http`.
- **Fontes verificadas em 14/11/2026 (duas leituras sem alteração):** Receita Federal Classif/NCM, CONFAZ Convênio ICMS 142/18, SEF/MG RICMS e SEFAZ/GO legislação tributária. Não confundir hash de página com homologação de nova lei.
- **Alertas:** alteração de conteúdo gera `pendente_revisao`. **O monitor NÃO altera automaticamente CFOP, NCM, CEST, CST/CSOSN, ICMS-ST, PIS/COFINS, IBS/CBS, nem publica regras legais sem validação técnica e jurídica.**
- **Próxima fase:** integrar o monitor de notas técnicas NF-e (portal possui redirecionamentos automáticos que impediram coleta direta), arquivos oficiais estruturados de NCM/CEST/CFOP, vigências, protocolos de ICMS-ST MG/GO, legislações estaduais e reforma tributária; implementar validação/revisão/versionamento e rollback.
- **Rastreabilidade:** GitHub issue [#68](https://github.com/FORTEATACAREJO/FORTE-ATACAREJO-OPERACIONAL/issues/68).

## Auditoria das fontes CE, SP, MT — 14/11/2026

- **Ceará:** consulta pública da SEFAZ via `https://sefazlegis.sefaz.ce.gov.br/` apresenta HTTPS válido e HTTP 200. É uma aplicação JavaScript (SPA); a coleta automática da **lista de atos** ainda não está implementada, portanto `modo_coleta=portal_spa`. O portal está **online**, mas as regras tributárias CE seguem **pendentes de homologação**.
- **São Paulo:** substituída a homepage dinâmica por `https://legislacao.fazenda.sp.gov.br/Paginas/Home.aspx`; rastreado também o ato oficial ALESP Decreto **70.842/2026**, sobre vigência de benefício do RICMS. Leitura repetida da fonte: `sem_mudanca`. Esse exemplo não permite concluir a tributação de todos os produtos/benefícios.
- **Mato Grosso:** a homepage continua em modalidade `somente_conectividade` porque varia dinamicamente; adicionado monitor de documento normativo estável SEFAZ/MT Decreto **2.305/2026**, referente ao artigo 19-A do Anexo X do RICMS (credenciamento e prazo de recolhimento de ICMS-ST). Leitura repetida: `sem_mudanca`.
- **Alertas de hash #1 e #2:** reclassificados como `analisado_sem_impacto` **apenas do ponto de vista técnico da página monitorada**, pois consultas consecutivas à mesma homepage deram hashes diferentes sem identificar ato novo; avaliação preservada no banco. Isso **não confirma que não houve mudança na legislação**.
- **Atos em revisão:** `cfop_atos_em_analise` contém três atos oficiais (CE Decreto 37.145/2026, SP Decreto 70.842/2026, MT Decreto 2.305/2026), todos em `revisao_pendente`. Nenhuma regra fiscal foi promovida a `homologada`.
- **Banco:** migração `sql/corrigir-ce-sp-mt-fontes-20261114.sql`. Cron por hora inclui fontes de atos normativos pela migração `sql/cron-atos-normativos-ce-sp-mt-20261114.sql`.
- **Painel:** `fontes-oficiais.html` diferencia portal online de monitor normativo e lista fontes e atos legais em análise; API pública `cfop-fontes` versão 3, testada HTTP 200.
- **Verificações:** 27/27 portais com HTTP 200 e sem falhas técnicas; 0 alertas de hash sem análise; 3 atos em revisão; 0 regras estaduais homologadas. Esse resultado é uma conquista de infraestrutura **não uma homologação tributária das 27 UFs**.
- **Lançamento:** não divulgar como cálculo definitivo; concluir origem/destino, finalidade, NCM/CEST, ICMS, ST/DIFAL, CST/CSOSN, vigência, provas e testes, respeitando a diretriz de pré-lançamento.
