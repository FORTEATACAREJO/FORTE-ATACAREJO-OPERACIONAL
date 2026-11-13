/**
 * HONESTO - demonstração pública isolada.
 * Sem dados de clientes reais, sem faturamento, sem autorização para uso comercial.
 * Volátil por intenção: para produção migrar para PostgreSQL, tenants e integrações auditadas.
 * Titular do projeto: FORTE ATACAREJO LTDA.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||10000);
const store=new Map();
const streams=new Map();
const mk=()=>crypto.randomBytes(24).toString('base64url');
const rand=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();

function newDemo(){
 const s={id:rand(),viewToken:mk(),staffToken:mk(),name:'Restaurante Exemplo',table:'Mesa 12',createdAt:now(),expires:Date.now()+3*3600_000,closed:false,mode:'restante',count:4,
 people:['Ana','Bruno','Carla','Diego'].map((name)=>({id:rand(),name,present:true,service:false})),items:[],payments:[],disputes:[],events:[]};
 const add=(name,qty,price,person)=>s.items.push({id:rand(),name,qty,unit:price,person:person===null?null:s.people[person].id,active:true,at:now()});
 add('Cerveja',2,1200,0);add('Batata frita',1,3800,null);add('Refrigerante',2,800,2);add('Hambúrguer',1,3500,1);
 store.set(s.viewToken,s);return s;
}
const money=(x)=>{const str=String(x).trim().replace(',','.');if(!/^\d{1,6}(\.\d{1,2})?$/.test(str))throw new Error('Valor monetário inválido');const cents=Math.round(Number(str)*100);if(!(cents>0&&cents<=1_000_000))throw new Error('Valor fora do intervalo');return cents;};
function splitAmount(total,ids){const out={};if(!ids.length)return out;const q=Math.floor(total/ids.length),r=total%ids.length;ids.forEach((id,i)=>out[id]=q+(i<r?1:0));return out;}
function snapshot(s){
 const shares=Object.fromEntries(s.people.map(p=>[p.id,0]));
 let shared=0;for(const i of s.items){if(!i.active)continue;let v=i.qty*i.unit;if(i.person&&shares[i.person]!==undefined)shares[i.person]+=v;else shared+=v;}
 const sharedSplit=splitAmount(shared,s.people.map(p=>p.id));for(const [id,amt] of Object.entries(sharedSplit))shares[id]+=amt;
 const serviceBy=Object.fromEntries(s.people.map(p=>[p.id,p.service?Math.round(shares[p.id]/10):0]));
 const subtotal=Object.values(shares).reduce((a,b)=>a+b,0), service=Object.values(serviceBy).reduce((a,b)=>a+b,0);
 const paid=s.payments.filter(p=>p.status==='confirmed').reduce((a,p)=>a+p.amount,0);
 const balance=subtotal+service-paid;
 const individually=Object.fromEntries(s.people.map(p=>[p.id,Math.max(0,shares[p.id]+serviceBy[p.id]-s.payments.filter(x=>x.status==='confirmed'&&x.person===p.id).reduce((a,x)=>a+x.amount,0))]));
 const peopleToSplit=s.mode==='todos'?s.people:s.people.filter(p=>p.present);
 const candidate=peopleToSplit.slice(0,s.count).map(p=>p.id);
 while(candidate.length<s.count)candidate.push('Convidado '+(candidate.length+1));
 return {table:s.table,restaurant:s.name,closed:s.closed,people:s.people,items:s.items,payments:s.payments,disputes:s.disputes,mode:s.mode,count:s.count,subtotal,service,paid,balance,shares,individually,rateio:splitAmount(Math.max(0,balance),candidate),at:now(),expires:s.expires};
}
function getSession(token){const s=store.get(token);if(!s||Date.now()>s.expires)throw Object.assign(new Error('Sessão não encontrada ou expirada'),{http:404});return s;}
function broadcast(s){for(const res of streams.get(s.viewToken)||[]){try{res.write('event: change\ndata: {}\n\n')}catch{}}}
function reply(res,code,payload,headers={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(payload));}
function safe(res,e){reply(res,e.http||400,{error:e.message||'Falha'});}
function body(req){return new Promise((resolve,reject)=>{let data='';req.on('data',c=>{data+=c;if(data.length>22000){reject(Object.assign(new Error('Pedido muito grande'),{http:413}));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(data||'{}'))}catch{reject(new Error('JSON inválido'))}});req.on('error',reject)});}
function staff(req,s){if(req.headers['x-honesto-staff']!==s.staffToken)throw Object.assign(new Error('Ação exclusiva do caixa na demonstração'),{http:403});}
function existingPerson(s,id){if(!id)return null;const p=s.people.find(x=>x.id===id);if(!p)throw new Error('Participante inválido');return p;}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&u.pathname==='/health')return reply(res,200,{ok:true,mode:'homologacao-demo',payments:'disabled'});
  if(req.method==='GET'&&u.pathname==='/'){
   const b=fs.readFileSync(path.join(__dirname,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(b);
  }
  if(req.method==='GET'&&u.pathname==='/api/demo'){const s=newDemo();return reply(res,200,{token:s.viewToken,staff:s.staffToken,expires:s.expires});}
  if(req.method==='GET'&&u.pathname.startsWith('/api/session/'))return reply(res,200,snapshot(getSession(u.pathname.slice(13))));
  if(req.method==='GET'&&u.pathname.startsWith('/api/events/')){
   const s=getSession(u.pathname.slice(12));res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
   res.write('event: connected\ndata: {}\n\n');let set=streams.get(s.viewToken);if(!set){set=new Set();streams.set(s.viewToken,set)}set.add(res);req.on('close',()=>set.delete(res));return;
  }
  if(req.method!=='POST'||!u.pathname.startsWith('/api/'))return reply(res,404,{error:'Não encontrado'});
  const x=await body(req);const s=getSession(String(x.token||''));if(s.closed)throw new Error('Comanda encerrada');
  const pos=u.pathname.startsWith('/api/pdv/');if(pos)staff(req,s);
  if(u.pathname==='/api/pdv/item'){
   const name=String(x.name||'').trim(),qty=Number(x.qty),unit=money(x.price);
   if(name.length<2||name.length>90||!Number.isInteger(qty)||qty<1||qty>50)throw new Error('Produto ou quantidade inválidos');
   const person=existingPerson(s,x.person)?.id||null;
   s.items.push({id:rand(),name,qty,unit,person,active:true,at:now()});
  }else if(u.pathname==='/api/pdv/cancel'){
   const item=s.items.find(i=>i.id===x.id);if(!item||!item.active)throw new Error('Item não encontrado');item.active=false;
   if(snapshot(s).balance<0){item.active=true;throw new Error('Pagamento já excede o novo saldo; estorno necessário');}
  }else if(u.pathname==='/api/pdv/payment'){
   const amount=money(x.amount),person=existingPerson(s,x.person);
   if(amount>snapshot(s).balance)throw new Error('Pagamento maior que o saldo');
   if(!['pix','cartao','dinheiro'].includes(x.method))throw new Error('Forma de pagamento inválida');
   s.payments.push({id:rand(),person:person?.id||null,amount,method:x.method,status:'confirmed',at:now()});
   if(person&&x.leaves){person.present=false;s.count=Math.max(1,s.count-1);}
  }else if(u.pathname==='/api/client/service'){
   const p=existingPerson(s,x.person);if(!p)throw new Error('Participante obrigatório');
   const previous=p.service;p.service=Boolean(x.enabled);if(snapshot(s).balance<0){p.service=previous;throw new Error('Serviço já coberto por pagamento confirmado');}
  }else if(u.pathname==='/api/client/contest'){
   const item=s.items.find(i=>i.id===x.id),reason=String(x.reason||'').trim();
   if(!item||reason.length<5||reason.length>220)throw new Error('Contestação inválida');
   s.disputes.push({id:rand(),item:item.id,reason,status:'pendente',at:now()});
  }else if(u.pathname==='/api/client/split'){
   if(!['restante','todos','individual'].includes(x.mode)||!Number.isInteger(x.count)||x.count<1||x.count>30)throw new Error('Divisão inválida');
   s.mode=x.mode;s.count=x.count;
  }else if(u.pathname==='/api/client/assign'){
   const item=s.items.find(i=>i.id===x.id&&i.active);if(!item)throw new Error('Produto não encontrado');
   const next=existingPerson(s,x.person)?.id||null,old=item.person;item.person=next;
   if(snapshot(s).balance<0){item.person=old;throw new Error('Pagamentos impedem esta alteração');}
  }else return reply(res,404,{error:'Operação não encontrada'});
  s.events.push({at:now(),path:u.pathname});broadcast(s);return reply(res,200,{ok:true,...(u.pathname==='/api/pdv/payment'?{confirmed:true}:{})});
 }catch(e){safe(res,e)}
});
server.listen(PORT,'0.0.0.0',()=>console.log('HONESTO DEMO escutando na porta',PORT));
setInterval(()=>{for(const [key,s] of store)if(Date.now()>s.expires){store.delete(key);streams.delete(key)}},30*60_000).unref();
