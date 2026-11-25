-- Proposta de migração: aplicar somente após homologação. Não altera cadastro operacional.
create table public.fc_driver_intake_links (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null, motorista_id text not null, criado_por uuid not null,
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 criado_em timestamptz not null default now(), expira_em timestamptz not null,
 revogado_em timestamptz
);
create table public.fc_driver_intake_submissions (
 id uuid primary key default gen_random_uuid(),
 link_id uuid not null references public.fc_driver_intake_links(id),
 slot integer not null check(slot between 1 and 12),
 criado_em timestamptz not null default now(),
 dados jsonb not null default '{}'::jsonb,
 arquivos jsonb not null default '[]'::jsonb,
 status text not null default 'RESERVADO' check(status in ('RESERVADO','RECEBIDO')),
 unique(link_id,slot)
);
create index fc_driver_intake_links_driver_idx on public.fc_driver_intake_links(empresa_id,motorista_id,criado_em desc);
alter table public.fc_driver_intake_links enable row level security;
alter table public.fc_driver_intake_submissions enable row level security;
revoke all on public.fc_driver_intake_links,public.fc_driver_intake_submissions from public,anon,authenticated;
grant select,insert,update,delete on public.fc_driver_intake_links,public.fc_driver_intake_submissions to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('forte-driver-intake','forte-driver-intake',false,6291456,array['image/jpeg','image/png','image/webp','application/pdf']);
-- Nenhuma política de acesso público. Conferir políticas globais de storage antes da aplicação.
