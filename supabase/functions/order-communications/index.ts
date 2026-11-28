import {autoReception} from './auto-reception.mjs';
import {profileActive,isMaster,getAttendanceGrant,manageAttendance} from './attendance-access.mjs';
import {PDFDocument} from 'npm:pdf-lib@1.17.1';
import {internalSnapshot,buildInternalDocument} from './internal-dossier.mjs';
import {captureInbox,inboxRowFor,persistInbox} from './inbox-store.mjs';
import {inboxAction} from './inbox-actions.mjs';
import {purchaseDocument} from './order-document.mjs';
import {readBusiness,requireDocumentTemplate} from './business.mjs';
import {driverDispatchCheck,recordDriverDispatch} from '../orders-workflow/driver-dispatch.mjs';
import {supplierDispatchCapacity} from '../orders-workflow/capacity.mjs';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {jsPDF} from 'npm:jspdf@3.0.2';
import {hostingerMailbox,sendSupplierEmailHostinger} from './hostinger-mail.mjs';
import {templatePayload,validSignature,applyStatuses} from './provider.mjs';
import {CUSTOMER_AUTOMATIC_MESSAGES_ENABLED,linkedReturn,deliveryReply,phone} from '../orders-workflow/communications.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Content-Type':'application/json'};
const env=(key:string)=>Deno.env.get(key)||'';
const admin=()=>createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
async function rowFor(db:any,empresa:string){const {data,error}=await db.from('fc_app_state').select('estado,versao').eq('empresa_id',empresa).single();if(error||!data)throw new Error('Base indisponível.');return data;}
async function persist(db:any,empresa:string,row:any){const {data,error}=await db.from('fc_app_state').update({estado:row.estado,versao:row.versao+1}).eq('empresa_id',empresa).eq('versao',row.versao).select('versao');if(error||data?.length!==1)throw new Error('Conflito de versão; atualize os dados.');row.versao++;}
// Reconfere a vinculação no banco antes de transmitir a ordem ao motorista.
// A retirada não pode usar veículo desvinculado depois da conferência.
async function verifyDriverVehicleLink(db:any,empresa:string,load:any){
 if(!load?.vinculoFrotaId)return; // Ordens legadas seguem seu bloqueio documental existente.
 const {data:link,error:linkError}=await db.from('fc_frota_vinculos')
  .select('id,veiculo_id,motorista_operacional_id,fim_em')
  .eq('empresa_id',empresa).eq('id',load.vinculoFrotaId).maybeSingle();
 if(linkError||!link||link.fim_em||String(link.motorista_operacional_id)!==String(load.motoristaId)
   ||String(link.veiculo_id)!==String(load.veiculoId))
  throw new Error('Vínculo motorista/veículo não está ativo. Revise a ordem antes do envio.');
 const {data:vehicle,error:vehicleError}=await db.from('fc_veiculos')
  .select('id,placa,ativo').eq('empresa_id',empresa).eq('id',link.veiculo_id).maybeSingle();
 const normalizePlate=x=>String(x||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
 if(vehicleError||!vehicle||vehicle.ativo===false||normalizePlate(vehicle.placa)!==normalizePlate(load.placas?.[0]))
  throw new Error('A placa do vínculo não confere com a ordem revisada. Confira a carga.');
}
function supplierPDF(j:any){return new Uint8Array(purchaseDocument(jsPDF,j.order,j.audience==='MOTORISTA').output('arraybuffer'));}
async function sendJob(j:any,business?:any,template?:string){
 if(j.canal==='EMAIL'&&j.audience==='FORNECEDOR'){
  return await sendSupplierEmailHostinger(env('FORTE_ATENDE_HOSTINGER_MAIL_TOKEN'),j,supplierPDF(j));
 }
 if(j.canal==='EMAIL'){
  const key=env('RESEND_API_KEY'),from=env('ORDERS_EMAIL_FROM');if(!key||!from)throw new Error('E-MAIL DE ENVIO NÃO CONFIGURADO');
  const bytes=supplierPDF(j);const content=btoa(Array.from(bytes).map(n=>String.fromCharCode(n)).join(''));
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':j.id},body:JSON.stringify({from,to:[j.to],subject:'Pedido '+j.reference,text:j.message,attachments:[{filename:j.reference+'.pdf',content}]}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('PROVEDOR DE E-MAIL RECUSOU O ENVIO ('+r.status+')');const out=await r.json();if(!out.id)throw new Error('RESULTADO INCERTO');return out.id;
 }
 const {token,phone:number,version}=business||{},name=template||env('WHATSAPP_TEMPLATE_'+j.kind);if(!token||!number||!name)throw new Error('WHATSAPP OU MODELO APROVADO NÃO CONFIGURADO');
 const base='https://graph.facebook.com/'+version+'/'+number;let documentId;
 if(['FORNECEDOR','MOTORISTA'].includes(j.audience)){const form=new FormData();form.set('messaging_product','whatsapp');form.set('file',new Blob([supplierPDF(j)],{type:'application/pdf'}),String(j.reference).replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf');const uploaded=await fetch(base+'/media',{method:'POST',headers:{Authorization:'Bearer '+token},body:form,signal:AbortSignal.timeout(20000)});if(!uploaded.ok)throw new Error('PDF RECUSADO PELO WHATSAPP');documentId=(await uploaded.json()).id;if(!documentId)throw new Error('PDF SEM IDENTIFICAÇÃO');}
 let r;try{r=await fetch(base+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(templatePayload(j,name,documentId)),signal:AbortSignal.timeout(20000)});}catch{throw Object.assign(new Error('Resultado do envio não confirmado. Confira antes de reenviar.'),{uncertain:true});}
 if(!r.ok)throw new Error('PROVEDOR WHATSAPP RECUSOU O ENVIO ('+r.status+')');let out;try{out=await r.json();}catch{throw Object.assign(new Error('Resultado do envio não confirmado.'),{uncertain:true});}const id=out.messages?.[0]?.id;if(!id)throw Object.assign(new Error('RESULTADO INCERTO'),{uncertain:true});return id;
}
// Diagnóstico restrito: só consulta credenciais, nunca envia mensagens.
async function channelStatus(){
   // Leitura de saúde; não envia e-mail, WhatsApp ou pedido a terceiros.
   const email:any={ready:false,address:'contato@forteatacarejo.com.br',detail:'Hostinger não configurada'};
   try{
    await hostingerMailbox(env('FORTE_ATENDE_HOSTINGER_MAIL_TOKEN'));
    email.ready=true;email.detail='Caixa corporativa autorizada na Hostinger';
   }catch(e){email.detail=e instanceof Error?e.message:'Não foi possível conferir a Hostinger';}
   const whatsapp:any={connected:false,fornecedor:{ready:false,detail:'A conferir'},motorista:{ready:false,detail:'A conferir'}};
   try{
    const business=await readBusiness(admin(),env);
    whatsapp.connected=Boolean(business.token&&business.phone&&business.waba);
    for(const [key,kind] of [['fornecedor','FORNECEDOR'],['motorista','ORDEM_MOTORISTA']]){
     try{await requireDocumentTemplate(business,kind,env);whatsapp[key]={ready:true,detail:'Modelo de PDF aprovado e compatível na Meta'};}
     catch(e){whatsapp[key]={ready:false,detail:e instanceof Error?e.message:'Modelo não confirmado'};}
    }
   }catch(e){const detail=e instanceof Error?e.message:'Não foi possível consultar a Meta';whatsapp.fornecedor={ready:false,detail};whatsapp.motorista={ready:false,detail};}
   return {email,whatsapp,checkedAt:new Date().toISOString(),sent:false};
}
async function constantTimeTokenMatch(provided:string,expected:string){
 const input=new TextEncoder();
 const [left,right]=await Promise.all([crypto.subtle.digest('SHA-256',input.encode(provided)),crypto.subtle.digest('SHA-256',input.encode(expected))]);
 const a=new Uint8Array(left),b=new Uint8Array(right);let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  // Acesso servidor-servidor com segredo do worker existente; sem sessão do usuário.
  if(new URL(req.url).pathname.endsWith('/internal-channel-status')){
   if(req.method!=='POST')return Response.json({error:'Método inválido'},{status:405,headers:cors});
   const sent=req.headers.get('X-Forte-Worker')||'';
   const {data:secrets,error:secretError}=await admin().rpc('gmail_hub_secrets_read');
   if(secretError||!secrets?.worker_token||!sent||!await constantTimeTokenMatch(sent,secrets.worker_token))return Response.json({error:'Não autorizado'},{status:403,headers:cors});
   return Response.json(await channelStatus(),{headers:cors});
  }
  const isWebhook=new URL(req.url).pathname.endsWith('/webhook');
  if(isWebhook){
   const webhookDb=admin(),webhookCompany=await webhookDb.from('gmail_hub_config').select('empresa_id').eq('id',true).maybeSingle();const tenant=env('WHATSAPP_TENANT_ID')||webhookCompany.data?.empresa_id,url=new URL(req.url);if(req.method==='GET'){if(env('WHATSAPP_VERIFY_TOKEN')&&url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===env('WHATSAPP_VERIFY_TOKEN'))return new Response(url.searchParams.get('hub.challenge')||'');return new Response('Forbidden',{status:403});}
   if(req.method!=='POST'||!tenant)return new Response('Not configured',{status:503});const raw=await req.text();if(raw.length>1000000)return new Response('Too large',{status:413});if(!await validSignature(raw,req.headers.get('x-hub-signature-256'),env('WHATSAPP_APP_SECRET')))return new Response('Forbidden',{status:403});
   const payload=JSON.parse(raw),db=admin(),webhookBusiness=await readBusiness(db,env);for(let attempt=0;attempt<3;attempt++){const row=await rowFor(db,tenant),s=row.estado,before=JSON.stringify(s);for(const entry of payload.entry||[])for(const change of entry.changes||[]){const v=change.value||{};if(String(v.metadata?.phone_number_id)!==String(webhookBusiness.phone))continue;await captureInbox(db,tenant,v);applyStatuses(s,v.statuses);for(const m of v.messages||[]){const at=new Date(Number(m.timestamp)*1000).toISOString();const args={id:m.id,from:m.from,contextId:m.context?.id,payload:m.button?.payload||m.interactive?.button_reply?.id,at};if(args.payload){const accepted=deliveryReply(s,args);if(!accepted&&!(s.retornosCliente||[]).some((r:any)=>r.providerId===m.id)&&!(s.comunicacoes||[]).some((j:any)=>j.reply?.providerId===m.id)){s.retornosCliente=[...(s.retornosCliente||[]),{providerId:m.id,contextId:m.context?.id,from:phone(m.from),payload:args.payload,at,state:'CONFERIR'}];}}else if(m.text?.body&&(s.fornecedores||[]).some((f:any)=>phone(f.whatsapp||f.telefone)===phone(m.from)))linkedReturn(s,{...args,providerId:m.id,text:m.text.body});}}
    try{if(JSON.stringify(s)!==before)await persist(db,tenant,row);if(typeof EdgeRuntime!=='undefined')EdgeRuntime.waitUntil((async()=>{for(const entry of payload.entry||[])for(const change of entry.changes||[]){const value=change.value||{};if(String(value.metadata?.phone_number_id)!==String(webhookBusiness.phone)||!value.messages?.length)continue;try{await autoReception({db,empresa:tenant,value,env,rowFor:inboxRowFor,persist:persistInbox,readBusiness,operational:s});}catch{console.error('ATENDE_RECEPTION_PENDING');}}})());return new Response('EVENT_RECEIVED');}catch(e){if(attempt===2)throw e;}}
  }
  if(req.method!=='POST')return Response.json({error:'Método inválido'},{status:405,headers:cors});
  const client=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});const {data:{user},error}=await client.auth.getUser();if(error||!user)return Response.json({error:'Entre no sistema.'},{status:401,headers:cors});
  const grant=await client.rpc('access_current_module',{p_app:'vendas'});
  const {data:p}=await client.from('fc_perfis').select('*').eq('user_id',user.id).single();
  if(!profileActive(p))return Response.json({error:'Perfil não aprovado.'},{status:403,headers:cors});
  const body=await req.json();const gmailTenant=await admin().from('gmail_hub_config').select('empresa_id').eq('id',true).maybeSingle();if(p.empresa_id!==env('WHATSAPP_TENANT_ID')&&p.empresa_id!==gmailTenant.data?.empresa_id)return Response.json({error:'Integração de mensagens ainda não configurada para esta empresa.'},{status:409,headers:cors});

  const master=!grant.error&&isMaster(p,grant.data);
  if(String(body.action||'').startsWith('ATENDE_'))return Response.json(await manageAttendance({db:admin(),p,user,master,body,env}),{headers:cors});
  if(String(body.action||'').startsWith('INBOX_')){
   const access=await getAttendanceGrant(admin(),p.empresa_id,user.id);
   if(!master&&!(access?.ativo&&access.whatsapp))return Response.json({error:'Acesso ao FORTE ATENDE não autorizado.'},{status:403,headers:cors});
   if(!master&&(!['INBOX_LIST','INBOX_MESSAGES','INBOX_UPDATE','INBOX_MEDIA','INBOX_REPLY'].includes(body.action)||body.link||body.transferTo!==undefined))return Response.json({error:'Ação exclusiva do MASTER.'},{status:403,headers:cors});
   return Response.json(await inboxAction({body,db:admin(),profile:{...p,perfil:master?'MASTER':'ATENDENTE'},user,env,rowFor:inboxRowFor,persist:persistInbox,readBusiness}),{headers:cors});
  }
  if(grant.error||!grant.data?.allowed)return Response.json({error:'Módulo sem aprovação.'},{status:403,headers:cors});
  p.perfil=grant.data.role;if(!['MASTER','ADMINISTRADOR','OPERADOR_GERAL','VENDEDOR_INTERNO'].includes(p.perfil)||!['MASTER','ADMINISTRADOR'].includes(p.perfil)&&p.permissoes?.vendas!==true&&p.permissoes?.['carga-direta']!==true&&p.permissoes?.['VENDAS E COMPRAS']?.editar!==true)return Response.json({error:'Sem permissão.'},{status:403,headers:cors});
  if(body.action==='CHANNEL_STATUS')return Response.json(await channelStatus(),{headers:cors});
  if(['INTERNAL_RECIPIENTS_GET','INTERNAL_RECIPIENTS_SAVE'].includes(body.action)){
   if(p.perfil!=='MASTER')return Response.json({error:'Configuração exclusiva do MASTER.'},{status:403,headers:cors});
   const db=admin(),latest=await db.from('ft_internal_recipients_history').select('revision,faturamento_whatsapp,fechamento_whatsapp,changed_at').eq('empresa_id',p.empresa_id).order('revision',{ascending:false}).limit(1).maybeSingle();
   if(latest.error)throw Error('Configuração interna indisponível.');
   const current=latest.data;
   if(body.action==='INTERNAL_RECIPIENTS_GET')return Response.json({config:current},{headers:cors});
   const normalize=(v:any)=>{let n=String(v||'').replace(/\D/g,'');if(n.length===11)n='55'+n;if(!/^55[1-9][0-9]9[0-9]{8}$/.test(n))throw Error('Informe celular brasileiro válido com DDD.');return n;};
   const faturamento=normalize(body.faturamento),fechamento=normalize(body.fechamento);
   if(faturamento===fechamento)throw Error('Informe destinatários distintos.');
   if(body.revision!==(current?.revision||0))throw Error('Configuração alterada. Reabra e confira os números.');
   if(current?.faturamento_whatsapp===faturamento&&current?.fechamento_whatsapp===fechamento)return Response.json({config:current},{headers:cors});
   const saved=await db.from('ft_internal_recipients_history').insert({empresa_id:p.empresa_id,revision:(current?.revision||0)+1,faturamento_whatsapp:faturamento,fechamento_whatsapp:fechamento,changed_by:user.id,origin:'MASTER'}).select('revision,faturamento_whatsapp,fechamento_whatsapp,changed_at').single();
   if(saved.error)throw Error('Não foi possível gravar. Reabra a configuração e confira.');
   return Response.json({config:saved.data},{headers:cors});
  }
  if(body.action==='INTERNAL_DOSSIER_SEND'){
   if(p.perfil!=='MASTER')return Response.json({error:'Envio interno restrito ao MASTER.'},{status:403,headers:cors});
   const role=String(body.role||''),db=admin();
   if(!['PEDRO','JULIANA'].includes(role))throw Error('Destinatário interno inválido.');
   const readRecipients=async()=>{const r=await db.from('ft_internal_recipients_history').select('revision,faturamento_whatsapp,fechamento_whatsapp').eq('empresa_id',p.empresa_id).order('revision',{ascending:false}).limit(1).maybeSingle();if(r.error||!r.data)throw Error('Cadastre os destinatários internos nas configurações.');return r.data;};
   const config=await readRecipients(),to=role==='PEDRO'?config.fechamento_whatsapp:config.faturamento_whatsapp;
   if(!/^55[1-9][0-9]9[0-9]{8}$/.test(to))throw Error('Destinatário interno inválido.');
   const row=await rowFor(db,p.empresa_id),snapshot=internalSnapshot(row.estado,String(body.cargaId||''),role);
   if(!snapshot.os)throw Error('OS não vinculada.');
   if(!env('WHATSAPP_TEMPLATE_INTERNAL_DOSSIER'))throw Error('Modelo interno de PDF não configurado.');
   const business=await readBusiness(db,env),template=await requireDocumentTemplate(business,'INTERNAL_DOSSIER',env);
   const digest=async (bytes:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
   const version=await digest(new TextEncoder().encode(JSON.stringify([role,to,snapshot])));
   const id='INTERNAL_DOSSIER:'+snapshot.c.id+':'+version;
   row.estado.comunicacoes??=[];
   const prior=row.estado.comunicacoes.find((j:any)=>j.id===id);
   if(prior)return Response.json({state:prior.state,providerId:prior.providerId,reason:prior.reason,message:'Esta versão já possui registro de envio. Confira o histórico.'},{headers:cors});
   const bytes=await buildInternalDocument(snapshot,role,jsPDF,PDFDocument,async (doc:any)=>{
    if(doc.gmailSourceId){
     if(doc.storageBucket!=='forte-gmail-central')throw Error('Origem Gmail inválida.');
     const source=await db.from('gmail_hub_sources').select('file_id').eq('empresa_id',p.empresa_id).eq('id',doc.gmailSourceId).eq('allowed',true).single();
     if(source.error||!source.data)throw Error('Origem do documento indisponível.');
     const stored=await db.from('gmail_hub_files').select('hash,storage_path').eq('empresa_id',p.empresa_id).eq('id',source.data.file_id).single();
     if(stored.error||stored.data?.hash!==doc.hash||stored.data?.storage_path!==doc.storagePath)throw Error('Documento não confere com a origem.');
    }else if(doc.storageBucket!=='forte-vendas-dossies'||!String(doc.storagePath||'').startsWith(p.empresa_id+'/'))throw Error('Arquivo não autorizado.');
    const {data:blob,error}=await db.storage.from(doc.storageBucket).download(doc.storagePath);
    if(error||!blob)throw Error('Documento original indisponível.');
    const data=new Uint8Array(await blob.arrayBuffer());if(!doc.hash||await digest(data)!==doc.hash)throw Error('Integridade do documento não conferida.');
    return data;
   });
   const job={id,key:id,kind:'INTERNAL_DOSSIER',audience:'INTERNO',canal:'WHATSAPP',to,cargaId:snapshot.c.id,reference:snapshot.os,recipientRole:role,state:'SENDING',createdAt:new Date().toISOString(),attemptAt:new Date().toISOString(),message:'Dossiê interno para '+role+' • '+snapshot.os};
   if((await readRecipients()).revision!==config.revision)throw Error('Destinatário alterado. Confira e envie novamente.');
   row.estado.comunicacoes.push(job);await persist(db,p.empresa_id,row);
   let providerId='',failure='',state='FAILED',submitted=false;
   try{
    const filename=snapshot.os.replace(/[^A-Za-z0-9_-]/g,'_')+'-'+role+'-DOSSIE.pdf',base='https://graph.facebook.com/'+business.version+'/'+business.phone;
    const form=new FormData();form.set('messaging_product','whatsapp');form.set('file',new Blob([bytes],{type:'application/pdf'}),filename);
    const upload=await fetch(base+'/media',{method:'POST',headers:{Authorization:'Bearer '+business.token},body:form,signal:AbortSignal.timeout(20000)});
    if(!upload.ok)throw Error('PDF recusado pelo WhatsApp.');
    const media=(await upload.json()).id;if(!media)throw Error('PDF sem identificação.');
    submitted=true;
    const response=await fetch(base+'/messages',{method:'POST',headers:{Authorization:'Bearer '+business.token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'template',template:{name:template,language:{code:'pt_BR'},components:[{type:'header',parameters:[{type:'document',document:{id:media,filename}}]},{type:'body',parameters:[{type:'text',text:snapshot.os},{type:'text',text:role}]}]}}),signal:AbortSignal.timeout(20000)});
    if(!response.ok){submitted=false;throw Error('WhatsApp recusou o envio ('+response.status+').');}
    providerId=(await response.json()).messages?.[0]?.id;if(!providerId)throw Error('Resultado não confirmado.');
    state='SENT';
   }catch(e){failure=e.message;state=submitted?'UNCERTAIN':'FAILED';}
   for(let attempt=0;attempt<3;attempt++){
    const latest=await rowFor(db,p.empresa_id),current=latest.estado.comunicacoes.find((j:any)=>j.id===id);
    if(!current)throw Error('Histórico não localizado; confira antes de reenviar.');
    Object.assign(current,{state,providerId,reason:failure,sentAt:providerId?new Date().toISOString():null});
    try{await persist(db,p.empresa_id,latest);break;}catch(e){if(attempt===2)throw e;}
   }
   return Response.json({state,providerId,reason:failure,message:providerId?'PDF aceito pelo WhatsApp Business; entrega ainda não confirmada.':failure||'Envio não confirmado.'},{headers:cors});
  }

  if(body.action!=='DISPATCH')throw new Error('Ação inválida.');
  const db=admin();let sent=0,blocked=0;const outcomes=[];let business;const getBusiness=async()=>business??=(await readBusiness(db,env));const initial=await rowFor(db,p.empresa_id);const ids=(initial.estado.comunicacoes||[]).filter((j:any)=>j.audience!=='INTERNO'&&(!body.jobId||j.id===body.jobId)&&(j.state==='QUEUED'||j.state==='BLOCKED'||!!body.jobId&&j.state==='FAILED')).slice(0,10).map((j:any)=>j.id);
  if(body.jobId&&!ids.length){const known=(initial.estado.comunicacoes||[]).find(j=>j.id===body.jobId);if(!known)throw Error('Envio não localizado nesta empresa.');outcomes.push({id:known.id,state:known.state,reason:known.reason||(['SENDING','UNCERTAIN'].includes(known.state)?'Resultado em processamento ou incerto. Confira antes de reenviar.':''),providerId:known.providerId});}
  for(const id of ids){const row=await rowFor(db,p.empresa_id),j=row.estado.comunicacoes.find((j:any)=>j.id===id);if(!j||!['QUEUED','BLOCKED',...(body.jobId?['FAILED']:[])].includes(j.state))continue;const customer=row.estado.clientes?.find((c:any)=>c.id===j.clienteId);if(j.audience==='CLIENTE'&&!CUSTOMER_AUTOMATIC_MESSAGES_ENABLED){j.state='CANCELLED';j.reason='ENVIOS AUTOMÁTICOS AO CLIENTE DESATIVADOS — USO INTERNO';j.cancelledAt=new Date().toISOString();await persist(db,p.empresa_id,row);outcomes.push({id:j.id,state:j.state,reason:j.reason});continue;}if(j.audience==='CLIENTE'&&customer?.whatsappAutorizado!==true){j.state='BLOCKED';j.reason='AUTORIZAÇÃO DO CLIENTE PENDENTE';await persist(db,p.empresa_id,row);blocked++;continue;}
   if(j.audience==='FORNECEDOR'){try{supplierDispatchCapacity(row.estado,j);}catch(e){j.state='BLOCKED';j.reason='CAPACIDADE: '+e.message;await persist(db,p.empresa_id,row);blocked++;outcomes.push({id:j.id,state:j.state,reason:j.reason});continue;}}
   if(j.audience==='MOTORISTA'){try{driverDispatchCheck(row.estado,j);await verifyDriverVehicleLink(db,p.empresa_id,(row.estado.cargas||[]).find((c:any)=>c.id===j.cargaId));}catch(e){j.state='BLOCKED';j.reason=e.message;await persist(db,p.empresa_id,row);blocked++;outcomes.push({id:j.id,state:j.state,reason:j.reason});continue;}}
   const permittedTenant=j.canal==='EMAIL'&&j.audience==='FORNECEDOR'?p.empresa_id===gmailTenant.data?.empresa_id:(p.empresa_id===env('WHATSAPP_TENANT_ID')||p.empresa_id===gmailTenant.data?.empresa_id);const configured=permittedTenant&&(j.canal==='EMAIL'?j.audience==='FORNECEDOR'?Boolean(env('FORTE_ATENDE_HOSTINGER_MAIL_TOKEN')):env('RESEND_API_KEY')&&env('ORDERS_EMAIL_FROM'):(await getBusiness()).token&&(await getBusiness()).phone);if(!configured){j.state='BLOCKED';j.reason='INTEGRAÇÃO NÃO CONFIGURADA';await persist(db,p.empresa_id,row);blocked++;outcomes.push({id:j.id,state:j.state,reason:j.reason});continue;}
   let template;if(j.canal==='WHATSAPP'&&['FORNECEDOR','MOTORISTA'].includes(j.audience)){try{template=await requireDocumentTemplate(await getBusiness(),j.kind,env);}catch(e){j.state='BLOCKED';j.reason=e.message;await persist(db,p.empresa_id,row);blocked++;outcomes.push({id:j.id,state:j.state,reason:j.reason});continue;}}
   j.state='SENDING';j.attemptAt=new Date().toISOString();await persist(db,p.empresa_id,row);let providerId='',failure='',uncertain=false;try{providerId=await sendJob(j,business,template);}catch(e){failure=e.message;uncertain=e.uncertain===true||j.canal==='EMAIL';}
   // Claim before contacting the provider; a timeout or interrupted invocation is never retried automatically.
   for(let attempt=0;attempt<3;attempt++){const latest=await rowFor(db,p.empresa_id),current=latest.estado.comunicacoes.find((x:any)=>x.id===id);if(!current||current.state!=='SENDING')break;current.state=providerId?'SENT':uncertain?'UNCERTAIN':'FAILED';current.providerId=providerId;current.reason=failure;current.sentAt=providerId?new Date().toISOString():null;if(providerId&&current.audience==='FORNECEDOR'){const o=latest.estado.comprasFornecedor.find((x:any)=>x.id===current.compraFornecedorId);if(o){o.status='AGUARDANDO RETORNO DO FORNECEDOR';o.envioAceitoEm=current.sentAt;}}
    if(providerId&&current.audience==='MOTORISTA'){try{recordDriverDispatch(latest.estado,current,current.sentAt);}catch{current.reason='Meta aceitou o envio, mas a carga mudou. Confira o histórico antes de continuar.';}}
    try{await persist(db,p.empresa_id,latest);outcomes.push({id:current.id,state:current.state,reason:current.reason,providerId:current.providerId});if(providerId)sent++;break;}catch(e){if(attempt===2)throw e;}}
  }
  return Response.json({message:sent+' envio(s) aceito(s) pelo provedor; '+blocked+' bloqueado(s).',sent,blocked,outcomes},{headers:cors});
 }catch(e){return Response.json({error:e.message||'Operação não concluída.'},{status:400,headers:cors});}
});

