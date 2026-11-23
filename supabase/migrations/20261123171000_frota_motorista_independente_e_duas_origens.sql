-- Motorista é uma pessoa: dados do veículo, proprietário e pagamento não bloqueiam seu cadastro.
alter table public.fc_motoristas alter column cpf drop not null;
alter table public.fc_motoristas alter column whatsapp drop not null;
alter table public.fc_motoristas alter column cnh drop not null;
alter table public.fc_motoristas alter column proprietario_nome drop not null;
alter table public.fc_motoristas alter column chave_pix drop not null;
alter table public.fc_motoristas alter column favorecido_pix drop not null;
alter table public.fc_motoristas alter column capacidade_operacional_kg drop not null;

-- Aceita motoristas tanto do cadastro operacional JSON quanto do cadastro relacional.
create or replace function public.fc_confere_motorista_operacional_vinculo()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not exists (
   select 1 from public.fc_app_state s
   where s.empresa_id=new.empresa_id
     and coalesce(s.estado->'motoristas','[]'::jsonb)
       @> jsonb_build_array(jsonb_build_object('id',new.motorista_operacional_id))
 ) and not exists (
   select 1 from public.fc_motoristas m
   where m.empresa_id=new.empresa_id and m.id::text=new.motorista_operacional_id
 ) then
  raise exception 'Motorista não encontrado na empresa. Cadastre a pessoa antes de vincular.';
 end if;
 return new;
end;
$$;
