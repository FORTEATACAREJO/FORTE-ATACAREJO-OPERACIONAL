-- Cada motorista só pode estar vinculado a um veículo ativo por empresa.
-- A placa também já possui índice exclusivo de vínculo ativo.
-- O histórico permanece até o usuário encerrar o vínculo, sem cron automático.
create unique index if not exists fc_frota_motorista_vinculo_ativo_unico
  on public.fc_frota_vinculos(empresa_id,motorista_operacional_id)
  where fim_em is null;
comment on index public.fc_frota_motorista_vinculo_ativo_unico is
  'Um motorista, um veículo ativo até desvinculação explícita. Histórico encerrado preservado.';
