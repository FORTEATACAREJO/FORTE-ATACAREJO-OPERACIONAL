begin;
-- Driver entry for the operational PWA. Not applied to production in this change.
create or replace function private.legal_supported(p_app text) returns boolean language sql immutable set search_path='' as $$
 select p_app=any(array['vendas','financeiro','venda-externa','frete']::text[])
$$;

create or replace function private.access_granted_for(p_user uuid,p_app text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare p public.fc_perfis;r public.access_requests;
begin
 if not private.legal_has_current(p_user,p_app) then return false;end if;
 if p_app not in ('vendas','financeiro','venda-externa','carga-direta','patio','site','frete') then return false;end if;
 select * into p from public.fc_perfis where user_id=p_user;
 if not found or not p.ativo or p.status_aprovacao is distinct from 'APROVADO' or p.trocar_senha then return false;end if;
 if p_app='frete' then
  select * into r from public.access_requests where user_id=p_user and app='frete';
  if found then return r.status='APROVADO';end if;
  return p.perfil in ('MOTORISTA','MASTER','ADMINISTRADOR');
 end if;
 if p.perfil='MOTORISTA' then return false;end if;
 select * into r from public.access_requests where user_id=p_user and app=p_app;
 if found then return r.status='APROVADO';end if;
 if exists(select 1 from public.access_requests where user_id=p_user and managed_account) then return false;end if;
 if p.perfil in ('MASTER','ADMINISTRADOR') then return true;end if;
 if coalesce(p.permissoes->p_app='true',false) then return true;end if;
 if p_app='financeiro' then return coalesce(p.permissoes->'FINANCEIRO'='true',false);end if;
 if p_app='venda-externa' then return p.perfil='VENDEDOR_EXTERNO';end if;
 if p_app='patio' then return p.perfil='OPERADOR_PATIO';end if;
 if p_app='vendas' then return p.perfil not in ('OPERADOR_PATIO','MOTORISTA','VENDEDOR_EXTERNO');end if;
 return false;
end;$$;

create or replace function private.fc_cargas_do_motorista() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.fc_perfis;estado jsonb;cpf text;motorista jsonb;cargas jsonb;
begin
 if auth.uid() is null or not private.access_granted_for(auth.uid(),'frete') or private.access_role_for(auth.uid(),'frete') is distinct from 'MOTORISTA' then
  raise exception 'Acesso do motorista não autorizado.' using errcode='42501';
 end if;
 select * into p from public.fc_perfis where user_id=auth.uid();
 if not found then raise exception 'Acesso do motorista não autorizado.' using errcode='42501';end if;
 cpf:=regexp_replace(coalesce(p.cpf,''),'[^0-9]','','g');
 if length(cpf)<>11 then raise exception 'Cadastro do motorista sem identificação conferida.' using errcode='42501';end if;
 select a.estado into estado from public.fc_app_state a where a.empresa_id=p.empresa_id;
 if estado is null then return jsonb_build_object('motorista',null,'cargas','[]'::jsonb,'motivo','Nenhuma base operacional desta empresa.');end if;
 select value into motorista from (
  select value from jsonb_array_elements(coalesce(estado->'motoristas','[]'::jsonb)) item(value)
  where regexp_replace(coalesce(value->>'cpf',''),'[^0-9]','','g')=cpf
   and coalesce(value->>'ativo','true')<>'false'
   and coalesce(value->>'teste','')<>'true'
   and upper(translate(coalesce(value->>'statusCadastro',''),'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc')) !~ 'PENDENTE|ANALISE|RECUSADO|CONFERENCIA|AGUARDANDO'
  order by coalesce((value->>'ativo')::boolean,false) desc
  limit 1
 ) escolhido;
 if motorista is null then return jsonb_build_object('motorista',null,'cargas','[]'::jsonb,'motivo','Cadastro ainda não liberado para cargas.');end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',carga.item->>'id','codigo',carga.item->>'codigo','fase',carga.item->>'fase','status',carga.item->>'status',
  'placa',coalesce(carga.item->>'placa',carga.item->'placas'->>0),'pesoKg',carga.item->'pesoKg',
  'localCarregamento',coalesce(carga.item->>'localCarregamento',carga.item->>'origem'),'destino',carga.item->>'destino',
  'dataCarregamento',carga.item->>'dataCarregamento','numeroPedidoFornecedor',carga.item->>'numeroPedidoFornecedor',
  'modalidadeFrete',carga.item->>'modalidadeFrete','produto',carga.item->>'produto',
  'documentos',coalesce((select jsonb_agg(jsonb_build_object('categoria',doc.item->>'categoria','situacao',coalesce(doc.item->>'validationStatus','RECEBIDO')))
   from jsonb_array_elements(coalesce(estado->'documentos','[]'::jsonb)) doc(item)
   where doc.item->>'cargaId'=carga.item->>'id' and doc.item->>'categoria' in ('COMPROVANTE ENTREGA','COMPROVANTE ENVIO MOTORISTA','XML NF','PDF NF')),'[]'::jsonb)
 ) order by carga.item->>'codigo'),'[]'::jsonb) into cargas
 from jsonb_array_elements(coalesce(estado->'cargas','[]'::jsonb)) carga(item)
 where carga.item->>'motoristaId'=motorista->>'id' and coalesce(carga.item->>'status','')<>'CANCELADA';
 return jsonb_build_object('motorista',jsonb_build_object('id',motorista->>'id','nome',motorista->>'nome','placa',motorista->>'placa1','situacao',motorista->>'statusCadastro'),'cargas',cargas);
end;$$;

create or replace function public.fc_cargas_do_motorista() returns jsonb language sql stable security invoker set search_path='' as $$
 select private.fc_cargas_do_motorista()
$$;

revoke all on function private.fc_cargas_do_motorista(),public.fc_cargas_do_motorista() from public,anon;
grant execute on function private.fc_cargas_do_motorista(),public.fc_cargas_do_motorista() to authenticated,service_role;
commit;
