# FORTECOMPANNY+ IA — Homologação jurídica nacional, 27 UFs, sem XML

**Diretriz vigente em 16/11/2026.** Escopo: todos os produtos e todas as modalidades usuais de compra, venda e demais operações fiscais. O aplicativo é **exclusivamente orientativo** e não emite NF-e.

## 1. Mudança definitiva de método

O motor NÃO deve escolher produtos específicos, regiões, clientes, notas fiscais anteriores ou XMLs como requisito para começar o desenvolvimento. O trabalho começa pelas **fontes oficiais vigentes**. Uma NF-e autorizada não prova que os tributos ali lançados estão corretos.

Existem duas etapas distintas:
- **Aprovação documental de norma:** norma oficial, publicação, texto integral, alterações, revogações, vigência, condições, remissões, exceções e revisor; independe de mercadoria e nota fiscal concretas.
- **Aprovação de regra de aplicação:** comprovar que a norma revisada alcança determinado tipo de produto, contribuinte, operação, regime, finalidade, UF e data. É essa segunda etapa que pode habilitar uma orientação fiscal mais específica. Nenhuma etapa habilita emissão de NF-e.

A triagem do usuário comum vem DEPOIS: o aplicativo pergunta o objetivo e associa a situação às normas homologadas, indicando documentos e condições que ainda faltam.

## 2. Cobertura por tema em todos os 27 entes federativos

Matriz de análise em 13 temas, não em rotas preferenciais:

1. ICMS — hipóteses gerais de incidência, não incidência, crédito e obrigações.
2. ICMS — alíquotas internas, interestaduais, produtos especiais e vigência.
3. ICMS-ST — CEST, protocolos/convênios, acordos entre UFs, atribuição de responsabilidade, MVA/PMPF/pauta e exceções.
4. Antecipação de ICMS, com/sem encerramento de tributação.
5. DIFAL — operação com consumidor final, ativo, uso e consumo e sujeito passivo.
6. FCP — adicional, produtos/serviços sujeitos, base e vigência.
7. Benefícios fiscais — isenções, reduções, diferimento, crédito presumido e condições.
8. Regimes especiais — ato concessivo e seu escopo, revogação e vigência.
9. CFOP, CST, CSOSN — tabelas oficiais, finalidade e particularidades.
10. NCM — regras interpretativas, notas de seção e capítulo, NESH, soluções de classificação e alterações.
11. IPI — TIPI, incidência, situações especiais e imunidades.
12. PIS/COFINS — cumulatividade, não cumulatividade, monofásico, substituição, alíquota zero e especificidades.
13. IBS/CBS — LC 214/2025, alterações, cClassTrib, créditos e regimes específicos conforme legislação/transição.

Há 27 UFs × 13 temas = **351 frentes de análise**, mas cada uma pode exigir muitos atos, dispositivos e condições. Isso **não** significa 351 regras homologadas.

## 3. Repositório normativo/versionamento

Cada ato deve possuir:
- Ente competente, tema, espécie e número do ato, artigo/anexo/tabela, URL oficial;
- data da publicação, início e fim de efeitos, alterações e revogações;
- campos dos produtos e pessoas alcançados **quando aplicáveis** (não exigir NCM de uma norma geral);
- condições, limites, exceções e remissões;
- histórico das versões, diferenças detectadas e fonte;
- situação: `fonte_localizada`, `ato_identificado`, `em_revisao`, `ato_documentalmente_revisado`, `regra_aplicavel_homologada`;
- revisor, data de revisão e testes jurídicos positivos/negativos.

**Não confundir** acesso HTTP 200 com texto conferido; ato documentado com regra aplicada; NCM cadastrado com produto classificado; CEST com ST devida; URL encontrada com uma lei vigente.

### Ordem de implementação da rotina

