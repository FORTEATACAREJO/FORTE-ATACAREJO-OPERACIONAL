-- FORTE ATENDE: lista interna de bloqueio, sem bloquear na Meta e sem excluir mensagens.
-- Migração preparada para revisão e aplicação controlada no banco operacional.
create table if not exists public.forte_atende_contatos_moderacao (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 telefone_e164 text not null check (telefone_e164 ~ '^[+][1-9][0-9]{7,14}$'),
 status text not null check (status in ('bloqueado','descartado','ativo')),
 motivo text,
 alterado_por uuid not null,
 alterado_em timestamptz not null default now(),
 criado_em timestamptz not null default now(),
 unique (empresa_id, telefone_e164)
);
create index if not exists forte_atende_moderacao_empresa_status
 on public.forte_atende_contatos_moderacao(empresa_id,status);
create table if not exists public.forte_atende_contatos_moderacao_auditoria (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 telefone_e164 text not null,
 status_anterior text,
 status_novo text not null,
 motivo text,
 usuario_id uuid not null,
 ocorrido_em timestamptz not null default now()
);
create index if not exists forte_atende_moderacao_auditoria_empresa
 on public.forte_atende_contatos_moderacao_auditoria(empresa_id,ocorrido_em desc);
alter table public.forte_atende_contatos_moderacao enable row level security;
alter table public.forte_atende_contatos_moderacao_auditoria enable row level security;
revoke all on public.forte_atende_contatos_moderacao from anon,authenticated;
revoke all on public.forte_atende_contatos_moderacao_auditoria from anon,authenticated;
-- Nenhuma policy pública. Backend autenticado deve validar usuário, empresa,
-- permissões e registrar mudança + auditoria em uma única transação.
-- Nunca filtrar o armazenamento de mensagens recebidas: filtrar apenas
-- listagem e notificações. Desbloqueio restaura visibilidade do histórico.

revoke all on public.forte_atende_contatos_moderacao, public.forte_atende_contatos_moderacao_auditoria from public,anon,authenticated,service_role;
grant select,insert,update on public.forte_atende_contatos_moderacao to service_role;
grant select,insert on public.forte_atende_contatos_moderacao_auditoria to service_role;

-- Mudança de estado + auditoria atômicas, invocadas somente pelo backend service_role.
create or replace function public.forte_atende_moderar_contato(
 p_empresa uuid, p_telefone text, p_status text, p_motivo text, p_usuario uuid
) returns void language plpgsql security invoker set search_path = '' as $$
declare anterior text;
begin
 if not exists(select 1 from public.fc_perfis where empresa_id=p_empresa and user_id=p_usuario and ativo and status_aprovacao='APROVADO' and not trocar_senha and perfil='MASTER') or p_empresa is null or p_usuario is null or p_telefone !~ '^[+][1-9][0-9]{7,14}$'
    or p_status not in ('ativo','descartado','bloqueado') then
   raise exception 'Dados de moderação inválidos';
 end if;
 if p_status <> 'ativo' and nullif(btrim(coalesce(p_motivo,'')),'') is null then
   raise exception 'Informe o motivo';
 end if;
 -- serializa operações concorrentes do mesmo número
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_empresa::text || ':' || p_telefone,0));
 select status into anterior from public.forte_atende_contatos_moderacao
 where empresa_id=p_empresa and telefone_e164=p_telefone;
 insert into public.forte_atende_contatos_moderacao
 (empresa_id,telefone_e164,status,motivo,alterado_por)
 values (p_empresa,p_telefone,p_status,left(p_motivo,200),p_usuario)
 on conflict (empresa_id,telefone_e164) do update set
 status=excluded.status,motivo=excluded.motivo,alterado_por=excluded.alterado_por,alterado_em=now();
 insert into public.forte_atende_contatos_moderacao_auditoria
 (empresa_id,telefone_e164,status_anterior,status_novo,motivo,usuario_id)
 values (p_empresa,p_telefone,anterior,p_status,left(p_motivo,200),p_usuario);
end $$;
revoke all on function public.forte_atende_moderar_contato(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.forte_atende_moderar_contato(uuid,text,text,text,uuid) to service_role;

