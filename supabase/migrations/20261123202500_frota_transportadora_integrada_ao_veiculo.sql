-- Transportadora permanece como informação do próprio veículo.
-- Não exclui as tabelas legadas para manter compatibilidade e histórico.
alter table public.fc_veiculos
  add column if not exists transportadora_nome text,
  add column if not exists transportadora_cnpj text,
  add column if not exists transportadora_whatsapp text;

-- O vínculo guarda uma cópia informativa da transportadora do veículo na data da associação.
alter table public.fc_frota_vinculos
  add column if not exists transportadora_nome_snapshot text,
  add column if not exists transportadora_cnpj_snapshot text;

comment on column public.fc_veiculos.transportadora_nome is 'Transportadora vinculada ao cadastro do veículo; não é cadastro independente';
comment on column public.fc_frota_vinculos.transportadora_nome_snapshot is 'Transportadora do veículo no momento do vínculo; preservar histórico';
