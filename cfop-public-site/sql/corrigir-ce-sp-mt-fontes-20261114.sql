-- FORTECOMPANNY / Revisao técnica CE, SP, MT de 14/11/2026.
-- Não homologa impostos. Segrega alertas técnicos de atos jurídicos e previne falso positivo de HTML dinâmico.
ALTER TABLE public.cfop_fontes_oficiais
 ADD COLUMN IF NOT EXISTS modo_coleta text NOT NULL DEFAULT 'pagina_html'
 CHECK (modo_coleta IN ('pagina_html','portal_spa','somente_conectividade','documento_normativo_html'));

ALTER TABLE public.cfop_alertas_normativos
 ADD COLUMN IF NOT EXISTS avaliacao text;
ALTER TABLE public.cfop_alertas_normativos
 ADD COLUMN IF NOT EXISTS avaliado_em timestamptz;

-- Histórico anterior é de mudanças de página sem ato identificável.
-- Consultas consecutivas ao mesmo portal produziram hashes diferentes; não confundir com lei nova.
UPDATE public.cfop_alertas_normativos
 SET status='analisado_sem_impacto',
     avaliacao='Alerta técnico de hash de HTML dinâmico da página institucional; conferência repetida em 14/11/2026 gerou hashes diferentes sem ato normativo identificável. Não comprova ausência de alterações legais; atos publicados são revisados separadamente.',
     avaliado_em=now()
 WHERE id IN (1,2) AND fonte_chave IN ('sefaz-mt','sefaz-sp')
       AND status='pendente_revisao';

-- CE: HTTPS válido no domínio específico do repositório oficial de legislação da SEFAZ.
-- É aplicação JS (SPA). Conectividade não equivale a varredura de atos.
UPDATE public.cfop_fontes_oficiais SET
 url='https://sefazlegis.sefaz.ce.gov.br/',
 orgao='SEFAZ Ceará — Sefaz Legis',
 assunto='Portal oficial de pesquisa de legislação tributária; conteúdo da interface JS, sem extração completa de atos',
 modo_coleta='portal_spa',
 ultimo_http=NULL,ultimo_hash=NULL,primeira_verificacao=NULL,
 ultima_verificacao=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL,
 ultima_amostra=NULL
 WHERE chave='sefaz-ce';

UPDATE public.cfop_uf_nacionais
 SET portal_tributario='https://sefazlegis.sefaz.ce.gov.br/'
 WHERE uf='CE';

-- SP: fonte oficial estável de legislação tributária, distinta da homepage dinâmica.
UPDATE public.cfop_fontes_oficiais SET
 url='https://legislacao.fazenda.sp.gov.br/Paginas/Home.aspx',
 orgao='SEFAZ São Paulo — Legislação Tributária',
 assunto='Portal de legislação tributária da Fazenda de SP; alterações da página requerem identificar ato normativo',
 modo_coleta='pagina_html',
 ultimo_http=NULL,ultimo_hash=NULL,primeira_verificacao=NULL,
 ultima_verificacao=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL,
 ultima_amostra=NULL
 WHERE chave='sefaz-sp';

UPDATE public.cfop_uf_nacionais
 SET portal_tributario='https://legislacao.fazenda.sp.gov.br/Paginas/Home.aspx'
 WHERE uf='SP';

-- MT: fonte de ato normativo estável em vez de publicar hash de HTML institucional como alerta jurídico.
-- Mantém também o portal vivo em modalidade somente-conectividade.
UPDATE public.cfop_fontes_oficiais SET
 orgao='SEFAZ Mato Grosso — Portal Tributário',
 assunto='Portal de consulta MT: somente disponibilidade por existir conteúdo dinâmico, sem alerta jurídico a partir de hash de homepage',
 modo_coleta='somente_conectividade',
 ultimo_hash=NULL,ultima_alteracao_detectada=NULL,ultima_falha=NULL
 WHERE chave='sefaz-mt';

