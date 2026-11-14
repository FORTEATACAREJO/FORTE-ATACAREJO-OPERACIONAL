-- Inclui documentos normativos específicos SP/MT na rotina existente de verificação dos portais.
-- Apenas monitora alterações; nunca ativa regra tributária.
CREATE OR REPLACE FUNCTION private_cfop.monitorar_fontes_estaduais_fatia()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path=public,extensions,pg_catalog
AS $fn$
DECLARE f record;
 saida jsonb:='[]'::jsonb;
 hora integer:=extract(hour from now() AT TIME ZONE 'UTC')::integer;
BEGIN
 FOR f IN
  SELECT chave FROM public.cfop_fontes_oficiais
  WHERE ativo AND (chave LIKE 'sefaz-%' OR modo_coleta='documento_normativo_html')
    AND (abs(hashtext(chave)::bigint)%24)=hora
  ORDER BY chave
 LOOP
  saida:=saida||jsonb_build_array(private_cfop.verificar_fonte_oficial(f.chave));
 END LOOP;
 RETURN saida;
END;
$fn$;
REVOKE ALL ON FUNCTION private_cfop.monitorar_fontes_estaduais_fatia() FROM PUBLIC,anon,authenticated;
