-- Encerramento é o único update permitido: histórico não pode ser reescrito.
create or replace function public.fc_frota_protege_historico()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if old.fim_em is not null then
   raise exception 'Vínculo histórico encerrado é imutável.';
 end if;
 if new.empresa_id is distinct from old.empresa_id
 or new.motorista_operacional_id is distinct from old.motorista_operacional_id
 or new.veiculo_id is distinct from old.veiculo_id
 or new.transportadora_id is distinct from old.transportadora_id
 or new.inicio_em is distinct from old.inicio_em
 or new.vinculado_por is distinct from old.vinculado_por
 or new.observacao is distinct from old.observacao
 or new.created_at is distinct from old.created_at
 or new.fim_em is null
 or new.desvinculado_por is null then
   raise exception 'Somente o encerramento do vínculo pode ser registrado. Preserve o histórico.';
 end if;
 return new;
end;
$$;
drop trigger if exists fc_frota_protege_historico on public.fc_frota_vinculos;
create trigger fc_frota_protege_historico before update on public.fc_frota_vinculos
for each row execute function public.fc_frota_protege_historico();
