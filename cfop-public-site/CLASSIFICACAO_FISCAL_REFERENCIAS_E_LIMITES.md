# FORTE TECH — Catálogo fiscal e hipóteses de CFOP (primeira versão)

**Escopo:** módulo `cfop-public-site/classificacao.js`, consultado pelo `assistente.html`. **Atenção:** a solução é uma pesquisa preliminar, sem autorização para usar seus resultados em NF-e ou escrituração até homologação tributária.

## Referências normativas oficiais
- [Receita Federal — Classif/NCM](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif)
- [CONFAZ — Convênio ICMS nº 142/2018](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18), Anexo VI (cimento) e XI (materiais de construção).
- [SEFAZ PE — Tabela de CFOP](https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Tabelas/CFOP.htm)
- [IBGE — PRODLIST-Indústria 2019](https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv101701.pdf), cimento Portland CP-II vs CP-I (suporte auxiliar de descrição).

## Correspondências provisórias
| Descrição específica | NCM referência | CEST por descrição, quando compatível | Observação |
|---|---:|---:|---|
| Cimento Portland CP-II (composto) | 25232990 | 0500100 | Comprovar tipo/mercadoria no XML |
| Cimento Portland CP-V (outros Portland) | 25232990 | 0500100 | Comprovar |
| Cimento Portland comum CP-I | 25232910 | 0500100 | Diferenciar de CP-II |
| Cimento sem tipo especificado | família 2523 | 0500100 (possível) | **Não** completar NCM de 8 dígitos sem tipo |
| Cal hidratada/apagada | 25222000 | 1000100 | Não confundir com calcário/corretivo |
| Cal viva | 25221000 | 1000100 | Checar especificação |
| Argamassa | 38245000 / 32149000 | 1000200 / 1000300 | **Não escolher automaticamente**; depende de composição e classificação do fabricante |

A tabela CEST inclui **itens passíveis** do regime de ST. A presença do CEST não comprova que a **operação concreta** tenha retenção ou ICMS-ST, que requer verificar a legislação aplicável por UF, protocolos, data, finalidade, contribuinte e responsável pelo recolhimento.

## Regras limitadas de hipótese de CFOP
- **Compras para revenda** sem ST comprovada: 1.102 / 2.102 (interna/interestadual).
- **Compras para revenda** sujeitas ao regime de ST conforme documentação: 1.403 / 2.403 (conferir situação).
- **Compras para industrialização ou produção rural**, sem ST: 1.101 / 2.101 sob as condições descritas.
- **Vendas de mercadoria adquirida de terceiros, sem ST e sem outros regimes**, interna ou interestadual para contribuinte confirmado: 5.102 / 6.102.
- **Vendas de produção própria, sem ST e sem outras especificidades**: 5.101 / 6.101.
- **Vendas interestaduais para não contribuinte comprovado, sem ST**, terceiros: 6.108; produção própria: 6.107.
- **CFOP de escrituração de compras para CPF comum**: não sugerir; não se trata automaticamente de estabelecimento contribuinte.
- **Situação desconhecida, ST complexa, dados cadastrais não confirmados, operações especiais**: retornar **Pendente**.

Todos os códigos são hipóteses informativas; o cálculo da base, alíquotas de ICMS, ST por MVA/PMPF, DIFAL, CST/CSOSN, PIS/COFINS, IBS/CBS e cClassTrib ficam **pendentes de fonte legal vigente**. Não completar por inferência do nome do produto ou por não ser optante do Simples.

## Extensibilidade e homologação
1. Para ampliar de amostra a **qualquer produto**, importar periodicamente **a tabela NCM vigente** no formato JSON disponibilizado pela RFB/Classif, com versão, data de vigência, descrição e fonte.
2. Obter e versionar os anexos CEST do CONFAZ, identificando revogações/alterações e regras de descrição; **NCM pode vincular-se a mais de um CEST**.
3. Versionar por UF (começar MG/GO) o ICMS-ST, protocolos, benefícios, MVA/PMPF, alíquotas, natureza da operação, data de vigência, contribuinte/IE e documentação de retenção.
4. Implementar um motor fiscal **lado servidor** com testes por operação, auditoria e evidência; jamais confiar na marcação de “sem ST” do visitante como prova documental.
5. Usar entrada de dados por XML/NF-e do fornecedor, NCM/CEST do fabricante, ficha técnica, GTIN e consultas cadastrais como evidência; conflitar cadastros divergentes em vez de substituir silenciosamente.
6. Reconciliar com CST/CSOSN, ICMS, PIS/COFINS, IBS/CBS e cClassTrib conforme o período, sem assumir alíquotas uniformes em todos os estados.
7. Homologar todos os cenários com contador/tributarista antes de usar o resultado para emissão fiscal real.

**Nenhuma mudança no FORTE FISCAL ou no banco `setor_fiscal_forte_tech_empresas`.** Esta etapa restringe-se ao site público de pesquisa.
