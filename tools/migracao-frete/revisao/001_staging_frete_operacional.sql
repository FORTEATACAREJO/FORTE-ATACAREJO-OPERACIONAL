-- REVISÃO HUMANA OBRIGATÓRIA.
-- Este script NÃO faz parte de supabase/migrations e NÃO deve ser aplicado em produção
-- sem backup restaurável, contagens conferidas e aceite específico.
-- Não apaga dados, não grava em public.fc_app_state e não cria usuário de autenticação.
-- e não copia senha, token, certificado ou bytes de anexo.

create schema if not exists migracao_frete;

do $$ begin
 if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;

create table if not exists migracao_frete.lotes (
 id uuid primary key default gen_random_uuid(),
 origem text not null default 'FORTE_FRETE' check (origem='FORTE_FRETE'),
 criado_em timestamptz not null default now(),
 aplicado_em timestamptz,
 observacao text not null default 'rascunho para revisão; não promove cadastro'
);

create table if not exists migracao_frete.itens (
 id uuid primary key default gen_random_uuid(),
 lote_id uuid not null references migracao_frete.lotes(id),
 entidade text not null check (entidade in ('motorista','veiculo','rota','documento','usuario')),
 chave text not null unique,
 apto boolean not null default false,
 ativo boolean not null default false check (ativo=false),
 campos_pendentes text[] not null default '{}',
 origem_atualizado_em timestamptz,
 conteudo_hash text,
 registro jsonb,
 atualizado_em timestamptz not null default now()
);

create or replace function migracao_frete.registrar_item(
 p_lote uuid,
 p_entidade text,
 p_chave text,
 p_apto boolean,
 p_campos_pendentes text[],
 p_origem_atualizado_em timestamptz,
 p_conteudo_hash text,
 p_registro jsonb
) returns text
language plpgsql
as $$
declare atual migracao_frete.itens;
begin
 if p_lote is null or p_chave is null or p_entidade not in ('motorista','veiculo','rota','documento','usuario') then
  return 'bloquear';
 end if;
 if p_registro is not null and (p_registro ? 'senha' or p_registro ? 'password' or p_registro ? 'token' or p_registro ? 'arquivo' or p_registro ? 'conteudo_base64') then
  return 'bloquear';
 end if;
 select * into atual from migracao_frete.itens where chave=p_chave;
 if not found then
  insert into migracao_frete.itens(lote_id,entidade,chave,apto,ativo,campos_pendentes,origem_atualizado_em,conteudo_hash,registro)
  values(p_lote,p_entidade,p_chave,coalesce(p_apto,false),false,coalesce(p_campos_pendentes,'{}'),p_origem_atualizado_em,p_conteudo_hash,p_registro);
  return case when coalesce(p_apto,false) then 'inserir' else 'revisar' end;
 end if;
 if atual.conteudo_hash is not distinct from p_conteudo_hash then return 'preservar'; end if;
 if p_origem_atualizado_em is null or (atual.origem_atualizado_em is not null and p_origem_atualizado_em<atual.origem_atualizado_em) then
  return 'conflito';
 end if;
 if atual.apto and not coalesce(p_apto,false) then return 'conflito'; end if;
 update migracao_frete.itens
  set lote_id=p_lote,apto=coalesce(p_apto,false),ativo=false,campos_pendentes=coalesce(p_campos_pendentes,'{}'),
      origem_atualizado_em=p_origem_atualizado_em,conteudo_hash=p_conteudo_hash,registro=p_registro,atualizado_em=now()
  where chave=p_chave;
 return case when coalesce(p_apto,false) then 'atualizar' else 'revisar' end;
end $$;

alter table migracao_frete.lotes enable row level security;
alter table migracao_frete.itens enable row level security;
revoke all on schema migracao_frete from public, anon, authenticated;
revoke all on all tables in schema migracao_frete from public, anon, authenticated;
revoke all on function migracao_frete.registrar_item(uuid,text,text,boolean,text[],timestamptz,text,jsonb) from public, anon, authenticated;
