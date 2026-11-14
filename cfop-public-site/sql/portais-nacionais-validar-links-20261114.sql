-- Ajusta páginas oficiais cuja URL do diretório SINTEGRA não permitia coleta segura no Supabase.
-- Fontes verificadas manualmente em 14/11/2026. Legislação ainda depende de homologação.
UPDATE public.cfop_uf_nacionais SET portal_tributario='https://www.ac.gov.br/servico/legislacao-estadual' WHERE uf='AC';
UPDATE public.cfop_fontes_oficiais SET url='https://www.ac.gov.br/servico/legislacao-estadual', ultimo_http=NULL,ultimo_hash=NULL, primeira_verificacao=NULL,ultima_verificacao=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL WHERE chave='sefaz-ac';
UPDATE public.cfop_uf_nacionais SET portal_tributario='https://sefaz.portal.ap.gov.br/' WHERE uf='AP';
UPDATE public.cfop_fontes_oficiais SET url='https://sefaz.portal.ap.gov.br/', ultimo_http=NULL,ultimo_hash=NULL, primeira_verificacao=NULL,ultima_verificacao=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL WHERE chave='sefaz-ap';
UPDATE public.cfop_uf_nacionais SET portal_tributario='https://economia.df.gov.br/reforma-tributaria' WHERE uf='DF';
UPDATE public.cfop_fontes_oficiais SET url='https://economia.df.gov.br/reforma-tributaria', ultimo_http=NULL,ultimo_hash=NULL, primeira_verificacao=NULL,ultima_verificacao=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL WHERE chave='sefaz-df';
UPDATE public.cfop_uf_nacionais SET portal_tributario='https://www.sefaz.mt.gov.br/spl/portalpaginalegislacao' WHERE uf='MT';
UPDATE public.cfop_fontes_oficiais SET url='https://www.sefaz.mt.gov.br/spl/portalpaginalegislacao', ultimo_http=NULL,ultimo_hash=NULL, primeira_verificacao=NULL,ultima_verificacao=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL WHERE chave='sefaz-mt';
UPDATE public.cfop_uf_nacionais SET portal_tributario='https://portal.sefaz.pb.gov.br/legislacao' WHERE uf='PB';
UPDATE public.cfop_fontes_oficiais SET url='https://portal.sefaz.pb.gov.br/legislacao', ultimo_http=NULL,ultimo_hash=NULL, primeira_verificacao=NULL,ultima_verificacao=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL WHERE chave='sefaz-pb';