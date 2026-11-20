-- FORTE ATENDE: cadastro de campanhas e contatos comerciais, sem disparos automáticos.
-- Isolado do estado fiscal e das vendas. Envio Meta/Gmail permanece desabilitado.
create table if not exists public.forte_atende_contacts (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 name text not null check(length(btrim(name)) between 2 and 180),
 whatsapp text not null default '' check (whatsapp='' or whatsapp ~ '^[0-9]{10,15}$'),
 email text not null default '' check (email='' or (length(email)<=254 and position('@' in email)>1)),
 segment text not null default 'CLIENTES' check(segment in ('CLIENTES','CONSTRUTORAS','REVENDEDORAS','FORNECEDORES')),
 consent_whatsapp boolean not null default false,
 consent_email boolean not null default false,
 consent_source text not null default '',
 consent_at timestamptz,
 opted_out_whatsapp boolean not null default false,
 opted_out_email boolean not null default false,
 created_by uuid not null default (select auth.uid()),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint forte_atende_contact_evidence check(not (consent_whatsapp or consent_email) or (length(btrim(consent_source))>=3 and consent_at is not null))
);
create index if not exists forte_atende_contacts_empresa_idx on public.forte_atende_contacts (empresa_id, segment, created_at desc);
create table if not exists public.forte_atende_campaigns (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 180),
 channel text not null check(channel in ('WHATSAPP','EMAIL','AMBOS')),
 kind text not null check(kind in ('APRESENTACAO','PRODUTOS','MARKETING','COMUNICADO')),
 subject text not null default '',
 body text not null check(length(btrim(body)) between 1 and 4000),
 template_name text not null default '',
 segment text not null default 'TODOS' check(segment in ('TODOS','CLIENTES','CONSTRUTORAS','REVENDEDORAS','FORNECEDORES')),
 scheduled_at timestamptz,
 status text not null default 'RASCUNHO' check(status in ('RASCUNHO','PLANEJADA','PAUSADA')),
 created_by uuid not null default (select auth.uid()),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists forte_atende_campaigns_empresa_idx on public.forte_atende_campaigns (empresa_id, updated_at desc);
-- Acesso somente aos colaboradores aprovados na mesma empresa.
alter table public.forte_atende_contacts enable row level security;
alter table public.forte_atende_campaigns enable row level security;
drop policy if exists "atende_contacts_read" on public.forte_atende_contacts;
create policy "atende_contacts_read" on public.forte_atende_contacts for select to authenticated
using (exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO'));
drop policy if exists "atende_contacts_admin_insert" on public.forte_atende_contacts;
create policy "atende_contacts_admin_insert" on public.forte_atende_contacts for insert to authenticated
with check(created_by=(select auth.uid()) and exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO' and p.perfil::text in ('MASTER','ADMINISTRADOR','ADMIN')));
drop policy if exists "atende_contacts_admin_update" on public.forte_atende_contacts;
create policy "atende_contacts_admin_update" on public.forte_atende_contacts for update to authenticated
using (exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO' and p.perfil::text in ('MASTER','ADMINISTRADOR','ADMIN')))
with check (exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO' and p.perfil::text in ('MASTER','ADMINISTRADOR','ADMIN')));
drop policy if exists "atende_campaigns_read" on public.forte_atende_campaigns;
create policy "atende_campaigns_read" on public.forte_atende_campaigns for select to authenticated
using (exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO'));
drop policy if exists "atende_campaigns_admin_insert" on public.forte_atende_campaigns;
create policy "atende_campaigns_admin_insert" on public.forte_atende_campaigns for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO' and p.perfil::text in ('MASTER','ADMINISTRADOR','ADMIN')));
drop policy if exists "atende_campaigns_admin_update" on public.forte_atende_campaigns;
create policy "atende_campaigns_admin_update" on public.forte_atende_campaigns for update to authenticated
using (exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO' and p.perfil::text in ('MASTER','ADMINISTRADOR','ADMIN')))
with check (exists(select 1 from public.fc_perfis p where p.user_id=(select auth.uid()) and p.empresa_id=empresa_id and p.ativo is true and p.status_aprovacao='APROVADO' and p.perfil::text in ('MASTER','ADMINISTRADOR','ADMIN')));
revoke all on public.forte_atende_contacts from public, anon;
revoke all on public.forte_atende_campaigns from public, anon;
grant select,insert,update on public.forte_atende_contacts to authenticated;
grant select,insert,update on public.forte_atende_campaigns to authenticated;
-- Banco nunca entrega mensagens: status PLANEJADA significa programação registrada e aguardando processamento homologado.
