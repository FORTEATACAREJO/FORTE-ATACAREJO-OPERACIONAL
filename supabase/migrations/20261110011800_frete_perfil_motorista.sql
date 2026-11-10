begin;
-- Preparado para revisão. Não aplicar no Operacional, não copiar Auth/Storage
-- e não apagar o Frete legado. A carga desta migração só existe com sandbox verdadeiro.

create or replace function private.access_granted_for(p_user uuid,p_app text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare p public.fc_perfis;r public.access_requests;
begin
 if not private.legal_has_current(p_user,p_app) then return false;end if;
 if p_app not in ('vendas','financeiro','venda-externa','carga-direta','patio','site','frete') then return false;end if;
 select * into p from public.fc_perfis where user_id=p_user;
 if not found or not p.ativo or p.status_aprovacao is distinct from 'APROVADO' or p.trocar_senha then return false;end if;
 select * into r from public.access_requests where user_id=p_user and app=p_app;
 if p.perfil::text in ('MOTORISTA','MOTORISTA_ENTREGA') then
  if p_app<>'frete' then return false;end if;
  if found then return r.status='APROVADO';end if;
  if exists(select 1 from public.access_requests where user_id=p_user and managed_account) then return false;end if;
  return true;
 end if;
 if found then
  if r.status is distinct from 'APROVADO' then return false;end if;
  if coalesce(r.assigned_role,'') in ('MOTORISTA','MOTORISTA_ENTREGA') then return p_app='frete';end if;
  return true;
 end if;
 if exists(select 1 from public.access_requests where user_id=p_user and managed_account) then return false;end if;
 if p.perfil in ('MASTER','ADMINISTRADOR') then return true;end if;
 if coalesce(p.permissoes->p_app='true',false) then return true;end if;
 if p_app='financeiro' then return coalesce(p.permissoes->'FINANCEIRO'='true',false);end if;
 if p_app='venda-externa' then return p.perfil='VENDEDOR_EXTERNO';end if;
 if p_app='patio' then return p.perfil='OPERADOR_PATIO';end if;
 if p_app='vendas' then return p.perfil not in ('OPERADOR_PATIO','MOTORISTA','VENDEDOR_EXTERNO');end if;
 return false;
end;$$;

create or replace function private.access_is_admin(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from unnest(array['vendas','financeiro','venda-externa','carga-direta','patio','site','frete']) app where private.access_can_review(p_user,app))
$$;

create or replace function public.access_review_with_role(p_request uuid,p_actor uuid,p_decision text,p_role text,p_units uuid[],p_reason text) returns jsonb language plpgsql set search_path='' as $$
declare r public.access_requests; a public.fc_perfis; t public.fc_perfis; chosen text;
begin
 if not private.access_is_admin(p_actor) then raise exception 'Somente admin ou master aprovado pode analisar.' using errcode='42501'; end if;
 select * into a from public.fc_perfis where user_id=p_actor for share;
 select * into r from public.access_requests where id=p_request for update;
 if not found or r.status<>'PENDENTE' then raise exception 'Cadastro não está aguardando análise.'; end if;
 if not private.access_can_review(p_actor,r.app) then raise exception 'Sem autorização administrativa para este módulo.' using errcode='42501';end if;
 select * into t from public.fc_perfis where user_id=r.user_id for update;
 if not found or t.empresa_id is distinct from a.empresa_id then raise exception 'Cadastro não permitido.'; end if;
 if t.perfil::text in ('MASTER','ADMINISTRADOR','ULTRA_ADMIN') and a.perfil::text not in ('MASTER','ULTRA_ADMIN') then raise exception 'Somente master pode analisar usuários administrativos.' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('APROVADO','RECUSADO') or (p_decision='RECUSADO' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'Informe decisão e motivo válidos.'; end if;
 if p_decision='APROVADO' then
  chosen:=nullif(trim(p_role),'');
  if chosen is null then raise exception 'Selecione o perfil do usuário antes de aprovar.'; end if;
  if not chosen=any(array['MASTER','ADMINISTRADOR','OPERADOR_GERAL','OPERADOR_PATIO','MOTORISTA','VENDEDOR_EXTERNO','VENDEDOR_INTERNO']) then raise exception 'Perfil inválido para este sistema.'; end if;
  if chosen in ('MASTER','ADMINISTRADOR') and private.access_role_for(p_actor,r.app) not in ('MASTER','ULTRA_ADMIN') then raise exception 'Somente master pode conceder perfil master ou administrador.' using errcode='42501'; end if;
  if chosen='MOTORISTA' and r.app is distinct from 'frete' then raise exception 'Perfil de motorista só pode ser concedido no módulo Frete.' using errcode='42501'; end if;
  if r.app='frete' and chosen not in ('MOTORISTA','MASTER','ADMINISTRADOR') then raise exception 'No módulo Frete, conceda motorista ou administração do módulo.' using errcode='42501'; end if;
  update public.fc_perfis set ativo=true,status_aprovacao='APROVADO',aprovado_por=p_actor,aprovado_em=now(),perfil=case when not t.ativo then chosen::public.fc_perfil else t.perfil end,permissoes=permissoes||jsonb_build_object(r.app,true) where user_id=r.user_id;
 end if;
 update public.access_requests set status=p_decision,reviewed_by=p_actor,reviewed_at=now(),reason=nullif(trim(p_reason),''),assigned_role=case when p_decision='APROVADO' then chosen else assigned_role end where id=r.id;
 insert into public.access_audit(app,event,user_id) values(r.app,'PERFIL_'||coalesce(chosen,t.perfil::text)||'_'||p_decision,r.user_id);
 return jsonb_build_object('status',p_decision,'app',r.app,'role',coalesce(chosen,t.perfil::text));
end;$$;

create function private.frete_motorista_da_sessao(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.access_granted_for(p_user,'frete') and coalesce(private.access_role_for(p_user,'frete'),'') in ('MOTORISTA','MOTORISTA_ENTREGA')
$$;
revoke all on function private.frete_motorista_da_sessao(uuid) from public,anon;
grant execute on function private.frete_motorista_da_sessao(uuid) to authenticated,service_role;

create table public.fc_frete_operacao_sandbox(
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 motorista_user_id uuid not null,
 codigo text not null check(codigo~'^[A-Z0-9-]{3,40}$'),
 origem text not null check(char_length(origem) between 2 and 80),
 destino text not null check(char_length(destino) between 2 and 80),
 produto text not null check(char_length(produto) between 2 and 80),
 peso_kg numeric(12,3) not null check(peso_kg>0),
 status text not null default 'OFERECIDA' check(status in ('OFERECIDA','ACEITA','RECUSADA')),
 sandbox boolean not null default true check(sandbox),
 motivo text,
 anexo_bucket text,
 anexo_path text,
 anexo_sha256 text,
 decidido_em timestamptz,
 atualizado_em timestamptz not null default now(),
 unique(empresa_id,codigo)
);
alter table public.fc_frete_operacao_sandbox enable row level security;
revoke all on public.fc_frete_operacao_sandbox from public,anon,authenticated;
grant select on public.fc_frete_operacao_sandbox to authenticated;
create policy fc_frete_sandbox_propria on public.fc_frete_operacao_sandbox for select to authenticated using(motorista_user_id=(select auth.uid()) and private.frete_motorista_da_sessao((select auth.uid())));

create function public.fc_frete_oferecer_sandbox(p_empresa uuid,p_motorista uuid,p_codigo text,p_origem text,p_destino text,p_produto text,p_peso numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.fc_frete_operacao_sandbox;novo uuid;
begin
 if not private.access_can_review(auth.uid(),'frete') then raise exception 'Sem autorização administrativa para o Frete.' using errcode='42501';end if;
 if not exists(select 1 from public.fc_perfis where user_id=auth.uid() and empresa_id=p_empresa and ativo and status_aprovacao='APROVADO' and not trocar_senha) then raise exception 'Usuário fora da empresa autorizada.' using errcode='42501';end if;
 if not exists(select 1 from public.fc_perfis where user_id=p_motorista and empresa_id=p_empresa) then raise exception 'Motorista fora da empresa autorizada.' using errcode='42501';end if;
 if not private.frete_motorista_da_sessao(p_motorista) then raise exception 'O motorista ainda não está aprovado no Frete.';end if;
 if p_codigo!~'^[A-Z0-9-]{3,40}$' or p_origem~'^[0-9]{11,}$' or p_destino~'^[0-9]{11,}$' or p_produto~'^[0-9]{11,}$' or concat_ws(' ',p_origem,p_destino,p_produto)~* 'pix|senha|token|password' or p_peso is null or p_peso<=0 then raise exception 'Carga de homologação inválida.';end if;
 select * into atual from public.fc_frete_operacao_sandbox where empresa_id=p_empresa and codigo=p_codigo;
 if found then
  if atual.motorista_user_id=p_motorista and atual.origem=p_origem and atual.destino=p_destino and atual.produto=p_produto and atual.peso_kg=p_peso and atual.sandbox then return jsonb_build_object('id',atual.id,'codigo',atual.codigo,'status',atual.status,'sandbox',true,'idempotente',true);end if;
  raise exception 'Carga de homologação já existe com outro conteúdo.';
 end if;
 insert into public.fc_frete_operacao_sandbox(empresa_id,motorista_user_id,codigo,origem,destino,produto,peso_kg) values(p_empresa,p_motorista,p_codigo,p_origem,p_destino,p_produto,p_peso) returning id into novo;
 insert into public.access_audit(app,event,user_id) values('frete','FRETE_SANDBOX_OFERECIDA',p_motorista);
 return jsonb_build_object('id',novo,'codigo',p_codigo,'status','OFERECIDA','sandbox',true,'idempotente',false);
end;$$;

create function public.fc_frete_minhas_cargas() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid;
begin
 uid:=auth.uid();
 if not private.frete_motorista_da_sessao(uid) then raise exception 'Módulo Frete sem aprovação.' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'codigo',c.codigo,'origem',c.origem,'destino',c.destino,'produto',c.produto,'pesoKg',c.peso_kg,'status',c.status,'motivo',c.motivo,'anexoSha256',c.anexo_sha256,'sandbox',true) order by c.atualizado_em desc) from public.fc_frete_operacao_sandbox c where c.motorista_user_id=uid),'[]'::jsonb);
