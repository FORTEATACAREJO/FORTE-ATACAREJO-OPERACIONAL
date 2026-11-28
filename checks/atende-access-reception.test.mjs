import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveInbox} from '../supabase/functions/order-communications/inbox.mjs';
import {receptionCandidate,localSector,classifySector,autoReception} from '../supabase/functions/order-communications/auto-reception.mjs';
import {isMaster,profileActive,manageAttendance} from '../supabase/functions/order-communications/attendance-access.mjs';
const now=Date.now(),m={id:'meta1',from:'5561999999999',type:'text',text:{body:'Olá'},timestamp:String(Math.floor(now/1000))},value={metadata:{phone_number_id:'business'},messages:[m]};
function fixture(){return receiveInbox({},value,new Date(now).toISOString());}
test('recepção não repete mensagem, ignora retorno operacional, fornecedor, motorista e janela vencida',()=>{
 const s=fixture(),t=s.whatsappInboxThreads[0];assert(receptionCandidate(s,t,m,{},now));
 assert(!receptionCandidate(s,t,m,{comunicacoes:[{audience:'FORNECEDOR',to:m.from}]},now));
 assert(!receptionCandidate({...s,motoristas:[{telefone:m.from}]},t,m,{},now));
 assert(!receptionCandidate(s,t,{...m,context:{id:'a'}},{},now));assert(!receptionCandidate(s,t,m,{},now+25*3600000));
 assert(!receptionCandidate(s,{...t,assignedTo:'agent'},m,{},now));s.whatsappInboxMessages.push({direction:'OUT',threadId:t.id});assert(!receptionCandidate(s,t,m,{},now));
});
test('triagem por categoria e fallback, IA não inventa setor e não recebe identificadores',async()=>{
 assert.equal(localSector('Preciso da segunda via do boleto'),'FINANCEIRO');assert.equal(localSector('nota fiscal e boleto'),null);
 let request;const fetcher=async(_url,opts)=>{request=JSON.parse(opts.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'DESCONHECIDO'}]}]})}};
 assert.equal(await classifySector('Olá meu CPF 111.222.333-44',()=> 'fixture-key',fetcher),null);assert(!request.input.includes('111'));assert.equal(request.store,false);
 assert.equal(await classifySector('Olá',()=> 'fixture-key',async()=>({ok:false})),null);
});
test('não concede acesso mestre a perfil comum e exige permissão aprovada',async()=>{
 const p={empresa_id:'a',ativo:true,status_aprovacao:'APROVADO',trocar_senha:false,perfil:'VENDEDOR_INTERNO'};assert(profileActive(p));assert(!isMaster(p,{allowed:true,role:'MASTER'}));assert(!profileActive({...p,ativo:false}));
 const db={from:()=>({select(){return this},eq(){return this},order(){return this},limit(){return this},async maybeSingle(){return {data:{ativo:true,whatsapp:true,email:false}}}})};
 assert.deepEqual(await manageAttendance({db,p,user:{id:'u'},master:false,body:{action:'ATENDE_ACCESS'},env:()=>''}),{master:false,whatsapp:true,email:false});
 await assert.rejects(()=>manageAttendance({db,p,user:{id:'u'},master:false,body:{action:'ATENDE_GRANT'},env:()=>''}),/MASTER/);
});
