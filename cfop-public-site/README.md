# FORTECOMPANNY — Consulta Fiscal (antiga FORTECOMPANNY / Consulta CFOP)

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
