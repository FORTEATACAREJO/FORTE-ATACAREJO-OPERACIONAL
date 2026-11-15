# FORTECOMPANNY+ IA — Validação tributária prioritária (15/11/2026)

## Escopo executado neste ciclo

**Destino Minas Gerais — matriz de evidência, não homologação integral.** Fonte primária: RICMS/MG 2023, Anexo VII, Parte 2:
https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms_2023_seco/anexovii2023_4.html

Regras de responsabilidade: Anexo VII, Parte 1, arts. 13–16:
https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms_2023_seco/anexovii2023_2.html

- Cimento: NCM da posição 2523, CEST **05.001.00**, capítulo 5, item 1.0, MVA na tabela de **20%** (referência legislativa, **não** alíquota homologada de cálculo). Grupo de origem listado em protocolo interestadual com MG: **25 UFs**. Demais: Amazonas não listado e operação interna MG.
- Argamassas: **10.002.00** (3816.00.1 / 3824.50.00), **10.003.00** (3214.90.00), capítulo 10, itens 2.0/3.0, MVA de tabela **40%** (apenas referência). **8 UFs** listadas em acordos interestaduais com MG; 18 outras origens não listadas e operação interna MG.
- Na ausência de acordo interestadual no grupo, não presumir ausência de ST no destino; art. 15 pode responsabilizar destinatário mineiro contribuinte na entrada, dependendo das demais condições.
- Na existência de acordo, confirmar responsabilidades dos arts. 13–14, exceções, IE, regime especial e eventual obrigação do remetente. A presença em um acordo não comprova retenção nem guia paga.
- **Nenhuma regra estadual foi homologada neste ciclo.** Os dois registros GO→MG do banco permanecem `em_revisao` com `homologado_em=null`; listas oficiais de estados foram incluídas em `regra_json` com referência e data de conferência.

## Testes

- `tests/st-mg-evidencias.test.mjs`: 27 origens para cimento + 27 para argamassa e cenários negativos (destino diverso, NCM/CEST incompatíveis, NCM incompleto).
- `st-mg-evidencias.js`: interpreta apenas âmbito documental das normas de MG. Deve exibir status `evidencia_legal_para_revisao_nao_homologada`; não emite NF-e, não calcula ICMS-ST e não libera CFOP definitivo.
- `consulta-automatica.js`: proteção para MG→MG de produtos com ST interna (não indicar 5.102 automaticamente); cimento MG→GO e outros destinos sem norma homologada apresenta alternativas de CFOP conforme ST (não recomenda uma única opção como definitiva); nos cenários MG, diferencia acordo do remetente da possibilidade do destinatário.
- `tests/nfe_historicas_anonimas.test.mjs` e `tests/fixtures/nfe_historicas_anonimas.json`: 4 observações reais de XML autorizado **anonimizadas**. Originais privados ficam fora do GitHub: 3 amostras históricas de cimento MG→GO (NCM 25232910, CEST 0500100, CFOP 6401, CST 10, ST destacada) e uma de argamassa GO→GO (NCM 32149000, CEST 1000300, CFOP 5102, CST 00, ST não destacada).
- Uma NF-e autorizada com determinado CFOP demonstra o preenchimento histórico, **não valida automaticamente sua correção jurídica, nem serve para copiar o CFOP em rota inversa**.
- Observação crítica dos XMLs: CP-II e CP-V podem aparecer em NCM **25232910**, mesmo quando o nome comercial sugeria classificação padrão **25232990**. Corrigido: nenhum desses dois tipos define NCM automaticamente apenas pelo nome; o usuário escolhe o NCM de 8 dígitos após conferir o XML do fabricante. Sem escolha, a orientação indica `Confirmar NCM do XML`.

## Limites

**0 de 27 UFs com conjunto de regras integralmente homologado**. Este ciclo expandiu a **matriz de alcance de MG**; não representa regras completas para todos os estados de destino. Faltam validação dos produtos por fabricante/composição, IE real, regimes, natureza, protocolo vigente por operação, ICMS-ST/DIFAL/FCP, MVA ajustada/PMPF, prazos de recolhimento, CST/CSOSN, PIS/COFINS, IPI, IBS/CBS e valores.

## Próximos testes específicos

1. Para MG: usar XML autorizado de entrada e saída envolvendo operações GO→MG (não substituir por exemplos MG→GO) e validar retenção/guia.
2. Para GO: extrair legislação vigente de cimento e argamassa com origem MG, GO e demais UFs e montar matriz própria, sem copiar regra mineira.
3. Depois SP, MT e CE: montar matrizes de destino e suas exceções, com fontes por ato, período e ensaios de documento real.
4. Revisão jurídico-fiscal por produto/rota/regime antes de qualquer status de homologação; nenhuma emissão de NF-e pelo aplicativo.