INSERT INTO public.cfop_fontes_oficiais(chave,orgao,assunto,uf,url,modo_coleta,ativo)
VALUES
 ('sp-decreto-70842-2026','ALESP — legislação estadual','Decreto 70.842/2026, benefício fiscal do Anexo I art. 185, §4º — prazo de vigência','SP','https://www.al.sp.gov.br/repositorio/legislacao/decreto/2026/decreto-70842-01.09.2026.html','documento_normativo_html',true),
 ('mt-decreto-2305-2026','SEFAZ Mato Grosso — legislação tributária','Decreto 2.305/2026 — Anexo X art. 19-A, prazo diferenciado de recolhimento ICMS-ST','MT','https://app1.sefaz.mt.gov.br/Sistema/Legislacao/legislacaotribut.nsf/173e6c0d2202fdcb03258b1700659f1e/fc0cab6c66d678ba03258e9f00524232','documento_normativo_html',true)
ON CONFLICT (chave) DO NOTHING;

-- Registro do que de fato foi encontrado em publicações oficiais.
-- Documentação para futura interpretação por produto, origem/destino, regime e vigência.
CREATE TABLE IF NOT EXISTS public.cfop_atos_em_analise (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 uf char(2) NOT NULL REFERENCES public.cfop_uf_nacionais(uf),
 ato text NOT NULL,
 publicado_em date,
 inicio_efeitos date,
 fonte_url text NOT NULL,
 tema text NOT NULL,
 impacto_potencial text NOT NULL,
 situacao text NOT NULL DEFAULT 'revisao_pendente'
  CHECK (situacao IN ('revisao_pendente','sem_impacto_comprovado','homologado','revogado')),
 evidencias text,
 analisado_em timestamptz,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(uf,ato),
 CHECK (situacao <> 'homologado' OR analisado_em IS NOT NULL)
);
ALTER TABLE public.cfop_atos_em_analise ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cfop_atos_em_analise FROM PUBLIC, anon, authenticated;

INSERT INTO public.cfop_atos_em_analise(uf,ato,publicado_em,inicio_efeitos,fonte_url,tema,impacto_potencial,evidencias)
VALUES
 ('SP','Decreto 70.842/2026','2026-09-01','2026-09-01',
 'https://www.al.sp.gov.br/repositorio/legislacao/decreto/2026/decreto-70842-01.09.2026.html',
 'RICMS/SP, Anexo I, art.185 §4º','Altera prazo de benefício até 31/12/2026, sem inferir enquadramento de produtos sem descrição e convênio aplicável.',
 'Texto publicado pela ALESP; verificar Diário Oficial e incidência sobre operações concretas.'),
 ('MT','Decreto 2.305/2026','2026-10-28','2026-10-28',
 'https://app1.sefaz.mt.gov.br/Sistema/Legislacao/legislacaotribut.nsf/173e6c0d2202fdcb03258b1700659f1e/fc0cab6c66d678ba03258e9f00524232',
 'RICMS/MT Anexo X art.19-A','Altera critérios de credenciamento para prazo diferenciado de ICMS-ST; depende de regime e situação do contribuinte.',
 'Publicação DOE MT edição extra de 28/10/2026 conforme fonte; confirmar atos posteriores e aplicação.'),
 ('CE','Decreto 37.145/2026','2026-02-18','2026-02-18',
 'https://sefazlegis.sefaz.ce.gov.br/api/openFile?id=2215dd90-5768-4725-9eff-29a450e34914',
 'RICMS/CE, Decreto 33.327/2019, art.96 §5º e art.94','Altera parcelamento de DIFAL para consumidor final não contribuinte; não determina alíquota da venda.',
 'DOE/CE 18/02/2026 conforme ato; norma específica não configura homologação completa do estado.')
ON CONFLICT (uf,ato) DO NOTHING;

