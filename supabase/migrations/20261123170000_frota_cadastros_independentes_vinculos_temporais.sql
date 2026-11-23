-- Cadastro independente de transportadoras e vínculo temporal motorista/veículo.
-- Compatível com os IDs textuais dos motoristas já existentes em fc_app_state.
create table if not exists public.fc_transportadoras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.fc_empresas(id),
  razao_social text not null check (length(btrim(razao_social)) > 1),
  nome_fantasia text,
  cnpj text,
  whatsapp text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id,id)
);
create unique index if not exists fc_transportadoras_cnpj_unico
  on public.fc_transportadoras(empresa_id,regexp_replace(cnpj,'[^0-9]','','g'))
  where nullif(regexp_replace(coalesce(cnpj,''),'[^0-9]','','g'),'') is not null;

create unique index if not exists fc_veiculos_empresa_id_id_unico
  on public.fc_veiculos(empresa_id,id);

create table if not exists public.fc_frota_vinculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.fc_empresas(id),
  motorista_operacional_id text not null check (length(btrim(motorista_operacional_id))>0),
  veiculo_id uuid not null,
  transportadora_id uuid,
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  vinculado_por uuid not null references auth.users(id),
  desvinculado_por uuid references auth.users(id),
  observacao text,
  created_at timestamptz not null default now(),
  constraint fc_vinculo_periodo_valido check (fim_em is null or fim_em >= inicio_em),
  constraint fc_vinculo_veiculo_mesma_empresa
    foreign key (empresa_id,veiculo_id) references public.fc_veiculos(empresa_id,id) on delete restrict,
  constraint fc_vinculo_transportadora_mesma_empresa
    foreign key (empresa_id,transportadora_id) references public.fc_transportadoras(empresa_id,id) on delete restrict
);
create unique index if not exists fc_frota_veiculo_vinculo_ativo_unico
  on public.fc_frota_vinculos(empresa_id,veiculo_id) where fim_em is null;
create index if not exists fc_frota_motorista_historico_idx
  on public.fc_frota_vinculos(empresa_id,motorista_operacional_id,inicio_em desc);
create index if not exists fc_frota_transportadora_idx
  on public.fc_frota_vinculos(empresa_id,transportadora_id);

create or replace function public.fc_confere_motorista_operacional_vinculo()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not exists (
   select 1 from public.fc_app_state s
   where s.empresa_id=new.empresa_id
     and coalesce(s.estado->'motoristas','[]'::jsonb)
       @> jsonb_build_array(jsonb_build_object('id',new.motorista_operacional_id))
 ) then
  raise exception 'Motorista não encontrado na empresa. Vincule um cadastro operacional existente.';
 end if;
 return new;
end;
$$;
drop trigger if exists fc_frota_valida_motorista on public.fc_frota_vinculos;
create trigger fc_frota_valida_motorista before insert or update of motorista_operacional_id,empresa_id
on public.fc_frota_vinculos for each row execute function public.fc_confere_motorista_operacional_vinculo();

alter table public.fc_transportadoras enable row level security;
alter table public.fc_frota_vinculos enable row level security;
revoke all on public.fc_transportadoras,public.fc_frota_vinculos from anon;
grant select,insert,update,delete on public.fc_transportadoras,public.fc_frota_vinculos to authenticated;
drop policy if exists fc_transportadoras_leitura_empresa on public.fc_transportadoras;
create policy fc_transportadoras_leitura_empresa on public.fc_transportadoras for select to authenticated
using (empresa_id=(select public.fc_current_empresa_id()) and
 (private.access_app_allowed('vendas') or private.access_app_allowed('patio') or private.access_app_allowed('carga-direta')));
drop policy if exists fc_transportadoras_admin_inserir on public.fc_transportadoras;
create policy fc_transportadoras_admin_inserir on public.fc_transportadoras for insert to authenticated
with check (empresa_id=(select public.fc_current_empresa_id()) and public.fc_eh_admin());
drop policy if exists fc_transportadoras_admin_atualizar on public.fc_transportadoras;
create policy fc_transportadoras_admin_atualizar on public.fc_transportadoras for update to authenticated
using (empresa_id=(select public.fc_current_empresa_id()) and public.fc_eh_admin())
with check (empresa_id=(select public.fc_current_empresa_id()) and public.fc_eh_admin());
drop policy if exists fc_frota_vinculos_leitura_empresa on public.fc_frota_vinculos;
create policy fc_frota_vinculos_leitura_empresa on public.fc_frota_vinculos for select to authenticated
using (empresa_id=(select public.fc_current_empresa_id()) and
 (private.access_app_allowed('vendas') or private.access_app_allowed('patio') or private.access_app_allowed('carga-direta')));
drop policy if exists fc_frota_vinculos_admin_inserir on public.fc_frota_vinculos;
create policy fc_frota_vinculos_admin_inserir on public.fc_frota_vinculos for insert to authenticated
with check (empresa_id=(select public.fc_current_empresa_id()) and public.fc_eh_admin() and fim_em is null);
drop policy if exists fc_frota_vinculos_admin_encerrar on public.fc_frota_vinculos;
create policy fc_frota_vinculos_admin_encerrar on public.fc_frota_vinculos for update to authenticated
using (empresa_id=(select public.fc_current_empresa_id()) and public.fc_eh_admin())
with check (empresa_id=(select public.fc_current_empresa_id()) and public.fc_eh_admin());
