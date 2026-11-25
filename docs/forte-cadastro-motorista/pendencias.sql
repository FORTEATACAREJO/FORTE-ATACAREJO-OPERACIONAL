-- Escopo opcional para links existentes: null preserva formulário completo.
alter table public.fc_driver_intake_links add column solicitacao jsonb;