1. Ler e versionar legislação federal de aplicação geral e atos do CONFAZ/Portal NF-e.
2. Para cada UF, identificar e versionar o RICMS vigente, anexos, alíquotas, ST, antecipação, DIFAL, FCP, benefícios e regimes especiais.
3. Determinar em quais condições cada ato se aplica e como convive com normas federais ou de outros entes.
4. Criar cenários de teste **sintéticos** a partir de hipóteses jurídicas reais, incluindo negativas, datas de transição e regimes distintos.
5. Registrar aprovação jurídico-fiscal por regra, com rastreabilidade de versão e fundamento legal.
6. Liberar ao público apenas respostas correspondentes ao escopo aprovado; demais situações recebem orientação de dados/documentos necessários e referência legal, sem códigos conclusivos.

## 4. Fontes nacionais oficiais de partida

- Receita Federal Classif (NCM, regras, notas legais, NESH e decisões): https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif
- CONFAZ Convênio ICMS 142/2018: https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18
- Portal Nacional da NF-e — tabelas oficiais, inclusive CFOP e IBS/CBS: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=%2FNJarYc9nus%3D
- Constituição, LC 87/1996, LC 123/2006, LC 190/2022, LC 214/2025 e legislação complementar do tema em análise: https://www.planalto.gov.br
- As URLs normativas locais devem ser obtidas em cada portal estadual, conferindo o **ato específico**, não apenas a página inicial.

**Atualizações já identificadas em fontes oficiais até 16/11/2026 (verificar vigência na data da operação):**
- Portal NF-e lista cClassTrib com publicação em 30/10/2026 e CFOP publicada em 04/09/2026.
- CONFAZ Convênio 142/18 possui alterações posteriores; ato de setembro de 2026 (Convênio ICMS 107/2026) alterou seu anexo. Identificar cada alteração e seus efeitos antes de criar regras fiscais.

## 5. Implementação de software iniciada nesta etapa

- `base-normativa-nacional.js`: catálogo dos 27 entes e 13 temas; gate documental de ato oficial, dispositivo, vigência, exceções, alterações, publicação, texto integral e revisão. Sem XML, sem nota fiscal e sem alíquota ou CFOP automático.
- `tests/base_normativa_nacional.test.mjs`: casos de 27 UFs, 13 temas, URLs falsas, ato de teste documentado, retroatividade suspeita e portais sem dispositivo legal. Testes sintéticos não homologam normas reais.
- `consulta-automatica.js`: removidos os comportamentos específicos de determinadas origens/destinos e produtos. Avisos nacionais condicionais persistem até norma adequada; não aplicar ST, DIFAL ou regimes específicos sem fundamento.
- `jornada-operacao.js` e `index.html`: exemplo genérico, sem selecionar estados pela empresa.
- `fontes-oficiais.html`: painel nacional com 27 UFs e as 13 áreas de legislação; os três atos antes destacados por recorte regional continuam apenas no histórico e na lista de atos identificados, sem prioridade.
- PWA atualizado, sem dependência do módulo regional de consulta principal.

## 6. Estado de homologação (não confundir com cadastro)

- 27 UFs já presentes no banco exclusivo e portais catalogados.
- 31 fontes cadastradas incluem portais gerais, atos individuais e fontes federais; a maioria **não** é texto de norma já validado.
- 10.516 NCM completos e 1.010 referências CEST **não equivalem** a tributação homologada.
- **0 regras estaduais aprovadas**. Três registros antigos podem permanecer como dados históricos `em_revisao`, sem ditar as prioridades nacionais.
- Não foram produzidas 351 análises jurídicas independentes apenas por montar a matriz. Revisão efetiva exige ler textos oficiais, vigência e exceções, ato a ato.

## 7. Critério de aceitação

Só apresentar “homologada” para uma regra específica quando houver texto oficial, dispositivo, âmbito, vigência, classificação ou condição de produto (quando necessário), regime e finalidade, exceções e revisão assinada/documentada. Documentos fiscais de terceiros são facultativos e nunca prova jurídica.

**Restrições:** sem alterar FORTE FISCAL, FORTE OP fora de `cfop-public-site/` ou MC6; sem pagar novos serviços; sem emitir NF-e; sem transformar interpretação de IA em lei; sem ativação comercial geral antes da homologação.
