import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 supplierSelectedDueDays,parseDueDays,normalizeDueDays,formatSupplierDueDays,
 supplierWithSelectedTerms,supplierRegisteredTerms,toggleSupplierDueDay,supplierPaymentMethod,parseCustomSupplierDueDays
} from '../apps/web/src/supplier-terms-selection.mjs';
import {linkSupplierProductsInBulk} from '../apps/web/src/supplier-products-bulk.mjs';
import {supplierTerms,applyWorkflow} from '../supabase/functions/orders-workflow/domain.mjs';
import {supplierProducts,supplierProductTerms} from '../supabase/functions/orders-workflow/supplier-catalog.mjs';

const products=[
 {id:'p1',nome:'CP II CIPLAN 50 KG',marca:'CIPLAN',finalidade:'REVENDA'},
 {id:'p2',nome:'EXTRA FORTE CIPLAN 40 KG',marca:'CIPLAN',finalidade:'REVENDA'},
 {id:'p3',nome:'ARI CIPLAN 40 KG',marca:'CIPLAN',finalidade:'REVENDA'},
 {id:'uso',nome:'USO INTERNO',finalidade:'USO CONSUMO'}
];

test('múltiplos vencimentos viram uma condição negociada para o pedido',()=>{
 const legacy={id:'f',nome:'CIPLAN',prazosPagamento:['14 dias']};
 assert.deepEqual(supplierSelectedDueDays(legacy),[14]);
 let marked=toggleSupplierDueDay([14],7);
 marked=toggleSupplierDueDay(marked,21);
 marked=toggleSupplierDueDay(marked,28);
 assert.deepEqual(marked,[7,14,21,28]);
 const edited=supplierWithSelectedTerms({...legacy,prazosNegociadosDias:marked});
 assert.equal(edited.condicaoPagamento,'7/14/21/28 dias');
 assert.deepEqual(edited.prazosPagamento,['14 dias','7/14/21/28 dias']);
 assert.deepEqual(edited.prazosNegociadosDias,marked);
 const state={fornecedores:[edited],custosFornecedor:[]};
 assert.equal(supplierTerms(state,'f')[0],'7/14/21/28 dias');
 assert(supplierTerms(state,'f').includes('7/14/21/28 dias'));
 assert.deepEqual(supplierTerms({fornecedores:[{...edited,formaPagamentoPadrao:'BOLETO'}]},'f'),['7/14/21/28 dias','14 dias']);
});

test('prazo legado 14 em forma de pagamento vira prazo, não método',()=>{
 const csn={nome:'CSN',formaPagamentoPadrao:'14 DIAS'};
 assert.deepEqual(supplierSelectedDueDays(csn),[14]);
 const fixed=supplierWithSelectedTerms(csn);
 assert.equal(fixed.condicaoPagamento,'14 dias');
 assert.equal(fixed.formaPagamentoPadrao,'');
 assert.equal(supplierPaymentMethod('BOLETO'),'BOLETO');
 assert.equal(supplierPaymentMethod('14'),'');
});

test('não mistura à vista com parcelas e aceita outros dias sem repetição',()=>{
 assert.deepEqual(toggleSupplierDueDay([7,14],0),[0]);
 assert.deepEqual(toggleSupplierDueDay([0],14),[14]);
 assert.equal(formatSupplierDueDays([14,7,28,14,21]),'7/14/21/28 dias');
 assert.equal(formatSupplierDueDays([0]),'À VISTA');
 assert.deepEqual(parseDueDays('7/14/21/28 DIAS'),[7,14,21,28]);
 assert.deepEqual(normalizeDueDays([7,7,500,-3]),[7]);
 assert.deepEqual(parseDueDays('BOLETO'),[]);
 assert.deepEqual(supplierSelectedDueDays({prazosNegociadosDias:[],formaPagamentoPadrao:'14 dias'}),[]);
});

test('marcar vários produtos vincula tudo em lote, sem duplicar ou inventar preços',()=>{
 const existing=[{produtoId:'p1',custoUnitario:33.2}];
 const linked=linkSupplierProductsInBulk(existing,['p2','p3','p2','uso','p1'],products);
 assert.equal(linked.length,3);
 assert.deepEqual(linked.map(r=>r.produtoId),['p1','p2','p3']);
 assert.equal(linked[0].custoUnitario,33.2);
 assert.equal(linked[1].custoUnitario,'');
 assert.equal(linked[2].custoUnitario,'');
 const supplier={id:'f',nome:'CIPLAN',produtosNegociados:linked};
 const state={fornecedores:[supplier],produtos:products};
 assert.deepEqual(supplierProducts(state,'f').map(p=>p.id),['p1','p2','p3']);
 assert.equal(supplierProductTerms(state,'f','p1').custoUnitario,33.2);
 assert.equal(linkSupplierProductsInBulk(linked,['p1','p3'],products).length,3);
});

