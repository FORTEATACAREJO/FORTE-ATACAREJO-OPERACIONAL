import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const PORT=17831;const origin='http://127.0.0.1:'+PORT;
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(PORT)},stdio:'pipe'});
let output='';child.stderr.on('data',x=>output+=x);child.stdout.on('data',x=>output+=x);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,obj,staff){const r=await fetch(origin+path,{method:obj?'POST':'GET',headers:{'Content-Type':'application/json',...(staff?{'X-Honesto-Staff':staff}:{})},body:obj?JSON.stringify(obj):undefined});return {status:r.status,body:await r.json()};}
try{
 let ready=false;for(let i=0;i<40;i++){try{if((await req('/health')).status===200){ready=true;break}}catch{}await sleep(150)}
 assert(ready,'servidor não iniciou '+output);
 const demo=(await req('/api/demo')).body;assert(demo.token&&demo.staff);
 const token=demo.token,staff=demo.staff;
 const snap=async()=>{const r=await req('/api/session/'+token);assert.equal(r.status,200);return r.body};
 let d=await snap();assert.equal(d.subtotal,11300);assert.equal(d.people.length,4);assert.equal(d.service,0);assert.equal(d.balance,11300);
 assert(!JSON.stringify(d).includes(staff),'a chave do operador vazou ao cliente');
 const unauthorized=await req('/api/pdv/item',{token,name:'Água',qty:1,price:'6,00'});assert.equal(unauthorized.status,403);
 const added=await req('/api/pdv/item',{token,name:'Água mineral',qty:1,price:'6,00'},staff);assert.equal(added.status,200);
 d=await snap();assert.equal(d.subtotal,11900);
 const person=d.people[0].id;const item=d.items[d.items.length-1].id;
 assert.equal((await req('/api/client/service',{token,person,enabled:true})).status,200);
 d=await snap();assert(d.service>0);
 assert.equal((await req('/api/client/split',{token,mode:'todos',count:4})).status,200);
 d=await snap();assert.equal(Object.values(d.rateio).reduce((a,b)=>a+b,0),d.balance);
 const paid=await req('/api/pdv/payment',{token,amount:'20,00',method:'pix',person,leaves:true},staff);
 assert.equal(paid.status,200);assert.equal(paid.body.confirmed,true);
 d=await snap();assert.equal(d.paid,2000);assert.equal(d.people[0].present,false);
 assert.equal((await req('/api/pdv/payment',{token,amount:'999999',method:'pix'},staff)).status,400);
 assert.equal((await req('/api/client/contest',{token,id:item,reason:'Não solicitei este produto'})).status,200);
 d=await snap();assert.equal(d.disputes.length,1);
 assert.equal((await req('/api/pdv/cancel',{token,id:item},staff)).status,200);
 d=await snap();assert.equal(d.subtotal,11300);
 console.log('PASS: 17 verificações HONESTO: contas, isolamento da chave, caixa, rateio, 10%, pagamentos, contestação, cancelamento');
}finally{child.kill('SIGTERM');}
