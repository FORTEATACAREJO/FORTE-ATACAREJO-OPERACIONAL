do $migration$
declare src text; old_guard text:='if p_estado->''motoristas'' is distinct from a.estado->''motoristas'' then raise exception ''Motoristas são administrados pelo Forte Frete.'' using errcode=''42501'';end if;'; new_guard text;
begin
select pg_get_functiondef('private.fc_gravar_workflow(uuid,uuid,bigint,jsonb)'::regprocedure) into strict src;
if strpos(src,old_guard)=0 then raise exception 'Definição divergente; revisar antes de aplicar'; end if;
new_guard:=$guard$
 if p_estado->'motoristas' is distinct from a.estado->'motoristas' then
  -- Exclusivamente revisão pessoal de um cadastro existente, por responsável autorizado.
  if p.perfil not in ('MASTER','ADMINISTRADOR') then raise exception 'Somente Master ou Administrador pode revisar motoristas.' using errcode='42501';end if;
  if jsonb_typeof(p_estado->'motoristas') is distinct from 'array' or jsonb_typeof(a.estado->'motoristas') is distinct from 'array' or jsonb_array_length(p_estado->'motoristas')<>jsonb_array_length(a.estado->'motoristas') then raise exception 'Revisão não pode incluir ou excluir motoristas.' using errcode='42501';end if;
  if (select count(*) from jsonb_array_elements(a.estado->'motoristas') with ordinality x(v,i) join jsonb_array_elements(p_estado->'motoristas') with ordinality y(v,i) using(i) where x.v is distinct from y.v)<>1 then raise exception 'Revise um motorista por vez.' using errcode='42501';end if;
  if exists(select 1 from jsonb_array_elements(a.estado->'motoristas') with ordinality x(v,i) join jsonb_array_elements(p_estado->'motoristas') with ordinality y(v,i) using(i) where x.v is distinct from y.v and (
   (x.v - array['cpf','cnhNumero','cnhCategoria','cnhValidade','telefone','statusCadastro','ativo','documentosConferidos','elegivelParaCarga','cadastroAdministrativoLiberado','ultimaRevisaoCadastro','aprovacaoOperacional']) is distinct from (y.v - array['cpf','cnhNumero','cnhCategoria','cnhValidade','telefone','statusCadastro','ativo','documentosConferidos','elegivelParaCarga','cadastroAdministrativoLiberado','ultimaRevisaoCadastro','aprovacaoOperacional'])
   or x.v->'bloqueadoGestor'='true'::jsonb or upper(coalesce(x.v->>'statusCadastro',''))='INATIVO'
   or y.v->'ultimaRevisaoCadastro'->>'responsavel' is distinct from p_actor::text
   or nullif(y.v->'ultimaRevisaoCadastro'->>'em','') is null
   or coalesce(y.v->>'statusCadastro','') not in ('APROVADO','PENDENTE_DOCUMENTOS')
   or (y.v->>'statusCadastro'='APROVADO' and (y.v->'ativo' is distinct from 'true'::jsonb or y.v->'documentosConferidos' is distinct from 'true'::jsonb or y.v->'elegivelParaCarga' is distinct from 'true'::jsonb or y.v->'aprovacaoOperacional'->>'responsavel' is distinct from p_actor::text or y.v->'aprovacaoOperacional'->'documentosConferidos' is distinct from 'true'::jsonb or length(btrim(coalesce(y.v->'aprovacaoOperacional'->>'referenciaConferencia','')))<5 or y.v->'ultimaRevisaoCadastro'->>'tipo' is distinct from 'APROVACAO_DOCUMENTAL' or coalesce(y.v->>'cpf','') !~ '^[0-9]{11}$' or coalesce(y.v->>'cnhNumero','') !~ '^[0-9]{11}$' or coalesce(y.v->>'cnhCategoria','') !~ '^(A?[CDE])$' or (nullif(y.v->>'cnhValidade','') is not null and (y.v->>'cnhValidade')::date<=current_date)))
   or (y.v->>'statusCadastro'='PENDENTE_DOCUMENTOS' and (y.v->'ativo' is distinct from 'false'::jsonb or y.v->'documentosConferidos' is distinct from 'false'::jsonb or y.v->'elegivelParaCarga' is distinct from 'false'::jsonb or y.v->'ultimaRevisaoCadastro'->>'tipo' is distinct from 'RASCUNHO' or y.v->'aprovacaoOperacional' is distinct from 'null'::jsonb))
  )) then raise exception 'Alteração fora dos campos de revisão pessoal ou confirmação inválida.' using errcode='42501';end if;
 end if;
$guard$;
execute replace(src,old_guard,new_guard);
end $migration$;
