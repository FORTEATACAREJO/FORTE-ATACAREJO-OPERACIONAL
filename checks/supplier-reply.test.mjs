import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchSupplierReply} from '../supabase/functions/orders-workflow/supplier-reply.mjs';

const order = {purchaseId:'p1', os:'OS-000001', channel:'EMAIL', recipient:'fornecedor@example.test', messageId:'m1', sentVersion:'v1'};
const valid = {channel:'EMAIL', sender:order.recipient, orderVersion:'v1', sentOrders:[order],
 body:'Pedido confirmado.\nNossa OS: OS-000001\nNº da Ordem SAP: 0006015647'};
const match = patch => matchSupplierReply({...valid, ...patch});

test('correlaciona resposta explícita e preserva zeros e referências alfanuméricas',()=>{
 assert.deepEqual(match(), {purchaseId:'p1', number:'0006015647'});
 assert.deepEqual(match({channel:'WHATSAPP',replyTo:'m1',sentOrders:[{...order,channel:'WHATSAPP'}],body:'Ordem criada\nNúmero do pedido: A001-02'}),{purchaseId:'p1',number:'A001-02'});
});
test('ignora remetente errado, versão antiga, confirmação já registrada e OS ambígua',()=>{
 for (const patch of [{sender:'outro@example.test'},{orderVersion:'v2'},{sentOrders:[{...order,officialNumber:'123'}]},{sentOrders:[order,{...order,purchaseId:'p2'}]},{replyTo:'outro'},{body:valid.body+'\nOS-000002'}]) assert.equal(match(patch),null);
});
test('ignora solicitação, código ambíguo e resposta citada',()=>{
 for (const body of ['Solicito alteração\nOS-000001\nNúmero do pedido: 123','Nossa OS: OS-000001\nNúmero do pedido: 123\n> Pedido confirmado.',valid.body+'\nNúmero do pedido: 999','> Pedido confirmado.\n> OS-000001\n> Número do pedido: 123']) assert.equal(match({body}),null);
});
