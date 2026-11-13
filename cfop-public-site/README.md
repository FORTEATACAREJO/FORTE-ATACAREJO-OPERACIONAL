# FORTE TECH — Consulta CFOP

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
