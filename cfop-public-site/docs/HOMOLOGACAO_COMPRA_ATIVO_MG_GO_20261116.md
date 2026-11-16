# FORTECOMPANNY+ IA — Relatório de homologação funcional da jornada de compra

Data: 16/11/2026.
**Resultado:** cenários de interface/motor orientativo passam; **nenhuma regra tributária estadual homologada**.
**Escopo:** bem destinado ao ativo MG→GO, compra de pessoa física/produtor rural, documento fiscal, Simples, NCM e venda comum. Base de referência de todos os produtos preservada.

## Evidências oficiais verificadas

1. **GO — Guia EFD ICMS/IPI 5.9, atualizado em 16/03/2026, p. 112**: seção "Aquisição interestadual de bens para o ativo imobilizado (CIAP)" explica um tratamento de escrituração de documento com ICMS próprio e ICMS-ST relacionado ao diferencial, registros G125/G110/E111 e eventual apropriação mensal na forma indicada. **O Guia não demonstra sozinho que toda compra de máquina gera DIFAL, nem que toda empresa tem direito a créditos via CIAP.** Fonte: https://goias.gov.br/economia/wp-content/uploads/sites/45/2026/03/Guia_pratico_5.9.pdf
2. **Goiás — Decreto nº 10.150/2022 (Casa Civil), tabela CFOP**, define 2.551 como compra de bem para ativo imobilizado e 2.406 como compra de bem para o ativo em operação com mercadoria sujeita a ST. **São alternativas condicionais, não validação da situação tributária da máquina.** Fonte: https://legisla.casacivil.go.gov.br/pesquisa_legislacao/106175
3. **GO — Documentos Fiscais:** disponibiliza regras e serviços de NF-e e NFA-e. Não concluir que pessoa física sem habilitação emite NF-e comum. Fonte: https://goias.gov.br/economia/documentos-fiscais/
4. **GO — Produtor Rural Pessoa Física:** cadastramento/IE próprios do segmento; fornecedor rural deve ter fluxo distinto de comércio comum, com o documento aplicável determinado pela situação. Fonte: https://goias.gov.br/economia/cadastramento-de-produtor-rural-ou-urbano-ou-extrator-mineral-pessoa-fisica/
5. **Receita Federal — Sistema Classif**: a presença de um NCM válido não prova que aquele código enquadra corretamente uma máquina. Exigir função, composição e ficha técnica. Fonte: https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif

## Implementação de segurança concluída

- `index.html` apresenta perguntas condicionais de compras: tipo de fornecedor (empresa, pessoa física, produtor rural, desconhecido); documento disponível (XML, DANFE/foto, ainda não emitida); destino real de bem ao ativo (sim, não, não sei).
- `jornada-operacao.js` mostra perguntas somente na modalidade compra, e a pergunta do ativo somente quando a finalidade for imobilizado. Os atributos ficam em `getIntent()` para motores/auditorias. Vendas não herdam respostas da compra.
- `consulta-automatica.js` trata pessoa física e produtor rural como hipótese fiscal diferenciada, **sem pressupor NF-e de saída do vendedor** e com orientação para examinar eventual obrigação de nota de entrada. Se usuário nega destinação ao ativo, deixa de sugerir CFOP para ativo; se não confirma NCM, impede uso de hipótese numérica de CFOP.
- Simples/MEI e ativo: **não presume créditos normais de ICMS ou CIAP**, orientando revisão das possibilidades legais. Essa resposta não determina por si só obrigação de DIFAL, benefício fiscal ou crédito.
- `qualidade-fiscal.js` inclui pendências: documentos ausentes, fornecedor desconhecido, PF/rural, XML ainda não validado, ativo não confirmado, Simples e CIAP; declara explicitamente UF fornecida pelo usuário como **não verificada**.
- Testes `tests/homologacao_compra_ativo_e_fornecedor.test.mjs` têm sete cenários automatizados; `tests/jornada_operacao.test.mjs` contém teste específico das perguntas condicionais. Simulação de ponta a ponta pelo código da página passou em sete cenários, sem chamadas de CNPJ quando a operação contém apenas as UFs.

## Casos reproduzidos / comportamento esperado

| Caso | CFOP/saída orientativa esperada |
| --- | --- |
| Compra de máquina, ativo MG→GO, comprador normal, fornecedor empresa | `2.551 ou 2.406` (conforme ST); sem valor de imposto |
| Compra da máquina de pessoa física | `Confirmar documento de entrada e CFOP aplicável` |
| Compra de produtor rural para revenda | `Confirmar documento de entrada e CFOP aplicável` |
| Máquina não integra ativo | `Finalidade da compra a corrigir` |
| Máquina para ativo por optante Simples | `2.551 ou 2.406` condicionado; crédito CIAP não presumido |
| Máquina sem NCM conhecido | `Confirmar NCM do produto` |
| Venda comum GO→MG sem IE do comprador | `6.102 ou 6.108` como alternativas não homologadas |

Os valores da tabela são **resultados de teste da aplicação**, não classificação fiscal oficial das operações reais.

## O que NÃO foi homologado

- Necessidade jurídica e cálculo efetivo de DIFAL/ST/FCP, responsabilidade, prazo e guia na compra real.
- CFOP do fornecedor versus CFOP de entrada em cada tipo de compra com XML real.
- Crédito de ICMS, CIAP, exceções do Simples/MEI, regimes especiais e tratamento de máquina específica.
- Classificação NCM de qualquer máquina não identificada por catálogo/ficha técnica.
- As regras de tributos estaduais para outros produtos, outras origens, destinos ou regimes.
- A soma nacional de **27 UFs cadastradas** continua diferente de 27 UFs homologadas.

**Critério de próxima homologação:** confirmar uma operação real com XML autorizado, identificação correta do estabelecimento, consulta IE da UF, finalidade, ato vigente, responsável pelo tributo, eventual guia, CFOP/CST/CSOSN e revisão dos tratamentos do regime; sem dados, manter status de "não homologado".

## Restrições operacionais

O FORTECOMPANNY **não emite, assina, transmite ou cancela NF-e**. Uma ficha exportada é orientação para revisão humana; não pode parametrizar automaticamente um emissor. Não liberar comercialmente nem declarar homologação nacional com base em testes simulados.
