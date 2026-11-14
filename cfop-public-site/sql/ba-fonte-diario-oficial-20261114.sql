-- BA: substituir endereço legado com falha de certificado por portal oficial estadual com HTTPS verificável.
-- A página oficial é fonte informativa, não legislação tributária consolidada.
UPDATE public.cfop_uf_nacionais
SET portal_tributario='https://www.ba.gov.br/egba/diario-oficial-do-estado'
WHERE uf='BA';
UPDATE public.cfop_fontes_oficiais
SET url='https://www.ba.gov.br/egba/diario-oficial-do-estado',
 orgao='Governo da Bahia — Diário Oficial',
 assunto='Portal do Diário Oficial da Bahia, a validar atos tributários específicos antes de uso',
 ultimo_http=NULL,ultimo_hash=NULL,primeira_verificacao=NULL,ultima_verificacao=NULL,
 ultima_alteracao_detectada=NULL,ultima_falha=NULL
WHERE chave='sefaz-ba';