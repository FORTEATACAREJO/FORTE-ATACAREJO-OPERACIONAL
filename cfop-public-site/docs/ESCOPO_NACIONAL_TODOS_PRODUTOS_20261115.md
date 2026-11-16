> **DIRETRIZ ATUALIZADA EM 16/11/2026:** A homologação fiscal do FORTECOMPANNY depende exclusivamente de fundamentação em legislação oficial vigente, âmbito de aplicação, vigência, exceções e revisão técnica documentada. **XML não é requisito, nem comprova correção tributária.** Quaisquer referências abaixo a XML obrigatório devem ser interpretadas como possibilidade de conferência auxiliar. Prevalece `docs/DIRETRIZ_HOMOLOGACAO_LEGISLACAO_SEM_XML_20261116.md`.

# FORTECOMPANNY+ IA — Escopo fiscal nacional para TODOS os produtos

**Diretriz de produto:** 15/11/2026. A finalidade é **orientar** o preenchimento e a parametrização da NF-e (não emitir, assinar, transmitir ou cancelar documentos).

## Escopo correto

O aplicativo é **multissetorial e multicliente**. Não pode limitar o catálogo a cimento, argamassa ou materiais de construção. Esses produtos são apenas cenários de regressão entre milhares de mercadorias. Uma revenda de calçados, uma indústria de móveis, um distribuidor de alimentos, um comércio de medicamentos ou um fabricante de máquinas devem usar o mesmo fluxo básico.

A base existente do Supabase exclusivo contém, em 15/11/2026:
- NCM nacional: **15.157 registros de árvore**, dos quais **10.516 códigos completos de oito dígitos** no arquivo importado em 13/11/2026 (referência na tabela `cfop_ncm_versao`, fonte Classif/Portal Único).
- CEST: **1.010 referências** e **1.223 relações NCM/CEST**, importadas de compilação de terceiro com status `REFERENCIA_NAO_HOMOLOGADA`.
- **27 UFs cadastradas**, mas **nenhuma regra estadual com homologação suficiente para determinar automaticamente toda a tributação**.

## Fluxo nacional uniforme

1. Usuário informa perfil, natureza/finalidade, remetente/destinatário, mercadoria; cadastro no aplicativo é opcional.
2. O sistema procura qualquer mercadoria na tabela NCM de todos os setores por **código ou descrição**. Também recebe, em campo opcional, o NCM de oito dígitos proveniente do XML do fabricante ou ficha técnica.
3. Um código encontrado na tabela não comprova que aquele código seja o correto para a mercadoria. Quando a descrição não identificar com segurança, mostrar **candidatos e exigir conferência da composição/função/uso pelo usuário**. Sempre indicar o Sistema Classif da RFB. Não inventar NCM.
4. Pesquisar CEST **somente como candidato**, quando houver vínculo documentado NCM/CEST. Ausência de correspondência não prova que não haja ST. CEST não se aplica indistintamente a todos os produtos.
5. Determinar CFOP e regimes fiscais por natureza, finalidade, origem/destino, status cadastral, comprador, industrialização/fabricação, regime, NCM correto, CEST legal quando aplicável, ato e data. Uma simulação que careça de regra homologada deve permanecer marcada como orientativa.
6. Diferenciar incidência, responsabilidade pelo recolhimento e custo adicional de ICMS-ST, DIFAL e FCP, sem inventar valor nem guia. Considerar IPI, PIS/COFINS e IBS/CBS/cClassTrib quando legalmente exigíveis, com tratamentos específicos.
7. Emitir apenas uma **ficha orientativa**, sem assinatura fiscal, sem transmissão à SEFAZ e sem afirmar autorização de NF-e.

## Diversidade de produtos e cuidados que devem integrar a homologação