end;$$;

create function public.fc_frete_decidir_carga(p_id uuid,p_decisao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.fc_frete_operacao_sandbox;uid uuid:=auth.uid();
begin
 if not private.frete_motorista_da_sessao(uid) then raise exception 'Módulo Frete sem aprovação.' using errcode='42501';end if;
 if p_decisao not in ('ACEITA','RECUSADA') then raise exception 'Decisão inválida.';end if;
 if p_decisao='RECUSADA' and length(btrim(coalesce(p_motivo,'')))<3 then raise exception 'Informe o motivo da recusa.';end if;
 select * into atual from public.fc_frete_operacao_sandbox where id=p_id and motorista_user_id=uid for update;
 if not found or not atual.sandbox then raise exception 'Carga de homologação não encontrada.';end if;
 if atual.status=p_decisao then return jsonb_build_object('id',atual.id,'status',atual.status,'idempotente',true);end if;
 if atual.status<>'OFERECIDA' then raise exception 'Esta carga já foi decidida.';end if;
 update public.fc_frete_operacao_sandbox set status=p_decisao,motivo=case when p_decisao='RECUSADA' then left(btrim(p_motivo),300) else null end,decidido_em=now(),atualizado_em=now() where id=atual.id;
 insert into public.access_audit(app,event,user_id) values('frete','FRETE_SANDBOX_'||p_decisao,uid);
 return jsonb_build_object('id',atual.id,'status',p_decisao,'idempotente',false);
end;$$;

create function public.fc_frete_anexar_referencia(p_id uuid,p_bucket text,p_path text,p_sha256 text) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.fc_frete_operacao_sandbox;uid uuid:=auth.uid();esperado text;hash text:=lower(btrim(coalesce(p_sha256,'')));
begin
 if not private.frete_motorista_da_sessao(uid) then raise exception 'Módulo Frete sem aprovação.' using errcode='42501';end if;
 esperado:=uid::text||'/'||p_id::text||'/comprovante';
 if p_bucket is distinct from 'fc-frete-sandbox' or p_path is distinct from esperado or p_path~* 'senha|password|token|pix|base64' or hash!~'^[a-f0-9]{64}$' then raise exception 'Referência de anexo recusada.';end if;
 select * into atual from public.fc_frete_operacao_sandbox where id=p_id and motorista_user_id=uid for update;
 if not found or not atual.sandbox or atual.status<>'ACEITA' then raise exception 'Anexe depois de aceitar a carga de homologação.';end if;
 if atual.anexo_sha256 is not null and atual.anexo_sha256 is distinct from hash then raise exception 'Já existe outro anexo. Não sobrescreve.';end if;
 if atual.anexo_sha256=hash then return jsonb_build_object('id',atual.id,'idempotente',true);end if;
 update public.fc_frete_operacao_sandbox set anexo_bucket=p_bucket,anexo_path=p_path,anexo_sha256=hash,atualizado_em=now() where id=atual.id;
 insert into public.access_audit(app,event,user_id) values('frete','FRETE_SANDBOX_ANEXO',uid);
 return jsonb_build_object('id',atual.id,'idempotente',false);
end;$$;

revoke all on function public.fc_frete_oferecer_sandbox(uuid,uuid,text,text,text,text,numeric),public.fc_frete_minhas_cargas(),public.fc_frete_decidir_carga(uuid,text,text),public.fc_frete_anexar_referencia(uuid,text,text,text) from public,anon;
grant execute on function public.fc_frete_oferecer_sandbox(uuid,uuid,text,text,text,text,numeric),public.fc_frete_minhas_cargas(),public.fc_frete_decidir_carga(uuid,text,text),public.fc_frete_anexar_referencia(uuid,text,text,text) to authenticated,service_role;

do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public) select 'fc-frete-sandbox','fc-frete-sandbox',false where not exists(select 1 from storage.buckets where id='fc-frete-sandbox');
  update storage.buckets set public=false where id='fc-frete-sandbox';
 end if;
 if to_regclass('storage.objects') is not null then
  execute 'drop policy if exists fc_frete_sandbox_owner on storage.objects';
  execute 'create policy fc_frete_sandbox_owner on storage.objects for all to authenticated using (bucket_id=''fc-frete-sandbox'' and private.frete_motorista_da_sessao(auth.uid()) and split_part(name,''/'',1)=auth.uid()::text) with check (bucket_id=''fc-frete-sandbox'' and private.frete_motorista_da_sessao(auth.uid()) and split_part(name,''/'',1)=auth.uid()::text)';
  execute 'drop policy if exists legal_acceptance_gate on storage.objects';
  execute 'create policy legal_acceptance_gate on storage.objects as restrictive for all to authenticated using (case when bucket_id=''fc-frete-sandbox'' then private.frete_motorista_da_sessao(auth.uid()) and split_part(name,''/'',1)=auth.uid()::text when bucket_id=''forte-vendas-financeiro'' then private.access_granted_for(auth.uid(),''financeiro'') and private.access_role_for(auth.uid(),''financeiro'')=''MASTER'' when bucket_id in (''fc-documentos'',''forte-vendas-dossies'') then private.access_granted_for(auth.uid(),''vendas'') or private.access_granted_for(auth.uid(),''financeiro'') else true end) with check (case when bucket_id=''fc-frete-sandbox'' then private.frete_motorista_da_sessao(auth.uid()) and split_part(name,''/'',1)=auth.uid()::text when bucket_id=''forte-vendas-financeiro'' then private.access_granted_for(auth.uid(),''financeiro'') and private.access_role_for(auth.uid(),''financeiro'')=''MASTER'' when bucket_id in (''fc-documentos'',''forte-vendas-dossies'') then private.access_granted_for(auth.uid(),''vendas'') or private.access_granted_for(auth.uid(),''financeiro'') else true end)';
 end if;
end;$$;

commit;