-- Limpeza da fonte de falso positivo não deve apagar alertas já registrados, que permanecem auditáveis.
CREATE OR REPLACE FUNCTION private_cfop.verificar_fonte_oficial(p_chave text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path=public,extensions,pg_catalog
AS $fn$
DECLARE fonte public.cfop_fontes_oficiais%ROWTYPE;
 resposta extensions.http_response;
 texto text; conteudo text; novo_hash text; mudou boolean;
BEGIN
 SELECT * INTO fonte FROM public.cfop_fontes_oficiais
 WHERE chave=p_chave AND ativo=true FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('fonte',p_chave,'estado','inexistente_ou_inativa'); END IF;
 BEGIN
  PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','6000');
  PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','13500');
  SELECT * INTO resposta FROM extensions.http_get(fonte.url::varchar);
  IF resposta.status<>200 OR length(coalesce(resposta.content,''))<500 THEN
   UPDATE public.cfop_fontes_oficiais SET ultimo_http=resposta.status,
     ultima_verificacao=now(),ultima_falha='HTTP '||resposta.status||' ou corpo insuficiente' WHERE chave=p_chave;
   RETURN jsonb_build_object('fonte',p_chave,'estado','falha_http','http',resposta.status);
  END IF;
  IF fonte.modo_coleta IN ('portal_spa','somente_conectividade') THEN
    UPDATE public.cfop_fontes_oficiais
    SET ultimo_http=200,ultima_verificacao=now(),primeira_verificacao=COALESCE(primeira_verificacao,now()),
      ultima_falha=NULL,
      ultima_amostra=CASE WHEN fonte.modo_coleta='portal_spa'
       THEN 'Portal oficial JS acessível; extração normativa automatizada ainda não habilitada'
       ELSE 'Portal oficial acessível; página dinâmica não é utilizada para classificar ato legal' END
    WHERE chave=p_chave;
    RETURN jsonb_build_object('fonte',p_chave,'estado',
       CASE WHEN fonte.modo_coleta='portal_spa' THEN 'portal_online_normas_pendentes'
            ELSE 'portal_online_sem_alerta_de_html' END,'http',200);
  END IF;
  texto:=regexp_replace(regexp_replace(resposta.content,
    '<script[^>]*>([^<]|<(?!/script>))*</script>',' ','gi'),
    '<style[^>]*>([^<]|<(?!/style>))*</style>',' ','gi');
  conteudo:=lower(regexp_replace(regexp_replace(texto,'<[^>]+>',' ','g'),'[[:space:]]+',' ','g'));
  IF length(conteudo)<200 THEN
    UPDATE public.cfop_fontes_oficiais
     SET ultima_verificacao=now(),ultimo_http=200,
         ultima_falha='Extração normativa insuficiente; verificar fonte'
    WHERE chave=p_chave;
    RETURN jsonb_build_object('fonte',p_chave,'estado','conteudo_insuficiente');
  END IF;
  novo_hash:=encode(extensions.digest(convert_to(conteudo,'UTF8'),'sha256'),'hex');
  mudou:=fonte.ultimo_hash IS NOT NULL AND fonte.ultimo_hash<>novo_hash;
  UPDATE public.cfop_fontes_oficiais
  SET ultimo_http=200,ultima_verificacao=now(),primeira_verificacao=COALESCE(primeira_verificacao,now()),
      ultima_alteracao_detectada=CASE WHEN mudou THEN now() ELSE ultima_alteracao_detectada END,
      ultimo_hash=novo_hash,ultima_falha=NULL,ultima_amostra=left(conteudo,240)
  WHERE chave=p_chave;
  IF mudou THEN
   INSERT INTO public.cfop_alertas_normativos(fonte_chave,hash_anterior,hash_novo,trecho_referencia)
   VALUES(p_chave,fonte.ultimo_hash,novo_hash,left(conteudo,240))
   ON CONFLICT(fonte_chave,hash_novo) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('fonte',p_chave,'estado',
   CASE WHEN fonte.ultimo_hash IS NULL THEN 'linha_de_base'
        WHEN mudou THEN 'mudanca_detectada' ELSE 'sem_mudanca' END,'http',200);
 EXCEPTION WHEN OTHERS THEN
  UPDATE public.cfop_fontes_oficiais SET ultima_verificacao=now(),ultima_falha=left(SQLERRM,350)
  WHERE chave=p_chave;
  RETURN jsonb_build_object('fonte',p_chave,'estado','falha','erro',left(SQLERRM,220));
 END;
END;
$fn$;
REVOKE ALL ON FUNCTION private_cfop.verificar_fonte_oficial(text) FROM PUBLIC,anon,authenticated;