| Setor / exemplos | Ponto de atenção (não afirma incidência automática) |
| --- | --- |
| Alimentos, bebidas e agropecuária | Classificação por produto/composição, tratamentos de cesta básica, regimes específicos e eventuais benefícios |
| Vestuário, calçados e tecidos | Material, finalidade, classificação NCM, regimes de ICMS/ST por UF e vigência |
| Farmacêutico, saúde e higiene | Distinção entre medicamentos e outros produtos, regimes de PIS/COFINS, ST e requisitos setoriais |
| Combustíveis, lubrificantes e gás | Tratamentos específicos de tributação monofásica e exigências da operação |
| Eletrônicos e informática | Descrição técnica, importação/origem, eventual ST, IPI e benefícios |
| Veículos, peças e pneus | Diferenciar veículos, autopeças, origem, modalidades de venda e tratamento setorial |
| Máquinas, equipamentos e ferramentas | Função, composição, destinação ao ativo ou revenda, industrialização e regimes especiais |
| Produtos químicos, cosméticos e limpeza | Composição, finalidade, classificação, regulação setorial e eventual ST |
| Metais, madeira, móveis e construção | Matéria-prima, produto acabado, finalidade e enquadramento por UF |
| Livros, papelaria, brinquedos, joias e outros | Regras específicas e imunidades/benefícios somente com prova legal |

**Serviços puros e NFS-e:** não confundir com mercadorias sujeitas a NF-e/NCM. A cobertura de NFS-e/ISS exige módulo e legislação próprios; não declarar esse suporte como concluído.

## Estado técnico implementado

- Busca genérica em `cfop-ncm/search` e `cfop-ncm/code`, sem whitelist de categorias.
- Página inicial aceita descrição de qualquer setor e NCM opcional do documento do produto.
- Resultado apresenta candidatos da tabela NCM, exige escolha consciente, e só refaz a análise após informar NCM. Classificação não encontrada bloqueia a sugestão de CFOP definitivo.
- Sugestão CEST antiga é descartada quando NCM informado é incompatível; não torna CEST obrigatório para demais mercadorias.
- `qualidade-fiscal.js` preserva o status **não homologado** quando faltam provas.
- `tests/produtos_todos_setores.test.mjs`: 10 exemplos multissetoriais com NCM informado em simulação, seleção de candidato e código incompleto. **Testa o fluxo e a existência de código, nunca garante o enquadramento real do produto.**

## Critérios de homologação nacional (ainda pendentes)

- Atualização/versionamento de NCM, CFOP, CEST, cClassTrib, normas federais e estaduais.
- Regras por **27 destinos x origens x produto NCM/CEST x perfil/regime x finalidade x vigência** (não 27 cópias da mesma regra).
- Base de evidências jurídicas por item e UF, cálculo e responsável pelo imposto, exceções, benefícios, teste de XML real anonimizado e aprovação documentada.
- Tratamentos setoriais específicos, incluindo medicamentos, alimentos, combustíveis, indústria, veículos e importações.
- Regras estaduais não homologadas não entram no motor definitivo. Não atribuir 100% de cobertura por quantidade de NCM cadastrados ou links das SEFAZ.

## Referências oficiais

- Receita Federal — Classif: https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif
- Receita Federal — consultas/elementos de classificação: https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/consultas
- Convênio ICMS 142/2018 (CEST/ST): https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18
- Portal da NF-e — tabelas CFOP, NCM, IBS e CBS: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=%2FNJarYc9nus%3D


### Expansão de grupos NCM (implementada)

Quando a busca por descrição retorna apenas o capítulo, posição ou subposição da NCM, a consulta tenta recuperar os **códigos completos de oito dígitos da família** no endpoint oficial local `cfop-ncm/family`. Os itens são apresentados como candidatos, não escolhidos automaticamente. Se houver mais códigos do que o limite mostrado, o usuário deve consultar a árvore completa da Receita Federal.

A pesquisa preserva acentos de palavras em português. `tests/produtos_todos_setores.test.mjs` inclui cenário "arroz" cuja descrição inicial é de grupo NCM e exige expansão antes de oferecer candidatos.

**Não alegar que a existência de código de oito dígitos confirma que aquele código classifica o produto real.** Se o usuário não souber caracterizar o produto, o sistema informa pendência e link do Classif em vez de inventar.
