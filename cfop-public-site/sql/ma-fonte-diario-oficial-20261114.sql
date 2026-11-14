-- MA: páginas antigas do portal SEFAZ não são acessíveis pela coleta TLS automatizada.
-- Monitor suplementar: Diário Oficial estadual. Ato tributário exige extração e revisão.
UPDATE public.cfop_fontes_oficiais
SET url='https://diariooficial.ma.gov.br/',
    orgao='Diário Oficial do Estado do Maranhão',
    assunto='Publicações oficiais do Maranhão; filtrar atos de ICMS antes de integrar ao motor tributário',
    ultimo_http=NULL,ultimo_hash=NULL,primeira_verificacao=NULL,ultima_verificacao=NULL,
    ultima_alteracao_detectada=NULL,ultima_falha=NULL
WHERE chave='sefaz-ma';