test('cadastro rápido tem seleção múltipla e mantém custo por produto',()=>{
 const quick=readFileSync(new URL('../apps/web/src/PedidosFTQuickRegistry.jsx',import.meta.url),'utf8');
 const catalog=readFileSync(new URL('../apps/web/src/SupplierProductCatalog.jsx',import.meta.url),'utf8');
 const terms=readFileSync(new URL('../apps/web/src/SupplierPaymentPreferences.jsx',import.meta.url),'utf8');
 assert.match(quick,/<SupplierPaymentPreferences/);
 assert.match(quick,/<SupplierProductCatalog/);
 assert.match(quick,/supplierWithSelectedTerms\(item\)/);
 assert.match(catalog,/VINCULAR \{checked\.length/);
 assert.match(catalog,/type="checkbox"/);
 assert.match(catalog,/Custo unitário negociado/);
 assert.match(terms,/Marque|marque um ou vários/);
});

test('campo de prazo aceita vários dias separados por vírgula, barra ou ponto e vírgula',()=>{
 for(const input of ['7,14,21','7/14/21','7;14;21','7, 14, 21','7,14,21 dias']){
  const result=parseCustomSupplierDueDays(input);
  assert.equal(result.error,'',input);
  assert.deepEqual(result.days,[7,14,21],input);
 }
 assert.deepEqual(parseCustomSupplierDueDays('56').days,[56]);
 assert.deepEqual(parseCustomSupplierDueDays('7,14,14,21').days,[7,14,21]);
 assert.deepEqual(normalizeDueDays([14,...parseCustomSupplierDueDays('7,14,21').days]),[7,14,21]);
});
test('campo rejeita valor inválido inteiro, sem salvar prazos parcialmente',()=>{
 for(const input of ['','7,,14','7/abc/21','7;367','0,14','7.14','7,','14, 0']){
  const result=parseCustomSupplierDueDays(input);
  assert.notEqual(result.error,'',input);
  assert.deepEqual(result.days,[],input);
 }
});

test('7/14/21 dias é uma condição única, registrada sem apagar 14 dias',()=>{
 const existing={id:'f',nome:'CIPLAN',prazosPagamento:['14 dias']};
 const pending={...existing,prazosNegociadosDias:[7,14,21],condicaoPagamento:'7/14/21 dias'};
 const stored=supplierWithSelectedTerms(pending);
 assert.deepEqual(stored.prazosPagamento,['14 dias','7/14/21 dias']);
 assert.equal(supplierTerms({fornecedores:[stored]},'f')[0],'7/14/21 dias');
 assert(!stored.prazosPagamento.includes('7 dias'));
 assert(!stored.prazosPagamento.includes('21 dias'));
 assert.deepEqual(supplierRegisteredTerms({...stored,prazosPagamento:['14 dias','7/14/21 dias','7,14,21 DIAS','14 DIAS']}),['14 dias','7/14/21 dias']);
 const again=supplierWithSelectedTerms(stored);
 assert.deepEqual(again.prazosPagamento,stored.prazosPagamento);
});
test('cadastro rápido tem botão de gravar condição no servidor sem obrigar frete/catálogo',()=>{
 const registry=readFileSync(new URL('../apps/web/src/PedidosFTQuickRegistry.jsx',import.meta.url),'utf8');
 const terms=readFileSync(new URL('../apps/web/src/SupplierPaymentPreferences.jsx',import.meta.url),'utf8');
 const workspace=readFileSync(new URL('../apps/web/src/OrdersWorkspace.jsx',import.meta.url),'utf8');
 assert.match(terms,/REGISTRAR CONDIÇÃO/);
 assert.match(terms,/onRegisterTerm\(formatted\)/);
 assert.match(registry,/onRegisterTerm=\{term=>onRegisterTerm\?\./);
 assert.match(workspace,/action:'SUPPLIER_TERM',fornecedorId,pagamento:term/);
 assert.match(terms,/Condições já cadastradas neste fornecedor/);
});

test('ação real SUPPLIER_TERM grava 7/14/21 sem exigir frete, paletes ou custos',()=>{
 const state={settings:{},fornecedores:[{id:'f',nome:'CIPLAN',prazosPagamento:['14 dias']}]};
 const actor={user_id:'master',empresa_id:'e',perfil:'MASTER',ativo:true,status_aprovacao:'APROVADO'};
 const result=applyWorkflow(state,{action:'SUPPLIER_TERM',fornecedorId:'f',pagamento:'7/14/21 dias',requestId:'termo-71421'},actor,{id:'auditoria-termo',at:'2026-11-23T22:00:00.000Z'});
 const updated=result.state.fornecedores[0];
 assert.deepEqual(updated.prazosPagamento,['14 dias','7/14/21 dias']);
 assert.deepEqual(supplierTerms(result.state,'f'),['14 dias','7/14/21 dias']);
 assert.equal(updated.modalidadeFrete,undefined);
 assert.equal(updated.condicaoPaletes,undefined);
 assert.equal(updated.produtosNegociados,undefined);
 assert.deepEqual(state.fornecedores[0].prazosPagamento,['14 dias']);
});


test('condições legadas independentes não são somadas ao reabrir',()=>{
 assert.deepEqual(supplierSelectedDueDays({prazosPagamento:['7/14','21']}),[7,14]);
 assert.deepEqual(supplierTerms({fornecedores:[{id:'f',prazosPagamento:['7/14/21','7,14,21 dias','28 dias']}]},'f'),['7/14/21 dias','28 dias']);
});
