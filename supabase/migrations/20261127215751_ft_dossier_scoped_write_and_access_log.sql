create or replace function private.ft_save_dossier_scope(p_empresa uuid,p_actor uuid,p_carga text,p_papel text,p_versao bigint,p_estado jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare a public.fc_app_state; h public.ft_dossier_assignments_history; oldload jsonb; newload jsonb;
begin
 if p_papel not in ('JULIANA','PEDRO') or not exists(select 1 from public.fc_perfis where user_id=p_actor and empresa_id=p_empresa and ativo and status_aprovacao='APROVADO' and not trocar_senha) then raise exception 'Usuário não autorizado.' using errcode='42501';end if;
 lock table public.ft_dossier_assignments_history in share mode;
 select * into h from public.ft_dossier_assignments_history where empresa_id=p_empresa and carga_id=p_carga and user_id=p_actor order by revision desc limit 1;
 if not found or not h.ativo or h.papel<>p_papel then raise exception 'Atribuição revogada ou alterada.' using errcode='42501';end if;
 select * into a from public.fc_app_state where empresa_id=p_empresa for update;
 if not found or a.versao<>p_versao then raise exception 'Conflito de versão.' using errcode='40001';end if;
 select x into oldload from jsonb_array_elements(coalesce(a.estado->'cargas','[]')) x where x->>'id'=p_carga;
 select x into newload from jsonb_array_elements(coalesce(p_estado->'cargas','[]')) x where x->>'id'=p_carga;
 if oldload is null or newload is null or nullif(oldload->>'finalizadaEm','') is not null or oldload->>'status'='CANCELADA' then raise exception 'Carga indisponível.' using errcode='42501';end if;
 if (a.estado-array['cargas','documentos','vendas','auditoria','workflowEvents']) is distinct from (p_estado-array['cargas','documentos','vendas','auditoria','workflowEvents']) then raise exception 'Alteração fora do escopo.' using errcode='42501';end if;
 if (select coalesce(jsonb_agg(x order by n),'[]'::jsonb) from jsonb_array_elements(coalesce(a.estado->'cargas','[]')) with ordinality t(x,n) where x->>'id'<>p_carga) is distinct from (select coalesce(jsonb_agg(x order by n),'[]'::jsonb) from jsonb_array_elements(coalesce(p_estado->'cargas','[]')) with ordinality t(x,n) where x->>'id'<>p_carga) then raise exception 'Outra carga alterada.' using errcode='42501';end if;
 if p_papel='JULIANA' then
  if oldload-'faturamentoFT' is distinct from newload-'faturamentoFT' or a.estado->'vendas' is distinct from p_estado->'vendas' then raise exception 'Faturamento não altera dados comerciais.' using errcode='42501';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(a.estado->'documentos','[]')) x where not coalesce(p_estado->'documentos','[]') @> jsonb_build_array(x)) then raise exception 'Documentos anteriores não podem ser alterados.' using errcode='42501';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_estado->'documentos','[]')) x where not coalesce(a.estado->'documentos','[]') @> jsonb_build_array(x) and (x->>'cargaId' is distinct from p_carga or coalesce(x->>'categoria','') not in ('NF VENDA PDF','NF VENDA XML','BOLETO CLIENTE','COMPROVANTE PAGAMENTO CLIENTE','RECIBO A RECEBER') or not exists(select 1 from jsonb_array_elements(coalesce(a.estado->'vendas','[]')) v where v->>'clienteId'=x->>'clienteId' and (v->>'id'=x->>'vendaId' or v->>'grupoPedidoId'=x->>'vendaId') and (v->>'cargaId'=p_carga or coalesce(v->>'cargaId','')='' and coalesce(oldload->'vendaIds','[]') ? (v->>'id')) and coalesce(v->>'status','') !~* 'CANCELAD|REPROVAD'))) then raise exception 'Anexo fora da venda autorizada.' using errcode='42501';end if;
 else
  if (oldload-array['status','fase','finalizadaEm','finalizadaPor','finalizadaPorId','fechamentoPedro']) is distinct from (newload-array['status','fase','finalizadaEm','finalizadaPor','finalizadaPorId','fechamentoPedro']) then raise exception 'Fechamento não altera dados comerciais.' using errcode='42501';end if;
  if jsonb_array_length(coalesce(a.estado->'documentos','[]'))<>jsonb_array_length(coalesce(p_estado->'documentos','[]')) or exists(select 1 from jsonb_array_elements(coalesce(a.estado->'documentos','[]')) with ordinality x(v,n) join jsonb_array_elements(coalesce(p_estado->'documentos','[]')) with ordinality y(v,n) using(n) where x.v is distinct from y.v and (x.v->>'cargaId' is distinct from p_carga or (x.v-array['validationStatus','identificacaoConfirmada','validadoEm','conferente','evidencia']) is distinct from (y.v-array['validationStatus','identificacaoConfirmada','validadoEm','conferente','evidencia']))) then raise exception 'Documento fora da conferência.' using errcode='42501';end if;
  if jsonb_array_length(coalesce(a.estado->'vendas','[]'))<>jsonb_array_length(coalesce(p_estado->'vendas','[]')) or exists(select 1 from jsonb_array_elements(coalesce(a.estado->'vendas','[]')) with ordinality x(v,n) join jsonb_array_elements(coalesce(p_estado->'vendas','[]')) with ordinality y(v,n) using(n) where x.v is distinct from y.v and (x.v->>'cargaId' is distinct from p_carga or (x.v-array['status','entregueEm']) is distinct from (y.v-array['status','entregueEm']))) then raise exception 'Venda fora da conferência.' using errcode='42501';end if;
 end if;
 perform private.fc_validar_alteracao_financeira(a.estado,p_estado,false);
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 update public.fc_app_state set estado=p_estado,versao=p_versao+1,updated_by=p_actor where empresa_id=p_empresa;
 return p_versao+1;
end $$;
revoke all on function private.ft_save_dossier_scope(uuid,uuid,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function private.ft_save_dossier_scope(uuid,uuid,text,text,bigint,jsonb) to service_role;
create or replace function public.ft_save_dossier_scope(p_empresa uuid,p_actor uuid,p_carga text,p_papel text,p_versao bigint,p_estado jsonb) returns bigint language sql set search_path='' as $$select private.ft_save_dossier_scope(p_empresa,p_actor,p_carga,p_papel,p_versao,p_estado)$$;
revoke all on function public.ft_save_dossier_scope(uuid,uuid,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.ft_save_dossier_scope(uuid,uuid,text,text,bigint,jsonb) to service_role;
create table public.ft_dossier_access_log (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null,carga_id text not null,user_id uuid not null references auth.users(id),acao text not null,documento_id text,created_at timestamptz not null default now()
);
alter table public.ft_dossier_access_log enable row level security;
revoke all on public.ft_dossier_access_log from public,anon,authenticated,service_role;
grant insert,select on public.ft_dossier_access_log to service_role;
