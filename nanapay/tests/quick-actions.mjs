/**
 * Nanapay: short-code onboarding, quick reorder and waiter call integration.
 * Pure HTTP integration suite. Never accesses real customer accounts or PDVs.
 */
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const port=18867,base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.mjs'],{
 cwd:new URL('../',import.meta.url),
 env:{...process.env,PORT:String(port),NANAPAY_SKIP_SMOKE:'1'},
 stdio:['ignore','pipe','pipe']
});
let output='';
child.stdout.on('data',b=>output+=b.toString());child.stderr.on('data',b=>output+=b.toString());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(endpoint,payload,headers={}){
 const r=await fetch(base+endpoint,{method:payload===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:payload===undefined?undefined:JSON.stringify(payload)});
 const body=await r.json();return {status:r.status,body};
}
const staff=(endpoint,cred,venue,payload)=>request(endpoint,payload,{'Authorization':'Bearer '+cred,'X-Nana-Establishment':venue});
const pos=(endpoint,cred,payload)=>request(endpoint,payload,{'X-Nanapay-Staff':cred});
try{
 let ready=false;
 for(let i=0;i<50;i++){try{if((await request('/health')).status===200){ready=true;break}}catch{}await sleep(130)}
 assert(ready,'Nanapay backend did not start: '+output);

 const html=await (await fetch(base+'/')).text(),panel=await (await fetch(base+'/painel')).text();
 assert(html.includes('id="repeatProducts"')&&html.includes('Pedir outra'));
 assert(html.includes('id="callWaiter"')&&html.includes('Chamar garçom'));
 assert(html.includes('id="restaurantCode"'));
 assert(html.indexOf('id="items"')<html.indexOf('id="repeatProducts"'));
 assert(html.indexOf('id="repeatProducts"')<html.indexOf('id="menuList"'));
 assert(panel.includes('id="waiterAlerts"')&&panel.includes('id="waiterOrderAlerts"'));
 assert(panel.includes('id="restaurantPublicCode"'));

 const demo=await request('/api/pdv-demo/create',{});
 assert.equal(demo.status,201);
 const {token,staff:posKey,adminToken,establishmentId,restaurantCode}=demo.body;
 assert(/^[A-HJ-NP-Z2-9]{8}$/.test(restaurantCode),'Restaurant code must be easy to type');
 assert.equal((await request('/api/restaurant/resolve?code='+restaurantCode)).body.establishmentId,establishmentId);
 assert.equal((await request('/api/restaurant/resolve?code=ABCD23')).status,400);
 assert.equal((await request('/api/restaurant/resolve?code=ABCDEFGH')).status,404);
 assert.equal((await request('/api/table/enter',{restaurantCode,table:'12'})).body.token,token,'QR and typed code resolve same table');
 assert.equal((await staff('/api/restaurant/dashboard',adminToken,restaurantCode)).status,200,'Staff can use short code as identifier');

 const guest=await request('/api/client/join',{token,name:'Maria'});
 assert.equal(guest.status,201);
 const memberToken=guest.body.memberToken,person=guest.body.person;
 const before=(await request('/api/session/'+token)).body;
 const seed=before.items.find(i=>i.name==='Cerveja');
 assert(seed,'POS seed item not found');
 assert.equal(before.menu.some(m=>m.name==='Cerveja'),false,'Quick repeat should also work for POS products not on web menu');
 const reqId=crypto.randomUUID();
 const reorderData={token,memberToken,person,sourceItemId:seed.id,qty:1,note:'Pedir outra — reposição rápida',requestId:reqId};
 const reordered=await request('/api/client/order',reorderData);
 assert.equal(reordered.status,201,'Repeat must submit request to restaurant');
 const preAccept=(await request('/api/session/'+token)).body;
 assert.equal(preAccept.balance,before.balance,'A new request must not increase the charged total');
 assert.equal(preAccept.orders.at(-1).name,'Cerveja');
 assert.equal(preAccept.orders.at(-1).status,'solicitado');
 assert.equal((await request('/api/client/order',reorderData)).body.duplicate,true);
 assert.equal((await request('/api/client/order',{...reorderData,qty:2})).status,409,'Changed order with same request ID must be rejected');
 const dashboard=await staff('/api/restaurant/dashboard',adminToken,restaurantCode);
 const pending=dashboard.body.tables.find(t=>t.table==='Mesa 12').requestedOrders;
 assert(pending.some(x=>x.name==='Cerveja'&&x.client==='Maria'&&x.qty===1),'Waiter must receive new order');
 assert.equal((await pos('/api/pdv/order-status',posKey,{token,id:reordered.body.orderId,status:'aceito'})).status,200);
 const after=(await request('/api/session/'+token)).body;
 assert.equal(after.balance,before.balance+seed.unit,'Only POS confirmation posts additional charge');

 assert.equal((await request('/api/client/waiter-call',{token,requestId:crypto.randomUUID()})).status,403,'Anonymous visitor cannot call waiter');
 const callId=crypto.randomUUID();
 const called=await request('/api/client/waiter-call',{token,memberToken,requestId:callId});
 assert.equal(called.status,201);
 assert.equal(called.body.table,'Mesa 12');
 assert.equal((await request('/api/client/waiter-call',{token,memberToken,requestId:callId})).body.duplicate,true);
 assert.equal((await request('/api/client/waiter-call',{token,memberToken,requestId:crypto.randomUUID()})).body.duplicate,true,'No repeated active SOS for same client');
 const callList=(await staff('/api/restaurant/dashboard',adminToken,restaurantCode)).body.tables.find(t=>t.table==='Mesa 12');
 assert.equal(callList.callsPending,1);
 assert.equal(callList.waiterCalls[0].client,'Maria');
 assert.equal(callList.waiterCalls[0].table,'Mesa 12');
 assert(!Number.isNaN(Date.parse(callList.waiterCalls[0].at)),'SOS must have timestamp');

 const waiter=await staff('/api/restaurant/waiters',adminToken,restaurantCode,{name:'Lucas'});
 assert.equal(waiter.status,201);
 assert.equal((await staff('/api/restaurant/dashboard',waiter.body.accessToken,restaurantCode)).body.role,'garcom');
 assert.equal((await staff('/api/restaurant/settings',waiter.body.accessToken,restaurantCode,{name:'Not allowed',orderingEnabled:false})).status,403);
 assert.equal((await pos('/api/pdv/payment',waiter.body.accessToken,{token,amount:'1.00',method:'pix'})).status,403,'Waiter role cannot impersonate POS');
 const other=await request('/api/pdv-demo/create',{});
 assert.equal((await staff('/api/restaurant/waiter-call/status',waiter.body.accessToken,other.body.restaurantCode,{id:called.body.callId,status:'atendido'})).status,403);
 assert.equal((await staff('/api/restaurant/waiter-call/status',waiter.body.accessToken,restaurantCode,{id:called.body.callId,status:'a_caminho'})).status,200);
 assert.equal((await request('/api/session/'+token)).body.waiterCalls[0].status,'a_caminho');
 assert.equal((await staff('/api/restaurant/waiter-call/status',waiter.body.accessToken,restaurantCode,{id:called.body.callId,status:'atendido'})).status,200);
 assert.equal((await request('/api/session/'+token)).body.waiterCalls[0].status,'atendido');
 const newCall=await request('/api/client/waiter-call',{token,memberToken,requestId:crypto.randomUUID()});
 assert.equal(newCall.status,201,'After service user can ask again');
 const newCallList=(await staff('/api/restaurant/dashboard',adminToken,restaurantCode)).body.tables.find(t=>t.table==='Mesa 12');
 assert.equal(newCallList.callsPending,1);
 assert.equal((await staff('/api/restaurant/waiter-call/status',waiter.body.accessToken,restaurantCode,{id:newCall.body.callId,status:'atendido'})).status,200);

 assert.equal((await staff('/api/restaurant/settings',adminToken,restaurantCode,{name:'Restaurante de testes',orderingEnabled:false})).status,200);
 assert.equal((await request('/api/client/order',{...reorderData,requestId:crypto.randomUUID()})).status,403,'Restaurant can disable self-service order');
 assert.equal((await staff('/api/restaurant/settings',adminToken,restaurantCode,{name:'Restaurante de testes',orderingEnabled:true})).status,200);

 console.log('PASS Nanapay: QR/code, account-first layout, unique repeat order, waiter SOS, tenant isolation, staff acknowledgment');
}finally{child.kill('SIGTERM')}
