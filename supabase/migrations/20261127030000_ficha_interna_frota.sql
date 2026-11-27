alter table public.fc_motoristas add column if not exists endereco text;
alter table public.forte_op_motoristas_pendentes add column if not exists endereco text;
alter table public.fc_veiculos add column if not exists placas_carretas text[] not null default '{}';

create table public.fc_veiculo_pix (
 veiculo_id uuid primary key references public.fc_veiculos(id) on delete cascade,
 chave_pix text not null
);
alter table public.fc_veiculo_pix enable row level security;
revoke all on public.fc_veiculo_pix from public, anon;
grant select, insert, update, delete on public.fc_veiculo_pix to authenticated;
create policy fc_veiculo_pix_admin on public.fc_veiculo_pix for all to authenticated
 using (public.fc_eh_admin() and exists (
  select 1 from public.fc_veiculos v where v.id=veiculo_id and v.empresa_id=public.fc_current_empresa_id()
 ))
 with check (public.fc_eh_admin() and exists (
  select 1 from public.fc_veiculos v where v.id=veiculo_id and v.empresa_id=public.fc_current_empresa_id()
 ));

create function public.fc_gravar_ficha_veiculo(p_id uuid, p_placa text, p_proprietario text, p_carretas text[], p_pix text, p_transportadora jsonb default null)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
 empresa uuid := public.fc_current_empresa_id();
 veiculo uuid;
begin
 if empresa is null or not coalesce(public.fc_eh_admin(),false) then
  raise exception 'Cadastro restrito à administração.';
 end if;
 if nullif(trim(p_proprietario),'') is null or nullif(trim(p_pix),'') is null then
  raise exception 'Informe o nome do proprietário e a chave Pix do frete.';
 end if;
 if p_placa is null or p_placa !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'
    or coalesce(cardinality(p_carretas),0)>3 or exists (
     select 1 from unnest(p_carretas) as a(placa)
     where placa is null or placa !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' or placa=p_placa
    ) or cardinality(p_carretas) <> (select count(distinct placa) from unnest(p_carretas) as a(placa)) then
  raise exception 'Confira as placas do conjunto.';
 end if;
 if p_id is null then
  insert into public.fc_veiculos(empresa_id,placa,tipo,proprietario_nome,placas_carretas,ativo)
  values(empresa,p_placa,'CAVALO MECÂNICO',nullif(trim(p_proprietario),''),coalesce(p_carretas,'{}'),false)
  returning id into veiculo;
 else
  update public.fc_veiculos set placa=p_placa, proprietario_nome=nullif(trim(p_proprietario),''),
   placas_carretas=coalesce(p_carretas,'{}'), updated_at=now()
  where id=p_id and empresa_id=empresa returning id into veiculo;
 end if;
 if veiculo is null then raise exception 'Veículo não encontrado na empresa ativa.'; end if;
 if p_transportadora is not null then
  update public.fc_veiculos set transportadora_nome=nullif(trim(p_transportadora->>'nome'),''),
   transportadora_cnpj=nullif(trim(p_transportadora->>'cnpj'),''), transportadora_whatsapp=nullif(trim(p_transportadora->>'whatsapp'),'')
  where id=veiculo and empresa_id=empresa;
 end if;
 insert into public.fc_veiculo_pix(veiculo_id,chave_pix) values(veiculo,trim(p_pix))
 on conflict (veiculo_id) do update set chave_pix=excluded.chave_pix;
 return veiculo;
end;
$$;
revoke execute on function public.fc_gravar_ficha_veiculo(uuid,text,text,text[],text,jsonb) from public, anon;
grant execute on function public.fc_gravar_ficha_veiculo(uuid,text,text,text[],text,jsonb) to authenticated;

create function public.fc_gravar_cadastro_conjunto(p_motorista jsonb, p_placa text, p_proprietario text, p_carretas text[], p_pix text)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
 empresa uuid := public.fc_current_empresa_id();
 motorista uuid;
 veiculo uuid;
begin
 if empresa is null or not coalesce(public.fc_eh_admin(),false) then
  raise exception 'Cadastro restrito à administração.';
 end if;
 if nullif(trim(p_motorista->>'nome'),'') is null or
    coalesce(p_motorista->>'whatsapp','') !~ '^[0-9]{10,13}$' then
  raise exception 'Informe nome e WhatsApp com DDD.';
 end if;
 insert into public.fc_motoristas(id,empresa_id,nome,whatsapp,cpf,cnh,categoria_cnh,endereco,status_ia,ativo)
 values(coalesce(nullif(p_motorista->>'id','')::uuid,gen_random_uuid()),empresa,
  trim(p_motorista->>'nome'),p_motorista->>'whatsapp',p_motorista->>'cpf',p_motorista->>'cnh',
  p_motorista->>'categoria_cnh',p_motorista->>'endereco','PENDENTE_CONFERENCIA_DOCUMENTAL',false)
 returning id into motorista;
 veiculo := public.fc_gravar_ficha_veiculo(null,p_placa,p_proprietario,p_carretas,p_pix);
 insert into public.fc_frota_vinculos(empresa_id,motorista_operacional_id,veiculo_id,vinculado_por)
 values(empresa,motorista::text,veiculo,auth.uid());
 return motorista;
end;
$$;
revoke execute on function public.fc_gravar_cadastro_conjunto(jsonb,text,text,text[],text) from public, anon;
grant execute on function public.fc_gravar_cadastro_conjunto(jsonb,text,text,text[],text) to authenticated;
