# FORTECOMPANNY+ IA — Diretriz obrigatória de homologação por legislação

**Data:** 16/11/2026
**Decisão de produto:** A orientação e a homologação fiscal do FORTECOMPANNY devem depender da **legislação aplicável**, e não do conteúdo de XML de notas fiscais de terceiros.

## 1. Fonte de verdade

A determinação tributária parte dos fatos da operação (tipo de estabelecimento, regime, natureza, finalidade, mercadoria real, UF de origem/destino, contribuinte, data e regimes especiais) e das **normas oficiais vigentes**.

Usar, conforme a natureza e o tributo:
- Constituição e leis complementares/federais pertinentes;
- leis estaduais e RICMS da UF de origem e de destino, seus anexos, portarias, pautas/PMPF/MVA e benefícios;
- convênios/protocolos ICMS na extensão de sua adoção, âmbito e vigência aplicáveis;
- Ajustes SINIEF, tabelas oficiais de CFOP, CST/CSOSN e campos da NF-e;
- Receita Federal: NCM, Regras Gerais de Interpretação, notas de seção/capítulo, NESH e soluções oficiais de classificação de mercadorias;
- normas de IPI, PIS/COFINS, regimes concentrados/monofásicos e IBS/CBS vigentes na data;
- ato concessivo específico, quando o usuário declara regime especial.

**CEST e NCM não são, isoladamente, prova da incidência de ST ou da correção jurídica do enquadramento.**

## 2. XML não é requisito

- A ausência de XML não impede orientar ou revisar juridicamente uma hipótese fiscal.
- XML/DANFE são **documentos auxiliares opcionais** para identificar características, valores e dados efetivamente utilizados.
- Um XML pode estar errado mesmo que a nota tenha autorização da SEFAZ.
- Não copiar CFOP, CST, CSOSN, base, MVA, alíquota ou benefícios fiscais de uma NF-e de terceiros como regra.
- Para analisar uma compra futura sem documentação, solicitar somente os fatos que determinam a incidência; o sistema informa pendências do próprio cenário.
- O resultado jurídico nunca deve mostrar "homologada" só por existir código fiscal em XML ou NCM cadastrado.

## 3. Critério técnico de aprovação de uma regra

Cada regra registrada no motor deve manter:
1. **Origem e destino**, operação e finalidade, condição do contribuinte, regime e espécie de bem.
2. **Norma oficial**: ato, número, dispositivo/artigo/anexo, URL de domínio institucional e data de consulta.
3. **Vigência**: início, eventuais alterações/revogações e aplicação à data do fato.
4. **Produto**: enquadramento tecnicamente justificado (composição, características, função, regras NCM, notas legais, soluções de classificação).
5. **Tratamento tributário**: se aplicável, CFOP, CST/CSOSN, base, alíquotas, ST/DIFAL/FCP, tributos federais e IBS/CBS, com condições e exceções.
6. **Responsabilidade e documento**: quem recolhe ou presta informação e qual documento fiscal é exigido por norma; não presumir guia sem hipótese legal.
7. **Regime especial**: ato concessivo, estabelecimento/mercadoria/operador alcançados, vigência e ressalvas, quando aplicável.
8. **Revisão jurídica/técnica documentada**, com identificação de revisor e data, incluindo as exceções analisadas. Sem revisão, permanecer em revisão.

O módulo `fundamentacao-legal.js` é um **controle de conformidade documental**: exige escopo, ato oficial, dispositivo, vigência, enquadramento técnico, exceções e revisão registrada. Ele **não lê nem exige XML**, e nunca habilita emissão fiscal, mesmo quando seus campos estão completos.

## 4. Testes corretos

Usar **cenários hipotéticos juridicamente definidos**, confrontados contra fontes oficiais, com exemplos positivos e negativos:
- origem e destino iguais ou diferentes;
- compra para revenda, uso e consumo, ativo, industrialização;
- contribuinte/não contribuinte, MEI, Simples, regime normal, produtor rural;
- mercadoria sujeita ou não a ST conforme o objeto e a norma;
- eventual regime especial ativo, expirado ou fora do escopo;
- datas antes/depois da vigência do ato;
- falta de identificação do produto, beneficiário ou responsabilidade;
- operações específicas de alimentos, calçados, eletrônicos, máquinas, remédios, combustíveis e outros setores.

**Não há necessidade de fornecer uma NF-e real para homologar o fundamento jurídico**, mas os fatos e a classificação do produto concreto devem ser suficientemente identificados para uma conclusão.

## 5. Regras e integridade de produção

- A interface é para usuário comum: perguntas objetivas sobre o que pretende fazer, e resultados em linguagem simples; não exigir conhecimento de códigos fiscais.
- Uma regra sem fundamento comprovado deve ser apresentada como hipótese ou pendência, nunca como classificação definitiva.
- Códigos e situações extraídos de documentos anteriores **não prevalecem sobre as normas vigentes**.
- A leitura de XML continua opcional como funcionalidade auxiliar futura, nunca como condição de homologação.
- Manter `canIssue=false` no aplicativo: o FORTECOMPANNY **não emite NF-e** nesta fase.
- Sem divulgação geral até concluir testes, revisão e homologação das regras relevantes de cada setor/UF.

## 6. Estado após a correção

Base exclusiva Supabase `yzsxtgmasssoflgqhizm`:
- **3 registros em revisão** (GO→MG cimento, GO→MG argamassa, MG→GO cimento);
- **0 regras juridicamente homologadas**;
- campo `regra_json.metodologia_homologacao` indica `base=legislacao_primaria_vigente`, `exige_xml=false` nos 3 registros;
- pendências de XML obrigatório substituídas por comprovação normativa, de escopo, responsabilidade, cálculo e eventuais documentos de recolhimento **somente quando legalmente necessários para comprovar um pagamento efetivo**.

## 7. Fontes institucionais de partida

- Receita Federal — classificação fiscal/NCM, notas legais e consultas: https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/consultas
- Receita Federal — Classif: https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif
- Portal Nacional NF-e — tabelas oficiais: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=%2FNJarYc9nus%3D
- CONFAZ — Convênio ICMS 142/2018: https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18
- MG — RICMS 2023 Anexo VII ST: https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms_2023_seco/anexovii2023_4.html
- GO — legislação própria: https://legisla.casacivil.go.gov.br/

**Precedência:** esta diretriz substitui exigências anteriores, em documentos ou issues, que condicionavam homologação do FORTECOMPANNY ao recebimento de XMLs de operações reais.
