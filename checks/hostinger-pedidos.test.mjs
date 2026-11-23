import test from 'node:test';
import assert from 'node:assert/strict';
import {hostingerMailbox,supplierEmailPayload,sendSupplierEmailHostinger,HOSTINGER_ORDER_SENDER} from '../supabase/functions/order-communications/hostinger-mail.mjs';

const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
test('consulta somente a caixa corporativa autorizada; falha se não existir',async()=>{
 const fetcher=async()=>response(200,{data:{mailboxes:[{resourceId:'a',address:'outro@example.com'},{resourceId:'b',address:HOSTINGER_ORDER_SENDER}]}});
 const box=await hostingerMailbox('token-test',{fetcher});
 assert.equal(box.mailboxResourceId,'b');
 await assert.rejects(()=>hostingerMailbox('token-test',{fetcher:async()=>response(200,{data:{mailboxes:[{resourceId:'a',address:'outro@example.com'}]}})}),/não possui a caixa/);
 await assert.rejects(()=>hostingerMailbox('',{fetcher}),/não autorizada/);
});
test('pedido enviado com destinatário validado, PDF em base64 e identificação idempotente',async()=>{
 const calls=[];
 const fetcher=async(url,init)=>{calls.push({url,init});return url.endsWith('/me')?response(200,{data:{mailboxes:[{resourceId:'mb1',address:HOSTINGER_ORDER_SENDER}]}}):response(204,{})};
 const job={id:'job-123',reference:'FORTE-2026/123',to:'fornecedor@example.com',message:'Pedido e lista de itens'};
 const result=await sendSupplierEmailHostinger('token-test',job,new Uint8Array([37,80,68,70]),{fetcher});
 assert.equal(result,'hostinger:pedido:job-123');
 assert.equal(calls.length,2);
 assert.equal(calls[1].url,'https://api.mail.hostinger.com/api/v1/mailboxes/mb1/send');
 const body=JSON.parse(calls[1].init.body);
 assert.deepEqual(body.to,['fornecedor@example.com']);
 assert.match(body.subject,/Pedido FORTE-2026\/123/);
 assert.equal(body.attachments[0].filename,'FORTE-2026_123.pdf');
 assert.equal(body.attachments[0].content, 'JVBERg==');
 assert.equal(body.attachments[0].contentType,'application/pdf');
});
test('sem comprovante de aceite, não informa envio como confirmado',async()=>{
 const bad=async(url)=>url.endsWith('/me')?response(200,{data:{mailboxes:[{resourceId:'mb1',address:HOSTINGER_ORDER_SENDER}]}}):response(503,{});
 await assert.rejects(()=>sendSupplierEmailHostinger('token-test',{id:'job',reference:'P-1',to:'fornecedor@example.com'},new Uint8Array([1]),{fetcher:bad}),/não confirmou/);
 assert.throws(()=>supplierEmailPayload({id:'job',reference:'P-1',to:'bad'},new Uint8Array([1])),/inválido/);
});
