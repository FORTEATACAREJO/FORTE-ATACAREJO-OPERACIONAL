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
import { spawn } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||10000);
const store=new Map();
const restaurants=new Map();
const streams=new Map();
const mk=()=>crypto.randomBytes(24).toString('base64url');
const rand=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
function recordEvent(s,type,detail,amount=null,reference=null){
 const event={id:rand(),at:now(),type,detail};
 if(amount!==null)event.amount=amount;
 if(reference!==null)event.reference=reference;
 s.events.push(event);return event;
}

function validTable(raw){
 const value=String(raw??'').trim();
 if(!/^[A-Za-z0-9]{1,6}$/.test(value))throw new Error('Número da mesa inválido (1 a 6 caracteres)');
 return value.toUpperCase();
}
function newDemo(tableNo='12',seed=true,venue=null){
 const established=venue||{id:mk(),name:'Restaurante Exemplo',staffToken:mk(),tables:new Map()};
 if(!venue)restaurants.set(established.id,established);
 const number=validTable(tableNo),table='Mesa '+number;
 const s={id:rand(),viewToken:mk(),staffToken:established.staffToken,establishmentId:established.id,name:established.name,tableNumber:number,table,createdAt:now(),expires:Date.now()+3*3600_000,closed:false,settledAt:null,mode:'restante',count:seed?4:1,
 people:(seed?['Ana','Bruno','Carla','Diego']:[]).map((name)=>({id:rand(),name,present:true,service:false,table})),items:[],payments:[],disputes:[],events:[],transfers:[],

 // In the public demonstration this represents the restaurant POS menu and its optional receive-orders feature.
 orderingEnabled:true,menu:[{id:'chope300',name:'Chope 300 ml',unit:1400},{id:'chope500',name:'Chope 500 ml',unit:2100},{id:'agua',name:'Água mineral',unit:600},{id:'refri',name:'Refrigerante',unit:800},{id:'batata',name:'Batata frita',unit:3800}],orders:[],memberTokens:new Map()};
 const add=(name,qty,price,person)=>{const i={id:rand(),name,qty,unit:price,person:person===null?null:s.people[person].id,active:true,at:now(),cancelledAt:null};s.items.push(i);recordEvent(s,'item','Lançado: '+qty+' × '+name,qty*price,i.id);};
 add('Cerveja',2,1200,0);add('Batata frita',1,3800,null);add('Refrigerante',2,800,2);add('Hambúrguer',1,3500,1);
 established.tables.set(number,s.viewToken);store.set(s.viewToken,s);return s;
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
 return {table:s.table,originalTable:s.table,establishmentId:s.establishmentId,restaurant:s.name,createdAt:s.createdAt,closed:s.closed,settledAt:s.settledAt,transfers:s.transfers,timeline:[...s.events].sort((a,b)=>a.at.localeCompare(b.at)),people:s.people,items:s.items,payments:s.payments,disputes:s.disputes,orders:s.orders,menu:s.menu,orderingEnabled:s.orderingEnabled,mode:s.mode,count:s.count,subtotal,service,paid,balance,shares,individually,rateio:splitAmount(Math.max(0,balance),candidate),at:now(),expires:s.expires};
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
  if(req.method==='GET'&&['/icon-192.png','/icon-512.png'].includes(u.pathname)){
   const size=u.pathname==='/icon-192.png'?192:512;
   const b=Buffer.from(fs.readFileSync(path.join(__dirname,'assets','icon-'+size+'.png.base64'),'utf8').trim(),'base64');
   res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});return res.end(b);
  }
  if(req.method==='GET'&&['/manifest.webmanifest','/sw.js','/icon.svg','/vendor/qrcode.js'].includes(u.pathname)){
   const map={'/manifest.webmanifest':['manifest.webmanifest','application/manifest+json'],'/sw.js':['sw.js','text/javascript; charset=utf-8'],'/icon.svg':['icon.svg','image/svg+xml'],'/vendor/qrcode.js':['vendor/qrcode.js','text/javascript; charset=utf-8']};
   const [filename,type]=map[u.pathname];const b=fs.readFileSync(path.join(__dirname,filename));
   res.writeHead(200,{'Content-Type':type,'Cache-Control':filename==='sw.js'?'no-cache':'public, max-age=3600'});return res.end(b);
  }
  if(req.method==='GET'&&u.pathname==='/'){
   const b=fs.readFileSync(path.join(__dirname,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(b);
  }
  if(req.method==='GET'&&u.pathname==='/api/demo'){const s=newDemo();return reply(res,200,{token:s.viewToken,staff:s.staffToken,establishmentId:s.establishmentId,table:s.table,expires:s.expires});}
  if(req.method==='POST'&&u.pathname==='/api/table/enter'){
   const x=await body(req);
   const venue=restaurants.get(String(x.establishmentId||''));
   if(!venue)throw Object.assign(new Error('Estabelecimento de demonstração não encontrado ou expirado'),{http:404});
   const number=validTable(x.table),old=venue.tables.get(number);
   let s=old?store.get(old):null;
   if(!s||Date.now()>s.expires||s.closed)s=newDemo(number,false,venue);
   return reply(res,200,{token:s.viewToken,establishmentId:venue.id,table:s.table,expires:s.expires});
  }
  if(req.method==='GET'&&u.pathname.startsWith('/api/session/')){
   const s=getSession(u.pathname.slice(13));
   const member=s.memberTokens.get(String(u.searchParams.get('memberToken')||''));
   const p=s.people.find(p=>p.id===member);
   return reply(res,200,{...snapshot(s),table:p?.table||s.table,personalTable:p?.table||null});
  }
  if(req.method==='GET'&&u.pathname.startsWith('/api/events/')){
   const s=getSession(u.pathname.slice(12));res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
   res.write('event: connected\ndata: {}\n\n');let set=streams.get(s.viewToken);if(!set){set=new Set();streams.set(s.viewToken,set)}set.add(res);req.on('close',()=>set.delete(res));return;
  }
  if(req.method!=='POST'||!u.pathname.startsWith('/api/'))return reply(res,404,{error:'Não encontrado'});
  const x=await body(req);const s=getSession(String(x.token||''));if(s.closed)throw Object.assign(new Error('Comanda quitada e encerrada pelo sistema do restaurante'),{http:409});
  const pos=u.pathname.startsWith('/api/pdv/');if(pos)staff(req,s);
  if(u.pathname==='/api/client/join'){
   // In the demonstration, the name is the only information asked from the customer.
   const previous=String(x.memberToken||'');
   const existing=s.memberTokens.get(previous);
   if(existing)return reply(res,200,{ok:true,memberToken:previous,person:existing,returning:true});
   const name=String(x.name||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,40);
   if(name.length<2||name.length>40)throw new Error('Informe apenas seu primeiro nome');
   if(s.people.length>=30)throw Object.assign(new Error('Limite de pessoas nesta mesa demonstrativa'),{http:429});
   const person={id:rand(),name,present:true,service:false,table:s.table};
   const memberToken=mk();s.people.push(person);s.memberTokens.set(memberToken,person.id);
   s.count=Math.max(s.count,s.people.filter(p=>p.present).length);
   recordEvent(s,'entrada','Participante entrou: '+name,null,person.id);
   broadcast(s);return reply(res,201,{ok:true,memberToken,person:person.id});
  }
  const verifyMember=(expectedPerson,requirePresent=false)=>{
   const id=s.memberTokens.get(String(x.memberToken||''));
   if(!id||!s.people.some(p=>p.id===id&&(!requirePresent||p.present)))throw Object.assign(new Error('Entre com seu nome para acessar esta funcionalidade'),{http:403});
   if(expectedPerson&&expectedPerson!==id)throw Object.assign(new Error('Não é possível agir por outra pessoa'),{http:403});
   return id;
  };
  if(u.pathname==='/api/client/order'){
   // A request is NOT an invoiceable item until the simulated POS confirms it.
   if(!s.orderingEnabled)throw Object.assign(new Error('Este restaurante não habilitou pedidos pelo HONESTO'),{http:403});
   const memberId=verifyMember(x.person,true);
   const person=existingPerson(s,memberId);
   if(!person||!person.present)throw new Error('Participante não encontrado na mesa');
   const product=s.menu.find(m=>m.id===x.menuId),qty=Number(x.qty);
   const note=String(x.note||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,180);
   const requestId=String(x.requestId||'');
   if(!product||!Number.isInteger(qty)||qty<1||qty>10||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId))throw new Error('Pedido inválido');
   const previous=s.orders.find(o=>o.requestId===requestId);
   if(previous){if(previous.person!==person.id)throw Object.assign(new Error('ID de solicitação pertence a outro cliente'),{http:409});return reply(res,200,{ok:true,duplicate:true,orderId:previous.id});}
   if(s.orders.length>=50)throw Object.assign(new Error('Limite de pedidos da sessão de teste atingido'),{http:429});
   const requested={id:rand(),requestId,person:person.id,menuId:product.id,name:product.name,qty,unit:product.unit,note,table:person.table||s.table,status:'solicitado',itemId:null,createdAt:now(),updatedAt:now(),statusHistory:[{status:'solicitado',at:now()}]};
   s.orders.push(requested);
   recordEvent(s,'pedido','Solicitado: '+qty+' × '+product.name+' · '+person.name,null,requested.id);broadcast(s);
   return reply(res,201,{ok:true,orderId:requested.id,status:'solicitado'});
  }else if(u.pathname==='/api/pdv/order-status'){
   const order=s.orders.find(o=>o.id===x.id);
   if(!order)throw new Error('Solicitação não encontrada');
   const next=String(x.status||'');
   if(next===order.status)return reply(res,200,{ok:true,duplicate:true,status:order.status});
   if(order.status==='solicitado'&&next==='recusado'){
    order.status='recusado';
   }else if(order.status==='solicitado'&&next==='aceito'){
    // Only POS acknowledgement creates the bill item. Repeating the acknowledgement never bills twice.
    const item={id:rand(),name:order.name,qty:order.qty,unit:order.unit,person:order.person,active:true,at:now(),cancelledAt:null,fromOrder:order.id};
    s.items.push(item);order.itemId=item.id;order.status='aceito';recordEvent(s,'item','Lançado pelo PDV: '+order.qty+' × '+order.name,order.qty*order.unit,item.id);
   }else if(order.status==='aceito'&&next==='entregue'){
    order.status='entregue';
   }else throw new Error('Transição de status inválida');
   order.updatedAt=now();order.statusHistory.push({status:order.status,at:order.updatedAt});
   recordEvent(s,'pedido',order.status==='aceito'?'Pedido aceito no PDV: '+order.name:order.status==='entregue'?'Pedido entregue: '+order.name:'Pedido recusado: '+order.name,null,order.id);
  }else if(u.pathname==='/api/client/transfer-request'){
   const memberId=verifyMember(null,true),person=existingPerson(s,memberId);
   const target=validTable(x.newTable);
   if(target===(person.table||s.table).replace(/^Mesa /,''))throw new Error('Informe uma mesa diferente da atual');
   if(s.transfers.some(t=>t.person===memberId&&t.status==='pendente'))throw Object.assign(new Error('Você já tem uma troca aguardando confirmação'),{http:409});
   const tr={id:rand(),person:memberId,from:person.table||s.table,to:'Mesa '+target,status:'pendente',requestedAt:now(),confirmedAt:null};
   s.transfers.push(tr);recordEvent(s,'mesa','Troca de mesa solicitada: '+tr.from+' → '+tr.to,null,tr.id);broadcast(s);
   return reply(res,201,{ok:true,transferId:tr.id,status:'pendente'});
  }else if(u.pathname==='/api/pdv/transfer-status'){
   const tr=s.transfers.find(t=>t.id===String(x.id||''));
   if(!tr)throw new Error('Solicitação de troca não encontrada');
   const next=String(x.status||'');
   if(next===tr.status)return reply(res,200,{ok:true,duplicate:true,status:tr.status});
   if(tr.status!=='pendente'||!['aprovada','recusada'].includes(next))throw new Error('Transição de troca inválida');
   const person=existingPerson(s,tr.person);
   if(next==='aprovada'&&person){person.table=tr.to;}
   tr.status=next;tr.confirmedAt=now();recordEvent(s,'mesa',next==='aprovada'?'Troca de mesa confirmada: '+tr.from+' → '+tr.to:'Troca de mesa recusada: '+tr.from+' → '+tr.to,null,tr.id);
  }else if(u.pathname==='/api/pdv/settle'){
   // No participant can mark the comanda as paid; only the simulated POS may settle it.
   if(snapshot(s).balance!==0)throw Object.assign(new Error('Saldo pendente. Não é possível quitar a comanda.'),{http:409});
   if(s.orders.some(o=>o.status==='solicitado')||s.transfers.some(t=>t.status==='pendente'))throw Object.assign(new Error('Há pedidos ou trocas pendentes'),{http:409});
   s.closed=true;s.settledAt=now();recordEvent(s,'quitacao','Conta integralmente quitada e encerrada no PDV');
   const venue=restaurants.get(s.establishmentId);
   if(venue)for(const [table,token] of venue.tables)if(token===s.viewToken)venue.tables.delete(table);
  }else if(u.pathname==='/api/pdv/order-settings'){
   if(typeof x.enabled!=='boolean')throw new Error('Configuração inválida');
   s.orderingEnabled=x.enabled;recordEvent(s,'configuracao',x.enabled?'Solicitações pelo HONESTO habilitadas':'Solicitações pelo HONESTO desabilitadas');
  }else if(u.pathname==='/api/pdv/item'){
   const name=String(x.name||'').trim(),qty=Number(x.qty),unit=money(x.price);
   if(name.length<2||name.length>90||!Number.isInteger(qty)||qty<1||qty>50)throw new Error('Produto ou quantidade inválidos');
   const person=existingPerson(s,x.person)?.id||null;
   const i={id:rand(),name,qty,unit,person,active:true,at:now(),cancelledAt:null};s.items.push(i);recordEvent(s,'item','Lançado no PDV: '+qty+' × '+name,qty*unit,i.id);
  }else if(u.pathname==='/api/pdv/cancel'){
   const item=s.items.find(i=>i.id===x.id);if(!item||!item.active)throw new Error('Item não encontrado');item.active=false;
   if(snapshot(s).balance<0){item.active=true;throw new Error('Pagamento já excede o novo saldo; estorno necessário');}
   item.cancelledAt=now();recordEvent(s,'cancelamento','Cancelado: '+item.qty+' × '+item.name,-item.qty*item.unit,item.id);
  }else if(u.pathname==='/api/pdv/payment'){
   const amount=money(x.amount),person=existingPerson(s,x.person);
   if(amount>snapshot(s).balance)throw new Error('Pagamento maior que o saldo');
   if(!['pix','cartao','dinheiro'].includes(x.method))throw new Error('Forma de pagamento inválida');
   const payment={id:rand(),person:person?.id||null,amount,method:x.method,status:'confirmed',at:now()};s.payments.push(payment);recordEvent(s,'pagamento','Pagamento confirmado no caixa · '+x.method+(person?' · '+person.name:''),-amount,payment.id);
   if(person&&x.leaves){person.present=false;s.count=Math.max(1,s.count-1);}
  }else if(u.pathname==='/api/client/service'){
   verifyMember(x.person,true);
   const p=existingPerson(s,x.person);if(!p)throw new Error('Participante obrigatório');
   const previous=p.service;p.service=Boolean(x.enabled);if(snapshot(s).balance<0){p.service=previous;throw new Error('Serviço já coberto por pagamento confirmado');}
   recordEvent(s,'servico',(p.service?'Serviço de 10% marcado: ':'Serviço de 10% desmarcado: ')+p.name,null,p.id);
  }else if(u.pathname==='/api/client/contest'){
   verifyMember();
   const item=s.items.find(i=>i.id===x.id),reason=String(x.reason||'').trim();
   if(!item||reason.length<5||reason.length>220)throw new Error('Contestação inválida');
   const dispute={id:rand(),item:item.id,reason,status:'pendente',at:now()};s.disputes.push(dispute);recordEvent(s,'contestacao','Contestação: '+item.name+' — '+reason,null,dispute.id);
  }else if(u.pathname==='/api/client/split'){
   verifyMember(null,true);
   if(!['restante','todos','individual'].includes(x.mode)||!Number.isInteger(x.count)||x.count<1||x.count>30)throw new Error('Divisão inválida');
   s.mode=x.mode;s.count=x.count;recordEvent(s,'divisao','Divisão atualizada: '+x.mode+' · '+x.count+' pessoas');
  }else if(u.pathname==='/api/client/assign'){
   verifyMember(x.person,true);
   const item=s.items.find(i=>i.id===x.id&&i.active);if(!item)throw new Error('Produto não encontrado');
   const next=existingPerson(s,x.person)?.id||null,old=item.person;item.person=next;
   if(snapshot(s).balance<0){item.person=old;throw new Error('Pagamentos impedem esta alteração');}
   recordEvent(s,'atribuicao','Consumo de '+item.name+' atribuído a '+(existingPerson(s,next)?.name||'Compartilhado'),null,item.id);
  }else return reply(res,404,{error:'Operação não encontrada'});
  broadcast(s);return reply(res,200,{ok:true,...(u.pathname==='/api/pdv/payment'?{confirmed:true}:{})});
 }catch(e){safe(res,e)}
});
server.listen(PORT,'0.0.0.0',()=>{
 console.log('HONESTO DEMO escutando na porta',PORT);
 // Homologação somente: executar teste real HTTP após cada inicialização.
 // Processo de teste isolado, sem tocar em clientes e sessões desta instância.
 if(process.env.HONESTO_SKIP_SMOKE!=='1'){
  const smoke=spawn(process.execPath,[path.join(__dirname,'tests','smoke.mjs')],{cwd:__dirname,stdio:['ignore','pipe','pipe']});
  smoke.stdout.on('data',b=>console.log('[HONESTO TESTE]',String(b).trim()));
  smoke.stderr.on('data',b=>console.error('[HONESTO TESTE]',String(b).trim()));
  smoke.on('close',code=>console.log('[HONESTO TESTE]',code===0?'APROVADO':'FALHOU (código '+code+')'));
 }
});
setInterval(()=>{
 for(const [key,s] of store)if(Date.now()>s.expires){store.delete(key);streams.delete(key);}
 for(const [id,venue] of restaurants){for(const [table,key] of venue.tables)if(!store.has(key))venue.tables.delete(table);if(venue.tables.size===0)restaurants.delete(id)}
},30*60_000).unref();
