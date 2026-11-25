import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('triagem de documentos: RLS, sem leitura/escrita direta e limite de etapas',async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 await db.exec(await readFile(new URL('../docs/forte-cadastro-motorista/schema.sql',import.meta.url),'utf8'));
 const ids={id:'00000000-0000-4000-8000-000000000001',empresa:'00000000-0000-4000-8000-000000000002',actor:'00000000-0000-4000-8000-000000000003'};
 await db.exec('set role service_role');
 await db.query("insert into public.fc_driver_intake_links(id,empresa_id,motorista_id,criado_por,token_hash,expira_em) values($1,$2,'motorista-teste',$3,$4,now()+interval '7 days')",[ids.id,ids.empresa,ids.actor,'a'.repeat(64)]);
 await db.query("insert into public.fc_driver_intake_submissions(link_id,slot,dados) values($1,1,'{}')",[ids.id]);
 await assert.rejects(()=>db.query("insert into public.fc_driver_intake_submissions(link_id,slot) values($1,1)",[ids.id]),/duplicate key/);
 await assert.rejects(()=>db.query("insert into public.fc_driver_intake_submissions(link_id,slot) values($1,13)",[ids.id]),/check constraint/);
 await db.exec('reset role');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);for(const table of ['fc_driver_intake_links','fc_driver_intake_submissions']){await assert.rejects(()=>db.query('select * from public.'+table),/permission denied/);await assert.rejects(()=>db.exec('delete from public.'+table),/permission denied/);}await db.exec('reset role');}
 assert.equal((await db.query("select count(*)::int n from pg_class where relname in ('fc_driver_intake_links','fc_driver_intake_submissions') and relrowsecurity")).rows[0].n,2);
 assert.equal((await db.query("select public from storage.buckets where id='forte-driver-intake'")).rows[0].public,false);
 }finally{await db.close();}
});
