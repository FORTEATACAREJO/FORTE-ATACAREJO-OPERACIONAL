-- Protect the generic state RPC as well as order-workflow requests.
-- Existing links are grandfathered as evidence; new links need an association
-- in the previously persisted state, not one supplied in the same request.
create or replace function private.fc_guard_supplier_negotiated_catalog()
returns trigger language plpgsql set search_path='' as $$
declare f jsonb; oldf jsonb; r jsonb; p jsonb; prior jsonb; sid text; pid text; seen text[];
begin
 prior := case when tg_op='UPDATE' then old.estado else '{}'::jsonb end;
 for f in select value from jsonb_array_elements(coalesce(new.estado->'fornecedores','[]'::jsonb)) loop
  sid := f->>'id';
  if not (f ? 'produtosNegociados') then continue; end if;
  select value into oldf from jsonb_array_elements(coalesce(prior->'fornecedores','[]'::jsonb)) where value->>'id'=sid;
  if f->'produtosNegociados' is not distinct from oldf->'produtosNegociados' then continue; end if;
  if jsonb_typeof(f->'produtosNegociados') is distinct from 'array' then
   raise exception 'Catálogo negociado inválido.' using errcode='23514';
  end if;
  seen := array[]::text[];
  for r in select value from jsonb_array_elements(f->'produtosNegociados') loop
   pid := r->>'produtoId';
   if coalesce(pid,'')='' or pid=any(seen) then raise exception 'Produto duplicado ou sem ID no catálogo.' using errcode='23514'; end if;
   seen:=array_append(seen,pid);
   if jsonb_typeof(r->'custoUnitario') is distinct from 'number' then raise exception 'Custo negociado inválido.' using errcode='23514'; end if;
   if (r->>'custoUnitario')::numeric<=0 then raise exception 'Custo negociado inválido.' using errcode='23514'; end if;
   select value into p from jsonb_array_elements(coalesce(new.estado->'produtos','[]'::jsonb)) where value->>'id'=pid;
   if p is null or p->'ativo'='false'::jsonb or p->'revenda'='false'::jsonb or
    upper(coalesce(nullif(p->>'finalidade',''),nullif(p->>'purpose',''),nullif(p->>'tipoProduto',''),nullif(p->>'classificacao',''),nullif(p->>'destinacao',''),'REVENDA')) ~ 'USO|CONSUMO|IMOBILIZADO' then
    raise exception 'Produto não elegível para revenda.' using errcode='23514';
   end if;
   if oldf is null or oldf->'ativo'='false'::jsonb or not (
    exists(select 1 from jsonb_array_elements(case when jsonb_typeof(oldf->'produtosNegociados')='array' then oldf->'produtosNegociados' else '[]'::jsonb end) x where x->>'produtoId'=pid)
    or exists(select 1 from jsonb_array_elements(coalesce(prior->'produtos','[]'::jsonb)) x where x->>'id'=pid and (x->>'fornecedorId'=sid or (jsonb_typeof(x->'fornecedorIds')='array' and x->'fornecedorIds' ? sid)))
    or exists(select 1 from jsonb_array_elements(coalesce(prior->'custosFornecedor','[]'::jsonb)) x where x->>'fornecedorId'=sid and x->>'produtoId'=pid and x->'ativo' is distinct from 'false'::jsonb)
   ) then raise exception 'Produto não vinculado ao catálogo deste fornecedor.' using errcode='23514'; end if;
  end loop;
 end loop;
 return new;
end;$$;
revoke all on function private.fc_guard_supplier_negotiated_catalog() from public,anon,authenticated;
create trigger fc_03_guard_supplier_negotiated_catalog before insert or update on public.fc_app_state for each row execute function private.fc_guard_supplier_negotiated_catalog();
