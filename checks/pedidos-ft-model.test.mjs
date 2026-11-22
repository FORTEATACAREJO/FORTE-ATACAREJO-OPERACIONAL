import test from 'node:test';
import assert from 'node:assert/strict';
import {quantityReconciliation,buildPedidosFTDossier} from '../apps/web/src/pedidos-ft-model.mjs';

const fixture=()=>({
 cargas:[
  {id:'c1',codigo:'FC-000001',fornecedorId:'f',compraFornecedorId:'o1',motoristaId:'m',vendaIds:['v1','v2'],itensPedido:[{produtoId:'p1',produto:'Cimento 50kg',qtd:100},{produtoId:'p2',produto:'Argamassa 20kg',qtd:40}],regraPallets:'Com pallets',palletQuantidade:3},
  {id:'c2',codigo:'FC-000002',fornecedorId:'f',compraFornecedorId:'o2',vendaIds:['v3'],itensPedido:[{produtoId:'p1',produto:'Cimento 50kg',qtd:250}],regraPallets:'Com pallets',palletQuantidade:7}
 ],
 fornecedores:[{id:'f',nome:'Fornecedor comum',condicaoPaletes:'COM_PALETES'}],
 comprasFornecedor:[
  {id:'o1',cargaId:'c1',numero:'COMP-1',itens:[{produtoId:'p1',produto:'Cimento 50kg',qtd:100},{produtoId:'p2',produto:'Argamassa 20kg',qtd:40}]},
  {id:'o2',cargaId:'c2',numero:'COMP-2',itens:[{produtoId:'p1',produto:'Cimento 50kg',qtd:250}]}
 ],
 motoristas:[{id:'m',nome:'Carlos',placa1:'ABC1D23'}],
 clientes:[{id:'a',nome:'Cliente A',cidade:'Caldas Novas',uf:'GO'},{id:'b',nome:'Cliente B',cidade:'Goiânia',uf:'GO'}],
 vendas:[
  {id:'v1',cargaId:'c1',clienteId:'a',produtoId:'p1',produto:'Cimento 50kg',qtd:100,precoUnitario:31},
  {id:'v2',cargaId:'c1',clienteId:'b',produtoId:'p2',produto:'Argamassa 20kg',qtd:40,precoUnitario:16},
  {id:'v3',cargaId:'c2',clienteId:'a',produtoId:'p1',produto:'Cimento 50kg',qtd:250},
  {id:'v4',cargaId:'c2',clienteId:'b',produtoId:'p1',produto:'Cimento 50kg',qtd:20,status:'CANCELADA'}
 ],
 documentos:[
  {id:'d1',cargaId:'c1',categoria:'BOLETO FORNECEDOR',filename:'boleto-c1.pdf'},
  {id:'d2',cargaId:'c2',categoria:'BOLETO FORNECEDOR',filename:'boleto-c2.pdf'},
  {id:'d3',compraFornecedorId:'o1',categoria:'PDF NF',filename:'nota-o1.pdf'},
  {id:'d4',compraFornecedorId:'o2',categoria:'PDF NF',filename:'nota-o2.pdf'},
  {id:'d5',cargaId:'c2',compraFornecedorId:'o1',categoria:'PDF NF',filename:'conflito.pdf'},
  {id:'d6',cargaId:'c1',clienteId:'a',categoria:'BOLETO CLIENTE',filename:'boleto-a.pdf'}
 ],
 comunicacoes:[
  {id:'j1',cargaId:'c1',audience:'FORNECEDOR',canal:'WHATSAPP',state:'QUEUED',createdAt:'2026-11-22T12:00:00Z'},
  {id:'j2',cargaId:'c2',audience:'FORNECEDOR',canal:'EMAIL',state:'SENT',createdAt:'2026-11-22T12:30:00Z'}
 ],
 retornosFornecedor:[{id:'r1',cargaId:'c1',state:'CONFERIR',receivedAt:'2026-11-22T12:40:00Z'},{id:'r2',cargaId:'c2',state:'VINCULADO',receivedAt:'2026-11-22T12:45:00Z'}]
});

test('conciliacao e por SKU: mesma soma com produtos trocados nao fica verde',()=>{
 const r=quantityReconciliation([{produtoId:'cimento',qtd:100},{produtoId:'argamassa',qtd:50}],[{produtoId:'cimento',qtd:50},{produtoId:'argamassa',qtd:100}]);
 assert.equal(r.comprado,r.distribuido);
 assert.equal(r.status,'DIVERGENTE');
 assert.deepEqual(r.details.map(x=>x.saldo),[50,-50]);
});

test('reconcilia compra e vendas por produto apenas quando quantidades batem',()=>{
 const data=fixture(),one=buildPedidosFTDossier(data,'c1');
 assert.equal(one.reconciliation.status,'CONCILIADA');
 assert.equal(one.reconciliation.comprado,140);
 assert.equal(one.reconciliation.distribuido,140);
 assert.equal(one.clients.length,2);
 assert.equal(one.clients[0].nome,'Cliente A');
 assert.equal(one.pallets.label,'Com paletes');
 assert.equal(one.pallets.quantity,3);
});

test('documentos mensagens e respostas sao filtrados por carga, mesmo fornecedor',()=>{
 const one=buildPedidosFTDossier(fixture(),'c1'),two=buildPedidosFTDossier(fixture(),'c2');
 assert.deepEqual(one.documents.map(d=>d.id),['d1','d3','d6']);
 assert.deepEqual(two.documents.map(d=>d.id),['d2','d4']);
 assert.deepEqual(one.communications.map(d=>d.id),['j1']);
 assert.deepEqual(one.returns.map(d=>d.id),['r1']);
 assert.equal(two.reconciliation.status,'CONCILIADA');
 assert.equal(two.clients.length,1);
});

test('ausencia de pedido ou carga e paletes pendentes nao geram aprovacao falsa',()=>{
 const data=fixture();
 data.fornecedores[0].condicaoPaletes='COM_PALETES_SOLICITADOS_AO_VENDEDOR';
 assert.equal(buildPedidosFTDossier(data,'c1').pallets.status,'DIVERGÊNCIA COM CADASTRO');
 data.cargas[0].regraPallets='Solicitar pallets com liberação do vendedor';
 assert.equal(buildPedidosFTDossier(data,'c1').pallets.status,'AGUARDANDO LIBERAÇÃO');
 data.cargas[0].liberacaoPalletsFornecedor={evidencia:'Autorizado pelo vendedor'};
 assert.equal(buildPedidosFTDossier(data,'c1').pallets.status,'REGRA CADASTRADA');
 assert.equal(buildPedidosFTDossier(data,'inexistente'),null);
 assert.equal(quantityReconciliation([],[]).status,'PENDENTE');
});
