begin;

create table public.fc_site_catalogo (
  empresa_id uuid not null references public.fc_empresas(id),
  produto_id text not null check (char_length(produto_id) between 1 and 200),
  publicado boolean not null default false,
  descricao text not null default '' check (char_length(descricao) <= 1000),
  foto text check (foto ~ '^(0[1-9]|1[0-4])$'),
  versao uuid not null default gen_random_uuid(),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, produto_id)
);

alter table public.fc_site_catalogo enable row level security;
revoke all on public.fc_site_catalogo from public, anon, authenticated, service_role;
grant select, insert, update on public.fc_site_catalogo to service_role;

commit;
