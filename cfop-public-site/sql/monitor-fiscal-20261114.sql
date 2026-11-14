-- FORTECOMPANNY: acompanhamento de mudanças em fontes oficiais, sem atualizar regras legais automaticamente.
-- Projeto exclusivo yzsxtgmasssoflgqhizm. A execução não alcança FORTE FISCAL nem os demais sistemas.
CREATE SCHEMA IF NOT EXISTS private_cfop;
REVOKE ALL ON SCHEMA private_cfop FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cfop_fontes_oficiais (
  chave text PRIMARY KEY,
  orgao text NOT NULL,
  assunto text NOT NULL,
  uf text,
  url text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_http integer,
  ultimo_hash text,
  primeira_verificacao timestamptz,
  ultima_verificacao timestamptz,
  ultima_alteracao_detectada timestamptz,
  ultima_falha text,
  ultima_amostra text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cfop_fontes_oficiais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cfop_fontes_oficiais FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cfop_alertas_normativos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fonte_chave text NOT NULL REFERENCES public.cfop_fontes_oficiais(chave),
  detectado_em timestamptz NOT NULL DEFAULT now(),
  hash_anterior text,
  hash_novo text NOT NULL,
  trecho_referencia text,
  status text NOT NULL DEFAULT 'pendente_revisao',
  aplicado_em date,
  CONSTRAINT cfop_alertas_status_check CHECK (status IN ('pendente_revisao','analisado_sem_impacto','homologado','descartado'))
);
CREATE UNIQUE INDEX IF NOT EXISTS cfop_alertas_fonte_hash_uidx
  ON public.cfop_alertas_normativos(fonte_chave,hash_novo);
CREATE INDEX IF NOT EXISTS cfop_alertas_status_idx
  ON public.cfop_alertas_normativos(status,detectado_em DESC);
ALTER TABLE public.cfop_alertas_normativos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cfop_alertas_normativos FROM PUBLIC, anon, authenticated;

INSERT INTO public.cfop_fontes_oficiais(chave,orgao,assunto,uf,url) VALUES
 ('receita-classif','Receita Federal','NCM e classificação fiscal','BR','https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif'),
 ('confaz-cest','CONFAZ','Convênio ICMS 142/18 — CEST e ICMS-ST','BR','https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18'),
 ('mg-ricms','SEF Minas Gerais','RICMS/2023, ICMS e ICMS-ST','MG','https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms/index.html'),
 ('go-legislacao','Secretaria da Economia de Goiás','Normas estaduais, RCTE, ICMS e ICMS-ST','GO','https://goias.gov.br/economia/legislacao-tributaria/')
ON CONFLICT(chave) DO NOTHING;

-- Executa uma captura de texto público por fonte; não interpreta nem aplica legislação.
CREATE OR REPLACE FUNCTION private_cfop.verificar_fonte_oficial(p_chave text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog
AS $fn$
DECLARE
  fonte public.cfop_fontes_oficiais%ROWTYPE;
  resposta extensions.http_response;
  texto text; conteudo text; novo_hash text; mudanca boolean;
BEGIN
  SELECT * INTO fonte FROM public.cfop_fontes_oficiais
  WHERE chave=p_chave AND ativo=true FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('fonte',p_chave,'estado','inexistente_ou_inativa');
  END IF;
  BEGIN
    PERFORM extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5500');
    PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','13000');
    SELECT * INTO resposta FROM extensions.http_get(fonte.url::varchar);
    IF resposta.status <> 200 OR length(coalesce(resposta.content,'')) < 500 THEN
      UPDATE public.cfop_fontes_oficiais
      SET ultimo_http=resposta.status,ultima_verificacao=now(),
          ultima_falha='HTTP '||resposta.status||' ou corpo insuficiente'
      WHERE chave=p_chave;
      RETURN jsonb_build_object('fonte',p_chave,'estado','falha_http','http',resposta.status);
    END IF;

    texto := regexp_replace(resposta.content,'<(script|style)[^>]*>.*?</(script|style)>',' ','gis');
    conteudo := lower(regexp_replace(regexp_replace(texto,'<[^>]+>',' ','g'),'[[:space:]]+',' ','g'));
    IF length(conteudo) < 300 THEN
      UPDATE public.cfop_fontes_oficiais SET ultima_verificacao=now(),ultimo_http=200,
       ultima_falha='Conteúdo ilegível após extração de HTML' WHERE chave=p_chave;
      RETURN jsonb_build_object('fonte',p_chave,'estado','conteudo_insuficiente');
    END IF;
    novo_hash:=encode(extensions.digest(convert_to(conteudo,'UTF8'),'sha256'),'hex');
    mudanca:=fonte.ultimo_hash IS NOT NULL AND novo_hash<>fonte.ultimo_hash;
    UPDATE public.cfop_fontes_oficiais
    SET ultimo_http=200,ultima_verificacao=now(),
        primeira_verificacao=coalesce(primeira_verificacao,now()),
        ultima_alteracao_detectada=CASE WHEN mudanca THEN now() ELSE ultima_alteracao_detectada END,
        ultimo_hash=novo_hash,ultima_falha=NULL,ultima_amostra=left(conteudo,240)
    WHERE chave=p_chave;
    IF mudanca THEN
      INSERT INTO public.cfop_alertas_normativos(fonte_chave,hash_anterior,hash_novo,trecho_referencia)
      VALUES(p_chave,fonte.ultimo_hash,novo_hash,left(conteudo,240))
      ON CONFLICT(fonte_chave,hash_novo) DO NOTHING;
    END IF;
    RETURN jsonb_build_object('fonte',p_chave,'estado',
     CASE WHEN fonte.ultimo_hash IS NULL THEN 'linha_de_base' WHEN mudanca THEN 'mudanca_detectada' ELSE 'sem_mudanca' END,
     'http',200,'capturado_em',now());
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cfop_fontes_oficiais SET ultima_verificacao=now(),ultima_falha=left(SQLERRM,400)
    WHERE chave=p_chave;
    RETURN jsonb_build_object('fonte',p_chave,'estado','falha','erro',left(SQLERRM,240));
  END;
END;
$fn$;

-- Agendamento sem dependência de segredo externo; executado pela conta Postgres.
CREATE OR REPLACE FUNCTION private_cfop.monitorar_fontes_oficiais()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog
AS $fn$
DECLARE f record; saida jsonb := '[]'::jsonb;
BEGIN
 FOR f IN SELECT chave FROM public.cfop_fontes_oficiais WHERE ativo ORDER BY chave LOOP
   saida := saida || jsonb_build_array(private_cfop.verificar_fonte_oficial(f.chave));
 END LOOP;
 RETURN saida;
END;
$fn$;

REVOKE ALL ON FUNCTION private_cfop.verificar_fonte_oficial(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private_cfop.monitorar_fontes_oficiais() FROM PUBLIC, anon, authenticated;

-- 11h UTC = 08h no horário de Brasília. Apenas monitora; não altera regra fiscal.
SELECT cron.schedule('fortecompanny-monitor-fontes-oficiais',
                    '0 11 * * *',
                    'SELECT private_cfop.monitorar_fontes_oficiais();');
