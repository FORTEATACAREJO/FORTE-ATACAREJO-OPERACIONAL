-- REVISÃO HUMANA OBRIGATÓRIA.
-- Este script NÃO está em supabase/migrations e NÃO foi aplicado no projeto operacional.
-- Não cria linha em public.fc_motoristas, não copia senha ou arquivo e não apaga o legado.

create schema if not exists frete_migracao;

do $$ begin
 if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;

create table if not exists frete_migracao.pendencias (
 chave text primary key,
 entidade text not null check (entidade in ('motorista','veiculo','rota','documento','usuario')),
 campos_pendentes text[] not null default '{}',
 presente jsonb not null default '{}'::jsonb,
 ativo boolean not null default false check (ativo=false),
 atualizado_em timestamptz not null default now()
);

create or replace function frete_migracao.registrar_pendencia(
 p_chave text,
 p_entidade text,
 p_campos text[],
 p_presente jsonb
) returns text
language plpgsql
as $$
begin
 if p_chave is null or p_entidade not in ('motorista','veiculo','rota','documento','usuario') then
  return 'bloquear';
 end if;
 if p_presente is not null and (
  p_presente ? 'senha' or p_presente ? 'password' or p_presente ? 'encrypted_password'
  or p_presente ? 'token' or p_presente ? 'arquivo' or p_presente ? 'conteudo_base64'
  or p_presente ? 'subscription' or p_presente ? 'endpoint'
 ) then
  return 'bloquear';
 end if;
 if coalesce(p_presente->>'cpf','') ~ '^(0{11}|1{11}|9{11})$' then
  return 'bloquear';
 end if;
 if upper(coalesce(p_presente->>'chave_pix','')) in ('NÃO INFORMADO','NAO INFORMADO','SEM PIX') then
  return 'bloquear';
 end if;
 insert into frete_migracao.pendencias(chave,entidade,campos_pendentes,presente,ativo)
 values (p_chave,p_entidade,coalesce(p_campos,'{}'),coalesce(p_presente,'{}'::jsonb),false)
 on conflict (chave) do update
  set campos_pendentes=excluded.campos_pendentes,
      presente=excluded.presente,
      ativo=false,
      atualizado_em=now();
 return 'revisar';
end $$;

create or replace function frete_migracao.recusar_exclusao()
returns boolean
language sql
immutable
as $$ select false $$;

alter table frete_migracao.pendencias enable row level security;
revoke all on schema frete_migracao from public, anon, authenticated;
revoke all on all tables in schema frete_migracao from public, anon, authenticated;
revoke all on function frete_migracao.registrar_pendencia(text,text,text[],jsonb) from public, anon, authenticated;
revoke all on function frete_migracao.recusar_exclusao() from public, anon, authenticated;
