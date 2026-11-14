-- Manter as quatro fontes legislativas/nacionais verificadas às 08h.
-- Os outros 25 portais estaduais usam o cron "fortecompanny-monitor-27-ufs", distribuído por hora.
CREATE OR REPLACE FUNCTION private_cfop.monitorar_fontes_oficiais()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path=public,extensions,pg_catalog
AS $fn$
DECLARE f record; saida jsonb:='[]'::jsonb;
BEGIN
 FOR f IN SELECT chave FROM public.cfop_fontes_oficiais
  WHERE ativo AND chave IN ('receita-classif','confaz-cest','mg-ricms','go-legislacao')
  ORDER BY chave
 LOOP
   saida:=saida || jsonb_build_array(private_cfop.verificar_fonte_oficial(f.chave));
 END LOOP;
 RETURN saida;
END;
$fn$;
REVOKE ALL ON FUNCTION private_cfop.monitorar_fontes_oficiais() FROM PUBLIC,anon,authenticated;
