const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const cpfProprio='52998224725',cpfAlheio='39053344705';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create type fc_perfil as enum('MASTER','ADMINISTRADOR','OPERADOR_GERAL','OPERADOR_PATIO','MOTORISTA','VENDEDOR_EXTERNO','VENDEDOR_INTERNO');
create table fc_perfis(user_id uuid primary key,empresa_id uuid,nome text,cpf text,whatsapp text,email text,data_nascimento date,perfil fc_perfil,ativo boolean default false,status_aprovacao text default 'PENDENTE',trocar_senha boolean default false,aprovado_por uuid,aprovado_em timestamptz,permissoes jsonb default '{}');
create table access_requests(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),app text,nome text,cpf text,whatsapp text,email text,data_nascimento date,managed_account boolean default true,status text default 'PENDENTE' constraint access_requests_status_check check(status in ('PENDENTE','APROVADO','RECUSADO')),created_at timestamptz default now(),reviewed_by uuid,reviewed_at timestamptz,reason text,unique(user_id,app));
create table access_audit(app text,event text,user_id uuid);
create table fc_app_state(empresa_id uuid primary key,estado jsonb,versao bigint,updated_by uuid,updated_at timestamptz);alter table fc_app_state enable row level security;create policy existing_state on fc_app_state for all to authenticated using(true) with check(true);create policy access_standard_vendas_state on fc_app_state as restrictive for all to authenticated using(true) with check(true);
create table fc_usuarios_pendentes(id uuid primary key,empresa_id uuid,auth_user_id uuid,status text,analisado_por uuid,analisado_em timestamptz);
create function public.fc_usuario_ativo() returns boolean language sql stable as $$select true$$;
create function public.fc_current_empresa_id() returns uuid language sql stable as $$select empresa_id from fc_perfis where user_id=auth.uid()$$;
grant usage on schema auth,private,public to anon,authenticated,service_role;grant all on all tables in schema public to service_role;grant select,update on fc_app_state to authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261018234959_mobile_module_access_drafts.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261019002158_unified_legal_acceptance.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261110020000_frete_motorista_acesso.sql','utf8'));
 return db;
}
test('perfil motorista entra só no frete e lê a própria carga',async t=>{
 const db=await fixture(),company=id(100);
 const seed=async(n,role,cpf,{active=true,status='APROVADO'}={})=>{
  await db.query('insert into auth.users values($1)',[id(n)]);
  await db.query("insert into fc_perfis(user_id,empresa_id,nome,cpf,whatsapp,email,data_nascimento,perfil,ativo,status_aprovacao) values($1,$2,$3,$4,'5564999999999','fixture@example.invalid','1980-01-01',$5,$6,$7)",[id(n),company,role==='MOTORISTA'?'Motorista da sessao':'Pessoa de teste',cpf,role,active,status]);
 };
 const allowed=async(n,app)=>(await db.query('select private.access_granted_for($1,$2) as allowed',[id(n),app])).rows[0].allowed;
 const accept=async(n,app)=>db.query("select forte_legal_accept($1,$2,version,content_sha256,true,'https://forte-vendas.onrender.com') from forte_legal_term_versions where active",[id(n),app]);
 await seed(1,'MOTORISTA',cpfProprio);await seed(2,'MOTORISTA',cpfAlheio,{active:false,status:'PENDENTE'});await seed(99,'MASTER','11144477735');
 await t.test('sem aceite e sem aprovação o frete permanece fechado',async()=>{
  assert.equal(await allowed(1,'frete'),false);
  await accept(2,'frete');
  assert.equal(await allowed(2,'frete'),false);
 });
 await t.test('motorista aprovado abre o frete e não abre vendas, financeiro nem carga direta',async()=>{
  for(const app of ['frete','vendas','financeiro'])await accept(1,app);
  assert.equal(await allowed(1,'frete'),true);
  for(const app of ['vendas','financeiro','venda-externa','carga-direta','patio','site'])assert.equal(await allowed(1,app),false);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);
  await db.exec('set role authenticated');
  try{
   const ctx=(await db.query("select access_current_module('frete') as result")).rows[0].result;
   assert.equal(ctx.allowed,true);assert.equal(ctx.role,'MOTORISTA');assert.equal(ctx.isAdmin,false);
   assert.equal((await db.query("select access_current_module('vendas') as result")).rows[0].result.allowed,false);
  }finally{await db.exec('reset role');}
 });
 await t.test('a consulta devolve só a carga própria, sem pix, preço ou arquivo',async()=>{
  const estado={motoristas:[
   {id:'mot',nome:'Motorista da sessao',cpf:'529.982.247-25',placa1:'ABC1D23',ativo:true,statusCadastro:'LIBERADO PARA CARGAS',chavePix:'chave-nao-mostrar'},
   {id:'outro',nome:'Outro condutor',cpf:cpfAlheio,placa1:'XYZ9Z99',ativo:true,statusCadastro:'LIBERADO PARA CARGAS',chavePix:'chave-alheia'},
   {id:'pendente',nome:'Cadastro pendente',cpf:'11144477735',ativo:false,statusCadastro:'PRONTO PARA CONFERÊNCIA',chavePix:'chave-pendente'}
  ],cargas:[
   {id:'c1',codigo:'CG-PROPRIA',motoristaId:'mot',fase:'A CAMINHO',status:'VERDE',placa:'ABC1D23',pesoKg:40000,origem:'Arcos',destino:'Catalão',produto:'Cimento',numeroPedidoFornecedor:'PED-1',modalidadeFrete:'FOB',freteValor:9999},
   {id:'c2',codigo:'CG-ALHEIA',motoristaId:'outro',fase:'OCULTA',status:'VERDE',produto:'Sigilo'},
   {id:'c3',codigo:'CG-CANCELADA',motoristaId:'mot',status:'CANCELADA',produto:'Cancelada'}
  ],documentos:[{cargaId:'c1',categoria:'COMPROVANTE ENTREGA',validationStatus:'RECEBIDO',storagePath:'secreto/arquivo.pdf'}],contasPagar:[{titulo:'TITULO-SIGILOSO'}]};
  await db.query('insert into fc_app_state(empresa_id,estado,versao) values($1,$2,1)',[company,estado]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);
  await db.exec('set role authenticated');
  try{
   assert.equal((await db.query('select empresa_id from fc_app_state')).rows.length,0);
   const painel=(await db.query('select public.fc_cargas_do_motorista() as painel')).rows[0].painel;
   const texto=JSON.stringify(painel);
   assert.equal(painel.motorista.nome,'Motorista da sessao');
   assert.deepEqual(painel.cargas.map(c=>c.codigo),['CG-PROPRIA']);
   assert.equal(painel.cargas[0].documentos[0].categoria,'COMPROVANTE ENTREGA');
   assert.equal(painel.cargas[0].documentos[0].situacao,'RECEBIDO');
   for(const segredo of ['chave-nao-mostrar','chave-alheia','chave-pendente','TITULO-SIGILOSO','secreto/arquivo.pdf','Outro condutor','CG-ALHEIA','CG-CANCELADA','9999',cpfAlheio])assert.equal(texto.includes(segredo),false,segredo);
  }finally{await db.exec('reset role');}
  await db.exec('set role anon');
  try{await assert.rejects(db.query('select public.fc_cargas_do_motorista()'),/permission denied/);}finally{await db.exec('reset role');}
 });
 await t.test('master não usa a consulta estreita e solicitação revogada fecha o frete',async()=>{
  await accept(99,'frete');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(99)]);
  await assert.rejects(db.query('select public.fc_cargas_do_motorista()'),/não autorizado/);
  await db.query("insert into access_requests(user_id,app,nome,cpf,status,managed_account) values($1,'frete','Motorista da sessao',$2,'REVOGADO',true)",[id(1),cpfProprio]);
  assert.equal(await allowed(1,'frete'),false);
  await db.query('update fc_perfis set trocar_senha=true where user_id=$1',[id(1)]);
  await db.query("update access_requests set status='APROVADO' where user_id=$1 and app='frete'",[id(1)]);
  assert.equal(await allowed(1,'frete'),false);
 });
 await db.close();
});
