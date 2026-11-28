create table public.forte_atende_access (
 empresa_id uuid not null, user_id uuid not null references auth.users(id), revision integer not null check(revision>0),
 ativo boolean not null, whatsapp boolean not null, email boolean not null, actor uuid not null references auth.users(id),
 changed_at timestamptz not null default now(), primary key(empresa_id,user_id,revision)
);
alter table public.forte_atende_access enable row level security;
revoke all on public.forte_atende_access from public,anon,authenticated,service_role;
grant select,insert on public.forte_atende_access to service_role;
create table public.forte_atende_settings (
 empresa_id uuid not null, revision integer not null check(revision>0), reception boolean not null default false,
 ai boolean not null default false, actor uuid not null references auth.users(id), changed_at timestamptz not null default now(),
 primary key(empresa_id,revision)
);
alter table public.forte_atende_settings enable row level security;
revoke all on public.forte_atende_settings from public,anon,authenticated,service_role;
grant select,insert on public.forte_atende_settings to service_role;
