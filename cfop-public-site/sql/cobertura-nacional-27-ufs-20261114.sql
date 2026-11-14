-- FORTECOMPANNY: abrangência nacional 26 estados + DF, sem assumir impostos homologados.
-- Fonte dos códigos cUF: Manual de Orientação do Contribuinte NF-e (tabela IBGE).
-- Portais institucionais: diretório SINTEGRA; URL não constitui texto legal nem classificação.
CREATE TABLE IF NOT EXISTS public.cfop_uf_nacionais (
 uf char(2) PRIMARY KEY,
 cuf char(2) NOT NULL UNIQUE,
 nome text NOT NULL,
 regiao text NOT NULL,
 portal_tributario text NOT NULL,
 fonte_portal text NOT NULL DEFAULT 'https://www.sintegra.gov.br/links.html',
 situacao_regras text NOT NULL DEFAULT 'pendente_homologacao'
  CHECK (situacao_regras IN ('pendente_homologacao','parcialmente_homologada','homologada')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (uf ~ '^[A-Z]{2}$' AND cuf ~ '^[0-9]{2}$')
);
ALTER TABLE public.cfop_uf_nacionais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cfop_uf_nacionais FROM PUBLIC,anon,authenticated;

INSERT INTO public.cfop_uf_nacionais(uf,cuf,nome,regiao,portal_tributario) VALUES
  ('RO', '11', 'Rondônia', 'Norte', 'https://www.sefin.ro.gov.br'),
  ('AC', '12', 'Acre', 'Norte', 'https://www.sefaz.ac.gov.br'),
  ('AM', '13', 'Amazonas', 'Norte', 'https://www.sefaz.am.gov.br'),
  ('RR', '14', 'Roraima', 'Norte', 'https://www.sefaz.rr.gov.br'),
  ('PA', '15', 'Pará', 'Norte', 'https://www.sefa.pa.gov.br'),
  ('AP', '16', 'Amapá', 'Norte', 'https://www.sefaz.ap.gov.br'),
  ('TO', '17', 'Tocantins', 'Norte', 'https://www.sefaz.to.gov.br'),
  ('MA', '21', 'Maranhão', 'Nordeste', 'https://www.sefaz.ma.gov.br'),
  ('PI', '22', 'Piauí', 'Nordeste', 'https://www.sefaz.pi.gov.br'),
  ('CE', '23', 'Ceará', 'Nordeste', 'https://www.sefaz.ce.gov.br'),
  ('RN', '24', 'Rio Grande do Norte', 'Nordeste', 'https://www.set.rn.gov.br'),
  ('PB', '25', 'Paraíba', 'Nordeste', 'https://www.sefin.pb.gov.br'),
  ('PE', '26', 'Pernambuco', 'Nordeste', 'https://www.sefaz.pe.gov.br'),
  ('AL', '27', 'Alagoas', 'Nordeste', 'https://www.sefaz.al.gov.br'),
  ('SE', '28', 'Sergipe', 'Nordeste', 'https://www.sefaz.se.gov.br'),
  ('BA', '29', 'Bahia', 'Nordeste', 'https://www.sefaz.ba.gov.br'),
  ('MG', '31', 'Minas Gerais', 'Sudeste', 'https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms/index.html'),
  ('ES', '32', 'Espírito Santo', 'Sudeste', 'https://www.sefaz.es.gov.br'),
  ('RJ', '33', 'Rio de Janeiro', 'Sudeste', 'https://www.fazenda.rj.gov.br'),
  ('SP', '35', 'São Paulo', 'Sudeste', 'https://www.fazenda.sp.gov.br'),
  ('PR', '41', 'Paraná', 'Sul', 'https://www.fazenda.pr.gov.br'),
  ('SC', '42', 'Santa Catarina', 'Sul', 'https://www.sef.sc.gov.br'),
  ('RS', '43', 'Rio Grande do Sul', 'Sul', 'https://www.sefaz.rs.gov.br'),
  ('MS', '50', 'Mato Grosso do Sul', 'Centro-Oeste', 'https://www.sefaz.ms.gov.br'),
  ('MT', '51', 'Mato Grosso', 'Centro-Oeste', 'https://www.sefaz.mt.gov.br'),
  ('GO', '52', 'Goiás', 'Centro-Oeste', 'https://goias.gov.br/economia/legislacao-tributaria/'),
  ('DF', '53', 'Distrito Federal', 'Centro-Oeste', 'https://www.fazenda.df.gov.br')
ON CONFLICT(uf) DO UPDATE SET cuf=EXCLUDED.cuf,nome=EXCLUDED.nome,regiao=EXCLUDED.regiao,portal_tributario=EXCLUDED.portal_tributario;

-- Repositório jurídico estadual: ainda SEM linhas homologadas.
CREATE TABLE IF NOT EXISTS public.cfop_regras_tributarias_uf (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 uf_origem char(2) NOT NULL REFERENCES public.cfop_uf_nacionais(uf),
 uf_destino char(2) NOT NULL REFERENCES public.cfop_uf_nacionais(uf),
 tributo text NOT NULL,
 ncm text,
 cest text,
 finalidade text,
 natureza text,
 regime text,
 regra_json jsonb NOT NULL DEFAULT '{}'::jsonb,
 fonte_url text,
 ato_normativo text,
 artigo text,
 publicada_em date,
 inicio_vigencia date,
 fim_vigencia date,
 situacao text NOT NULL DEFAULT 'em_estudo'
  CHECK (situacao IN ('em_estudo','em_revisao','homologada','revogada')),
 aprovado_por text,
 homologado_em timestamptz,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK (fim_vigencia IS NULL OR inicio_vigencia IS NULL OR fim_vigencia >= inicio_vigencia),
 CHECK (situacao NOT IN ('homologada','revogada') OR
       (fonte_url IS NOT NULL AND ato_normativo IS NOT NULL
        AND inicio_vigencia IS NOT NULL AND aprovado_por IS NOT NULL
        AND homologado_em IS NOT NULL))
);
ALTER TABLE public.cfop_regras_tributarias_uf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cfop_regras_tributarias_uf FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS cfop_regras_uf_por_origem_destino
 ON public.cfop_regras_tributarias_uf (uf_origem,uf_destino,situacao,inicio_vigencia);
CREATE INDEX IF NOT EXISTS cfop_regras_uf_por_ncm
 ON public.cfop_regras_tributarias_uf (ncm,cest,situacao);

-- 729 rotas entre 27 UFs (inclusive operações internas).
CREATE OR REPLACE VIEW public.cfop_rotas_nacionais
WITH (security_invoker=true) AS
 SELECT a.uf::text origem,b.uf::text destino,
        a.cuf::text cuf_origem,b.cuf::text cuf_destino,
        (a.uf=b.uf) AS interna,
        CASE WHEN a.uf=b.uf THEN 'interna' ELSE 'interestadual' END tipo_rota
 FROM public.cfop_uf_nacionais a CROSS JOIN public.cfop_uf_nacionais b;
REVOKE ALL ON public.cfop_rotas_nacionais FROM PUBLIC,anon,authenticated;

-- Outros 25 portais estaduais cadastrados; MG/GO já têm as páginas da legislação monitoradas.
INSERT INTO public.cfop_fontes_oficiais(chave,orgao,assunto,uf,url,ativo) VALUES
  ('sefaz-ro', 'Portal tributário Rondônia', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'RO', 'https://www.sefin.ro.gov.br', true),
  ('sefaz-ac', 'Portal tributário Acre', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'AC', 'https://www.sefaz.ac.gov.br', true),
  ('sefaz-am', 'Portal tributário Amazonas', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'AM', 'https://www.sefaz.am.gov.br', true),
  ('sefaz-rr', 'Portal tributário Roraima', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'RR', 'https://www.sefaz.rr.gov.br', true),
  ('sefaz-pa', 'Portal tributário Pará', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'PA', 'https://www.sefa.pa.gov.br', true),
  ('sefaz-ap', 'Portal tributário Amapá', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'AP', 'https://www.sefaz.ap.gov.br', true),
  ('sefaz-to', 'Portal tributário Tocantins', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'TO', 'https://www.sefaz.to.gov.br', true),
  ('sefaz-ma', 'Portal tributário Maranhão', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'MA', 'https://www.sefaz.ma.gov.br', true),
  ('sefaz-pi', 'Portal tributário Piauí', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'PI', 'https://www.sefaz.pi.gov.br', true),
  ('sefaz-ce', 'Portal tributário Ceará', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'CE', 'https://www.sefaz.ce.gov.br', true),
  ('sefaz-rn', 'Portal tributário Rio Grande do Norte', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'RN', 'https://www.set.rn.gov.br', true),
  ('sefaz-pb', 'Portal tributário Paraíba', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'PB', 'https://www.sefin.pb.gov.br', true),
  ('sefaz-pe', 'Portal tributário Pernambuco', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'PE', 'https://www.sefaz.pe.gov.br', true),
  ('sefaz-al', 'Portal tributário Alagoas', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'AL', 'https://www.sefaz.al.gov.br', true),
  ('sefaz-se', 'Portal tributário Sergipe', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'SE', 'https://www.sefaz.se.gov.br', true),
  ('sefaz-ba', 'Portal tributário Bahia', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'BA', 'https://www.sefaz.ba.gov.br', true),
  ('sefaz-es', 'Portal tributário Espírito Santo', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'ES', 'https://www.sefaz.es.gov.br', true),
  ('sefaz-rj', 'Portal tributário Rio de Janeiro', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'RJ', 'https://www.fazenda.rj.gov.br', true),
  ('sefaz-sp', 'Portal tributário São Paulo', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'SP', 'https://www.fazenda.sp.gov.br', true),
  ('sefaz-pr', 'Portal tributário Paraná', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'PR', 'https://www.fazenda.pr.gov.br', true),
  ('sefaz-sc', 'Portal tributário Santa Catarina', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'SC', 'https://www.sef.sc.gov.br', true),
  ('sefaz-rs', 'Portal tributário Rio Grande do Sul', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'RS', 'https://www.sefaz.rs.gov.br', true),
  ('sefaz-ms', 'Portal tributário Mato Grosso do Sul', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'MS', 'https://www.sefaz.ms.gov.br', true),
  ('sefaz-mt', 'Portal tributário Mato Grosso', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'MT', 'https://www.sefaz.mt.gov.br', true),
  ('sefaz-df', 'Portal tributário Distrito Federal', 'Página institucional estadual; regras tributárias específicas ainda não homologadas', 'DF', 'https://www.fazenda.df.gov.br', true)
ON CONFLICT (chave) DO NOTHING;

-- Os 25 portais restantes são capturados em fatias horárias para respeitar quotas.
-- Portais são apenas entrada para localizar atos; mudanças ainda precisam análise jurídica.
CREATE OR REPLACE FUNCTION private_cfop.monitorar_fontes_estaduais_fatia()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path=public,extensions,pg_catalog
AS $fn$
DECLARE
  f record;
  saida jsonb:='[]'::jsonb;
  hora integer := extract(hour from now() AT TIME ZONE 'UTC')::integer;
BEGIN
  FOR f IN
    SELECT chave FROM public.cfop_fontes_oficiais
    WHERE ativo AND chave LIKE 'sefaz-%'
      AND (abs(hashtext(chave)::bigint) % 24) = hora
    ORDER BY chave
  LOOP
    saida:=saida || jsonb_build_array(private_cfop.verificar_fonte_oficial(f.chave));
  END LOOP;
  RETURN saida;
END;
$fn$;
REVOKE ALL ON FUNCTION private_cfop.monitorar_fontes_estaduais_fatia() FROM PUBLIC,anon,authenticated;

SELECT cron.schedule('fortecompanny-monitor-27-ufs',
 '17 * * * *',
 'SELECT private_cfop.monitorar_fontes_estaduais_fatia();');