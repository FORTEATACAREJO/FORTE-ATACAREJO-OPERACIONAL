create table public.ft_internal_recipients_history (
 empresa_id uuid not null,
 revision integer not null check(revision > 0),
 faturamento_whatsapp text not null check(faturamento_whatsapp ~ '^55[1-9][0-9]9[0-9]{8}$'),
 fechamento_whatsapp text not null check(fechamento_whatsapp ~ '^55[1-9][0-9]9[0-9]{8}$'),
 changed_by uuid,
 changed_at timestamptz not null default now(),
 origin text not null default 'MASTER' check(origin in ('MASTER','CONFIGURACAO_INICIAL')),
 primary key(empresa_id,revision),
 check(faturamento_whatsapp <> fechamento_whatsapp),
 check(origin='CONFIGURACAO_INICIAL' or changed_by is not null)
);
alter table public.ft_internal_recipients_history enable row level security;
revoke all on public.ft_internal_recipients_history from public,anon,authenticated,service_role;
grant select,insert on public.ft_internal_recipients_history to service_role;
