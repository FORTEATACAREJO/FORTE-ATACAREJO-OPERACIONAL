-- Executar no projeto FORTE FRETE de origem e novamente em sua restauração.
-- Este relatório retorna somente contagens. Storage precisa de cópia e verificação de conteúdo.
with c as (select regexp_replace(coalesce(cpf,''),'[^0-9]','','g') as cpf from public.motoristas), refs as (select arquivo_path as name from public.documentos_motorista union all select arquivo_path from public.documentos_veiculo)
select
 (select count(*) from public.motoristas) as motoristas,
 (select count(*) from public.motoristas where auth_user_id is null) as motoristas_sem_login,
 (select count(*) from public.motoristas m where m.auth_user_id is not null and not exists(select 1 from auth.users u where u.id=m.auth_user_id)) as motoristas_com_login_orfao,
 (select count(*) from (select cpf from c where length(cpf)=11 group by cpf having count(*)>1) x) as cpfs_11_digitos_duplicados,
 (select count(*) from public.veiculos_motorista) as veiculos,
 (select count(*) from public.motorista_veiculo_vinculos) as vinculos,
 (select count(*) from public.motorista_veiculo_vinculos v where not exists(select 1 from public.motoristas m where m.id=v.motorista_id) or not exists(select 1 from public.veiculos_motorista w where w.id=v.veiculo_id)) as vinculos_orfaos,
 (select count(*) from refs) as referencias_documentais,
 (select count(*) from refs r where not exists(select 1 from storage.objects o where o.bucket_id='motorista-documentos' and o.name=r.name)) as referencias_sem_objeto,
 (select count(*) from storage.objects) as objetos_storage,
 (select count(*) from storage.buckets where public) as buckets_publicos,
 (select count(*) from auth.users) as identidades,
 (select count(*) from public.viagens) as viagens;
