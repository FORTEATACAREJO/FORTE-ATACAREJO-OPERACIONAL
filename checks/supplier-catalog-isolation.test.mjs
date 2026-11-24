import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {supplierCatalogCandidates,searchSupplierCatalog,validSupplierCatalog,supplierProducts} from '../supabase/functions/orders-workflow/supplier-catalog.mjs';
import {linkSupplierProductsInBulk} from '../apps/web/src/supplier-products-bulk.mjs';
const state=()=>({fornecedores:[{id:'a',nome:'Marca X'},{id:'b',nome:'Marca X'},{id:'c',nome:'Marca X'}],produtos:[
 {id:'a1',nome:'Cimento CP II',marca:'Marca X',fornecedorId:'a'},
 {id:'a2',nome:'Cimento Extra',marca:'Marca X',fornecedorIds:['a']},
 {id:'b1',nome:'Cimento CP II',marca:'Marca X',fornecedorId:'b'},
 {id:'general',nome:'Cimento Geral',marca:'Marca X'},
 {id:'inactive',nome:'Cimento Inativo',fornecedorId:'a',ativo:false},
 {id:'internal',nome:'Cimento Interno',fornecedorId:'a',finalidade:'USO CONSUMO'},
 {id:'cost',nome:'Cimento Custo',marca:'Outra'}
],custosFornecedor:[{fornecedorId:'b',produtoId:'cost'}]});
const ids=rows=>rows.map(x=>x.id);
test('catálogos diferentes, marca idêntica, busca e estado vazio',()=>{
 const s=state();
 assert.deepEqual(ids(supplierCatalogCandidates(s,'a')),['a1','a2']);
 assert.deepEqual(ids(supplierCatalogCandidates(s,'b')),['b1','cost']);
 assert.deepEqual(ids(searchSupplierCatalog(s,'a','CP II')),['a1']);
 assert.deepEqual(ids(searchSupplierCatalog(s,'b','CP II')),['b1']);
 assert.deepEqual(ids(searchSupplierCatalog(s,'a','Geral')),[]);
 assert.deepEqual(ids(supplierCatalogCandidates(s,'c')),[]);
 assert.deepEqual(ids(supplierCatalogCandidates(s,'')),[]);
 assert.deepEqual(ids(supplierProducts(s,'a')),['a1','a2']);
});
test('seleção em lote, duplicatas, troca de catálogo, custos e tentativa de forjar vínculo',()=>{
 const s=state(), visible=searchSupplierCatalog(s,'a');
 const rows=linkSupplierProductsInBulk([],['a1','a2','a1','b1','general'],visible).map((r,i)=>({...r,custoUnitario:30+i}));
 assert.deepEqual(rows,[{produtoId:'a1',custoUnitario:30},{produtoId:'a2',custoUnitario:31}]);
 assert(validSupplierCatalog(rows,s,'a'));
 assert(!validSupplierCatalog(rows,s,'b'));
 assert(!validSupplierCatalog([{produtoId:'b1',custoUnitario:30}],s,'a'));
 assert(!validSupplierCatalog([rows[0],rows[0]],s,'a'));
 assert(!validSupplierCatalog([{produtoId:'a1',custoUnitario:0}],s,'a'));
});
test('persistência real em PostgreSQL isolado: salvar, reabrir, bloquear requisição direta e preservar original',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create schema private; create role anon; create role authenticated; create table public.fc_app_state (id integer primary key, estado jsonb not null);');
 const s=state();
 await db.query('insert into public.fc_app_state values (1,$1::jsonb)',[JSON.stringify(s)]);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261124073100_guard_supplier_negotiated_catalog.sql',import.meta.url),'utf8'));
 const save=next=>db.query('update public.fc_app_state set estado=$1::jsonb where id=1',[JSON.stringify(next)]);
 const load=async()=>(await db.query('select estado from public.fc_app_state where id=1')).rows[0].estado;
 const edited=structuredClone(s);
 edited.fornecedores[0].produtosNegociados=[{produtoId:'a1',custoUnitario:30},{produtoId:'a2',custoUnitario:31}];
 await save(edited);
 let reopened=await load();
 assert.deepEqual(reopened.fornecedores[0].produtosNegociados,edited.fornecedores[0].produtosNegociados);
 assert.deepEqual(ids(supplierProducts(reopened,'a')),['a1','a2']);
 const changed=structuredClone(reopened);
 changed.fornecedores[1].produtosNegociados=[{produtoId:'b1',custoUnitario:33}];
 await save(changed); reopened=await load();
 assert.deepEqual(reopened.fornecedores[1].produtosNegociados,changed.fornecedores[1].produtosNegociados);
 for(const pid of ['b1','general','inactive','internal']){
  const forged=structuredClone(reopened);
  forged.fornecedores[0].produtosNegociados.push({produtoId:pid,custoUnitario:1});
  await assert.rejects(save(forged),/Produto não/);
  assert.deepEqual(await load(),reopened);
 }
 const forged=structuredClone(reopened);
 forged.produtos.find(p=>p.id==='b1').fornecedorId='a';
 forged.fornecedores[0].produtosNegociados.push({produtoId:'b1',custoUnitario:1});
 await assert.rejects(save(forged),/não vinculado/);
 assert.deepEqual(await load(),reopened);
 }finally{await db.close();}
});
