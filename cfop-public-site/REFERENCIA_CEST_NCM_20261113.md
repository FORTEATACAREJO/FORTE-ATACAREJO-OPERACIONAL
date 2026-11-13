# Referência CEST e vínculo NCM — FORTE TECH (13/11/2026)

## Escopo de implementação
- Projeto exclusivo Supabase `yzsxtgmasssoflgqhizm`. Não envolve FORTE FISCAL, MC-6 nem os demais bancos.
- `public.cfop_cest_referencia`: **1.010** códigos CEST e descrições.
- `public.cfop_cest_ncm_relacao`: **1.223** relações entre CEST e NCM/SH, dos quais **27** vieram da fonte com 3 dígitos por omissão do zero inicial; cada um foi normalizado para o prefixo NCM de 4 dígitos somente depois de comprovada a existência desse grupo na tabela oficial RFB importada.
- `public.cfop_cest_fonte`: guarda origem, data do snapshot, fonte legal e situação.
- Data da agregação: **09/11/2026**. Dados reunidos por terceiro, sem comprovação de vigência de cada item, algumas descrições e códigos podem ter mudado desde a atualização.

## Fontes e licença
- Compilação informativa gratuita: https://tabelasfiscais.com.br/downloads
- CEST: https://tabelasfiscais.com.br/public/downloads/cest.json
- Relações NCM–CEST: https://tabelasfiscais.com.br/public/downloads/cest_ncm.json
- **Legislação oficial prevalente:** https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18

A compilação permite uso comercial e aprecia atribuição. **Não se deve apresentá-la como base oficial nem como classificação completa homologada.** O CONFAZ contém alterações, itens revogados, vigência histórica e restrições de descrição. A tabela agregada pode ser incompleta.

## Serviço e acesso
A função `cfop-ncm` (backup em `backend/cfop-ncm/index.ts`) expõe sem chaves secretas ao navegador:
- `GET /cest-version`: fonte, quantidade e situação `REFERENCIA_NAO_HOMOLOGADA`.
- `GET /cest-by-ncm?ncm=25232990`: possíveis CEST que possuem NCM/SH compatível com prefixo do NCM de 8 dígitos, retornando descrição e segmento; não calcula ST.
- `GET /cest-code?code=0500100`: descrição, segmento e prefixos NCM da compilação.
- `GET /cest-search?q=cimento`: pesquisa informativa por descrição.
- Endpoints `/code`, `/search`, `/family` e `/version` do NCM oficial permanecem inalterados.

A UI `assistente.html` permite pesquisar pelo NCM e selecionar manualmente o CEST adequado após conferência da **descrição do produto**, sem assumir ST, MVA, PMPF ou responsabilidade tributária. Seleção não representa homologação.

## Casos de teste
- NCM `25232990` → possibilidade CEST `0500100` (cimento).
- NCM `38245000` → possibilidade CEST `1000200` (argamassa).
- CEST `1000300` → vínculo NCM `32149000` (outras argamassas).
- Verificações de grupo `0403` e `0201` pela Receita antes de corrigir 27 vínculos originalmente truncados.
- Tables `cfop_cest_referencia` e `cfop_cest_ncm_relacao`: RLS habilitada, sem SELECT para anon ou authenticated. As buscas públicas só retornam referências fiscais não pessoais.

## Pendências
1. Validar os registros CEST, suas descrições, exceções e vigências *item a item* com o Convênio ICMS 142/18 consolidado e alterações.
2. Versionar legislação tributária e **regras de ST por UF**, começando MG e GO: protocolos interestaduais, MVA, PMPF, pauta, benefícios, exceções de contribuinte e finalidade.
3. Homologar motor de CFOP, CST/CSOSN, DIFAL, PIS/COFINS, IBS/CBS e cálculo de impostos conforme origem/destino, regime, data e natureza da operação.
4. Não inferir **Lucro Real/Presumido**, responsabilidade pelo ICMS-ST ou CFOP definitivo apenas por NCM e CEST.
