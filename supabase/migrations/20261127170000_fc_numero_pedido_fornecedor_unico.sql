-- One supplier order reference per operational load, including cancelled loads
-- until the reference is explicitly removed. Purchase and load are two mirrors.
create or replace function private.fc_guardar_numero_pedido_unico()
returns trigger language plpgsql set search_path = '' as $$
declare duplicate_ref text;
begin
 if tg_op='UPDATE' then
  if new.estado->'cargas' is not distinct from old.estado->'cargas' and
     new.estado->'comprasFornecedor' is not distinct from old.estado->'comprasFornecedor' then
   return new;
  end if;
 end if;
 with loads as (
  select v from pg_catalog.jsonb_array_elements(coalesce(new.estado->'cargas','[]'::jsonb)) v
 ), purchases as (
  select v from pg_catalog.jsonb_array_elements(coalesce(new.estado->'comprasFornecedor','[]'::jsonb)) v
 ), refs as (
  select pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(l.v->>'numeroPedidoFornecedor','')),'[[:space:]]+','','g')) as ref,
         'c:'||coalesce(nullif(l.v->>'id',''),'missing-load') as owner
  from loads l
  union all
  select pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p.v->>'numeroPedidoFornecedor','')),'[[:space:]]+','','g')),
         coalesce((select 'c:'||(l.v->>'id') from loads l
                   where l.v->>'id'=p.v->>'cargaId' or l.v->>'compraFornecedorId'=p.v->>'id'
                   order by l.v->>'id' limit 1),'o:'||coalesce(nullif(p.v->>'id',''),'missing-order'))
  from purchases p
 )
 select ref into duplicate_ref from refs where ref<>'' group by ref having count(distinct owner)>1 limit 1;
 if duplicate_ref is not null then
  raise exception 'Número do pedido do fornecedor % já utilizado em outra carga. Exclua o vínculo anterior antes de reutilizar.',duplicate_ref using errcode='23505';
 end if;
 return new;
end;
$$;
revoke all on function private.fc_guardar_numero_pedido_unico() from public,anon,authenticated;
drop trigger if exists fc_04_numero_pedido_unico on public.fc_app_state;
create trigger fc_04_numero_pedido_unico before insert or update on public.fc_app_state
for each row execute function private.fc_guardar_numero_pedido_unico();
