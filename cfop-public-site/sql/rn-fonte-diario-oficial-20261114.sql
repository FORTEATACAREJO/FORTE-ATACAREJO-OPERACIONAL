-- RN: o diretório antigo www.set.rn.gov.br não respondeu; coletar Diário Oficial oficial.
-- Registrar como publicação geral, NÃO como compilação consolidada do RICMS.
UPDATE public.cfop_uf_nacionais SET portal_tributario='https://www.sefaz.rn.gov.br' WHERE uf='RN';
UPDATE public.cfop_fontes_oficiais
SET url='https://www.diariooficial.rn.gov.br/dei/dorn3/Default.aspx',
    orgao='Diário Oficial do Estado do Rio Grande do Norte',
    assunto='Diário oficial estadual: publicações de atos e decretos; filtrar normas tributárias antes de alterar regras',
    ultimo_http=NULL,ultimo_hash=NULL,primeira_verificacao=NULL,ultima_verificacao=NULL,
    ultima_alteracao_detectada=NULL,ultima_falha=NULL
WHERE chave='sefaz-rn';