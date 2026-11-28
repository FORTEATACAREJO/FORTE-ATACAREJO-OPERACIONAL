create table public.ft_dossier_assignments_history (
 empresa_id uuid not null,
 carga_id text not null,
 user_id uuid not null references auth.users(id),
 revision integer not null check(revision>0),
 papel text not null check(papel in ('JULIANA','PEDRO')),
 ativo boolean not null,
 actor uuid not null references auth.users(id),
 changed_at timestamptz not null default now(),
 primary key(empresa_id,carga_id,user_id,revision)
);
create index ft_dossier_assignments_user_idx on public.ft_dossier_assignments_history(empresa_id,user_id,carga_id,revision desc);
alter table public.ft_dossier_assignments_history enable row level security;
revoke all on public.ft_dossier_assignments_history from public,anon,authenticated,service_role;
grant select,insert on public.ft_dossier_assignments_history to service_role;