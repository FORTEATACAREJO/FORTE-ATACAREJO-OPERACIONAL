import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appFlagsFrom,screenAllowed} from '../apps/web/src/module-access.mjs';

const groups=new Set();
const allow=(id,action='visualizar')=>groups.has(id)&&(action==='visualizar'||action==='editar');
const ask=(screen,flags={},action='visualizar')=>screenAllowed({screen,action,groupId:screen==='motorista'?'':screen==='externas'||screen==='clientes'?'vendas':'logistica',groupAllowed:allow,appFlags:flags});

test('venda externa abre só a tela de representantes',()=>{
 assert.equal(ask('externas',{ 'venda-externa':true }),true);
 assert.equal(ask('clientes',{ 'venda-externa':true }),false);
 assert.equal(ask('financeiro',{ 'venda-externa':true }),false);
 assert.equal(ask('motorista',{ 'venda-externa':true }),false);
});
test('carga direta abre a venda com destino e não o financeiro',()=>{
 assert.equal(ask('clientes',{ 'carga-direta':true }),true);
 assert.equal(ask('diretas',{ 'carga-direta':true }),true);
 assert.equal(ask('financeiro',{ 'carga-direta':true }),false);
 assert.equal(ask('externas',{ 'carga-direta':true }),false);
});
test('frete abre motoristas sem abrir vendas, estoque ou financeiro',()=>{
 assert.equal(ask('motorista',{ frete:true }),true);
 assert.equal(ask('externas',{ frete:true }),false);
 assert.equal(ask('estoque',{ frete:true }),false);
 assert.equal(ask('financeiro',{ frete:true }),false);
});
test('quem opera vendas consegue selecionar motorista na continuação da carga',()=>{
 groups.add('vendas');
 assert.equal(ask('motorista'),true);
 groups.delete('vendas');
 assert.equal(ask('motorista'),false);
});
test('atalho financeiro legado não herda os outros módulos',()=>{
 assert.equal(screenAllowed({screen:'motorista',groupId:'',groupAllowed:()=>false,appFlags:{frete:true},financeMode:true}),false);
 assert.equal(screenAllowed({screen:'externas',groupId:'vendas',groupAllowed:()=>false,appFlags:{'venda-externa':true},financeMode:true}),false);
});
test('matriz antiga de permissões não vira bandeira de aplicativo',()=>{
 assert.deepEqual(appFlagsFrom({'VENDAS E COMPRAS':{visualizar:true}}),{});
 assert.deepEqual(appFlagsFrom(['*']),{});
 assert.deepEqual(appFlagsFrom({frete:true,vendas:false}),{frete:true});
});
