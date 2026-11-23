-- Proprietário e documento do veículo pertencem ao veículo, não ao motorista.
alter table public.fc_veiculos add column if not exists proprietario_nome text;
alter table public.fc_veiculos add column if not exists proprietario_documento text;
alter table public.fc_veiculos add column if not exists crlv_referencia text;
