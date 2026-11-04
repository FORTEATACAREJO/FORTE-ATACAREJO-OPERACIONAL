import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import * as domain from '../supabase/functions/site-catalogo/domain.mjs';

const products = [
  {id:'cement',nome:'Cimento',marca:'CSN',pesoKg:50,finalidade:'REVENDA',custo:27},
  {id:'asset',nome:'Equipamento',finalidade:'Imobilizado'},
  {id:'old',nome:'Produto inativo',ativo:false},
  {id:'draft',nome:'Rascunho',finalidade:'REVENDA'},
  {id:'legacy',nome:'Cadastro sem classificação'},
];
const listings = [
  {produto_id:'cement',publicado:true,descricao:'Cimento para obra',foto:'01',versao:'private'},
  {produto_id:'asset',publicado:true},
  {produto_id:'old',publicado:true},
  {produto_id:'draft',publicado:false},
  {produto_id:'legacy',publicado:true},
];
const source = stripTypeScriptTypes(await readFile('supabase/functions/site-catalogo/index.ts','utf8'))
  .replace(/^import .*;\n/gm,'');
const origin = 'https://forte-vendas-app.onrender.com';

function setup({role='MASTER',company='public-company',allowed=true,saveData=null}={}) {
  let handler;
  const writes=[];
  const db={
    auth:{getUser:async token=>token==='valid'?{data:{user:{id:'user'}}}:{data:{user:null},error:{}}},
    rpc:async (_name, args)=>({data:{allowed:allowed&&args.p_app==='site',role}}),
    from(table) {
      let payload;
      const query={
        select(){return query;},
        eq(){return query;},
        update(value){payload=value;writes.push(value);return query;},
        insert(value){payload=value;writes.push(value);return query;},
        single(){return query;},
        maybeSingle(){return query;},
        then(resolve) {
          const data=table==='fc_perfis'?{empresa_id:company}:table==='fc_app_state'?{produtos:products}:payload?saveData:listings;
          return resolve({data,error:null});
        },
      };
      return query;
    },
  };
  vm.runInNewContext(source,{
    ...domain,createClient:()=>db,Response,crypto,
    Deno:{env:{get:key=>key==='SITE_CATALOGO_EMPRESA_ID'?'public-company':''},serve:fn=>{handler=fn;}},
  });
  return {
    writes,
    call:(body,token='valid',requestOrigin=origin)=>handler(new Request('https://fixture.test',{
      method:body?'POST':'GET',
      headers:{Origin:requestOrigin,...(token?{Authorization:'Bearer '+token}:{})},
      body:body?JSON.stringify(body):undefined,
    })),
  };
}

test('public catalog exposes only presentation fields of published, active resale products', async()=>{
  const response=await setup().call(null,'');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{produtos:[
    {nome:'Cimento',marca:'CSN',pesoKg:50,descricao:'Cimento para obra',foto:'01'},
  ]});
});

test('publication requires site approval, tenant match and an eligible product',async()=>{
  const body={acao:'SALVAR',produtoId:'cement',publicado:true,foto:'01'};
  for (const options of [{role:'OPERADOR_GERAL'},{allowed:false},{company:'other-company'}]) {
    const app=setup(options);
    assert.equal((await app.call(body)).status,403);
    assert.equal(app.writes.length,0);
  }
  const app=setup();
  assert.equal((await app.call(body,'invalid')).status,401);
  assert.equal((await app.call(body,'valid','https://untrusted.test')).status,403);
  assert.equal((await app.call({...body,produtoId:'asset'})).status,409);
  assert.equal((await app.call({...body,foto:'https://untrusted.test/photo'})).status,400);
  assert.equal(app.writes.length,0);
  assert.equal((await app.call({...body,versao:'stale'})).status,409);
  assert.equal(app.writes.length,1);
  const success=setup({saveData:{produto_id:'cement',publicado:true}});
  assert.equal((await success.call(body)).status,200);
  assert.equal(success.writes[0].empresa_id,'public-company');
  assert.equal(success.writes[0].updated_by,'user');
});

test('catalog table is inaccessible to browser roles',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create table public.fc_empresas(id uuid primary key);
      insert into public.fc_empresas values ('00000000-0000-4000-8000-000000000001');`);
    await db.exec(await readFile('supabase/migrations/20261104150120_site_catalogo.sql','utf8'));
    for(const role of ['anon','authenticated']){
      await db.exec('set role '+role);
      await assert.rejects(db.query('select * from public.fc_site_catalogo'),/permission denied/);
    }
    await db.exec('set role service_role');
    await db.exec(`insert into public.fc_site_catalogo(empresa_id,produto_id,updated_by)
      values ('00000000-0000-4000-8000-000000000001','cement','00000000-0000-4000-8000-000000000002');`);
    assert.equal((await db.query('select publicado from public.fc_site_catalogo')).rows[0].publicado,false);
    await assert.rejects(db.query("update public.fc_site_catalogo set foto = '999'"),/check constraint/);
  } finally {await db.close();}
});

test('catalog renders only the public response, filters brands and fills the quote form',async()=>{
  const {build}=await import('esbuild');
  const {JSDOM}=await import('jsdom');
  const result=await build({
    entryPoints:['apps/web/src/site/catalog.js'],bundle:true,write:false,format:'iife',
    define:{
      'import.meta.env.VITE_SUPABASE_URL':'"https://supabase.example.invalid"',
      'import.meta.env.VITE_SUPABASE_ANON_KEY':'"publishable-fixture"',
    },
  });
  const html=await readFile('apps/web/site.html','utf8');
  const dom=new JSDOM(html,{url:'https://site.example.invalid/site.html',runScripts:'outside-only'});
  try {
    const {window}=dom;
    const fixture={nome:'Cimento <img>',marca:'CSN',pesoKg:50,descricao:'Produto de teste',foto:'01'};
    window.fetch=async (url,options)=>{
      assert.equal(url.pathname,'/functions/v1/site-catalogo');
      assert.equal(options.credentials,'omit');
      assert(!Object.hasOwn(options.headers,'Authorization'));
      return {ok:true,json:async()=>({produtos:[fixture]})};
    };
    window.eval(result.outputFiles[0].text);
    const doc=window.document;
    for(let i=0;i<50&&!doc.querySelector('.card');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(doc.querySelector('.card h3').textContent,fixture.nome);
    assert.equal(doc.querySelectorAll('.card img').length,1);
    doc.querySelector('.brand-filter[data-brand=ciplan]').click();
    assert.equal(doc.querySelector('.card').hidden,true);
    doc.querySelector('.brand-filter[data-brand=csn]').click();
    assert.equal(doc.querySelector('.card').hidden,false);
    doc.querySelector('.card .btn').click();
    assert.equal(doc.getElementById('qProduto').value,'Cimento <img> - 50 kg');
  } finally {dom.window.close();}
});
