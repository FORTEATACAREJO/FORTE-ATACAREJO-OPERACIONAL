import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceNavigation,workspaceItemActive} from '../apps/web/src/workspace-navigation.mjs';
test('FORTE-OP exposes all permitted operations in one navigation',()=>{
 const nav=workspaceNavigation(()=>true,()=>true);
 assert.deepEqual(nav.main.map(x=>x.id),['home','painelUnicoVendas','externas','clientes','balcao','painelCompras','paletes','painelCargas','freteSolicitacoes','group:financeiro']);
 assert.deepEqual(nav.more.map(x=>x.id),['whatsapp','group:vendas','group:patio','group:logistica','group:conferencia','group:fornecedores','group:cadastros','group:relatorios','group:integracoes']);
 for(const [screen,group] of [['whatsapp','vendas'],['diretas','vendas'],['estoque','patio'],['paletes','patio'],['itau','cobrancas'],['painelCargas','vendas'],['freteSolicitacoes','logistica'],['financeiro','financeiro']])assert.equal([...nav.main,...nav.more].filter(item=>workspaceItemActive(item,screen,group)).length,1,screen);
});
test('restricted users keep their authorized entry points without gaining finance or stock access',()=>{
 const collections=workspaceNavigation(g=>g==='cobrancas',()=>false);
 assert.deepEqual(collections.main.map(x=>x.id),['home']);assert.deepEqual(collections.more.map(x=>x.id),['group:cobrancas']);
 const logistics=workspaceNavigation(g=>g==='logistica',()=>false);
 assert.deepEqual(logistics.main.map(x=>x.id),['home']);assert.deepEqual(logistics.more.map(x=>x.id),['group:logistica']);
 const admin=workspaceNavigation(g=>g==='cadastros',()=>false);
 assert.deepEqual(admin.main.map(x=>x.id),['home']);assert.equal(admin.more[0].id,'group:cadastros');
 const none=workspaceNavigation(()=>false,()=>false);assert.equal(none.main.length,1);assert.equal(none.more.length,0);
});
