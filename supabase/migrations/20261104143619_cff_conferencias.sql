begin;

create table public.fc_cff_conferencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.fc_empresas(id),
  orcamento_id text not null,
  versao text not null check (versao ~ '^[0-9a-f]{64}$'),
  conferencia jsonb not null check (jsonb_typeof(conferencia) = 'object'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (empresa_id, orcamento_id, versao)
);

create index fc_cff_conferencias_empresa_data on public.fc_cff_conferencias (empresa_id, created_at desc);

alter table public.fc_cff_conferencias enable row level security;
revoke all on public.fc_cff_conferencias from public, anon, authenticated, service_role;
grant select, insert on public.fc_cff_conferencias to service_role;

create function public.fc_cff_registrar(
  p_empresa uuid, p_estado_versao timestamptz, p_orcamento text, p_versao text,
  p_conferencia jsonb, p_autor uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result public.fc_cff_conferencias;
begin
  perform 1 from public.fc_app_state
    where empresa_id = p_empresa and updated_at is not distinct from p_estado_versao
    for share;
  if not found then return null; end if;
  insert into public.fc_cff_conferencias (empresa_id, orcamento_id, versao, conferencia, created_by)
    values (p_empresa, p_orcamento, p_versao, p_conferencia, p_autor)
    returning * into result;
  return jsonb_build_object('id', result.id, 'orcamento_id', result.orcamento_id,
    'versao', result.versao, 'conferencia', result.conferencia, 'created_at', result.created_at);
end;
$$;

revoke all on function public.fc_cff_registrar(uuid,timestamptz,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.fc_cff_registrar(uuid,timestamptz,text,text,jsonb,uuid) to service_role;

commit;
