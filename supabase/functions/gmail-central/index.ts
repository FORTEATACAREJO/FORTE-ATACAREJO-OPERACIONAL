import {classifyPalletDocument} from './pallets.mjs';
import {supplierDispatchCapacity} from '../orders-workflow/capacity.mjs';
import {jsPDF} from 'npm:jspdf@4.2.1';
import {orderMime} from './mime.mjs';
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@5.9.6';
import {XMLParser,XMLValidator} from 'npm:fast-xml-parser@5.11.2';
import {getDocumentProxy,extractText} from 'npm:unpdf@1.8.1';
import {parseNfe,parsePdfText,supplierDecision,matchDossier,validatePush,pushReady,validCnpj} from './intake.mjs';
import {CENTRAL_EMAIL,partsOf,decodeBytes,describeDocument,historyMessages} from './domain.mjs';
import {parseCiplan,safeCandidates} from './supplier-confirmation.mjs';
import {applyWorkflow} from '../orders-workflow/domain.mjs';
import {supplierConfirmationChannel} from '../orders-workflow/communications.mjs';
import {orderDocumentQueries,selectSearchMessages} from './order-document-search.mjs';
const env=(s:string)=>Deno.env.get(s)||'',url=env('SUPABASE_URL'),callback=url+'/functions/v1/gmail-central/callback',pushURL=url+'/functions/v1/gmail-central/push';
const origins:Record<string,{project:string,app:string}>={'https://pedidos-ft.onrender.com':{project:'gtwecfyffjszghnvtlzr',app:'vendas'},'https://forte-vendas.onrender.com':{project:'gtwecfyffjszghnvtlzr',app:'vendas'},'https://forte-vendas-app.onrender.com':{project:'gtwecfyffjszghnvtlzr',app:'vendas'},'https://forte-fiscal.onrender.com':{project:'xmfpvvmvdkepmnvtdoio',app:'fiscal'},'https://forte-financeiro.onrender.com':{project:'gtwecfyffjszghnvtlzr',app:'financeiro'},'https://forte-frete.onrender.com':{project:'nkynfboqwfxhhxcsrawl',app:'frete'}};
const db=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}}),jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const ok=(r:any)=>{if(r.error)throw Error('Falha ao registrar a integração: '+r.error.code);return r.data;};
const config=async()=>ok(await db.from('gmail_hub_config').select('*').eq('id',true).maybeSingle());
const secrets=async()=>ok(await db.rpc('gmail_hub_secrets_read'))||{};
const patch=async(p:any)=>ok(await db.from('gmail_hub_config').update({...p,updated_at:new Date().toISOString()}).eq('id',true));
async function token(c:any){const s=await secrets();if(!s.refresh_token)throw Error('AUTORIZACAO_SERVIDOR_PENDENTE');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:s.client_secret||env('GOOGLE_CLIENT_SECRET'),refresh_token:s.refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok||!j.access_token)throw Error(j.error==='invalid_grant'?'REAUTORIZACAO_GOOGLE_NECESSARIA':'GOOGLE_TOKEN_RECUSADO');return j.access_token;}
async function api(t:string,path:string,body?:any){const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok){const e:any=Error('GMAIL_API_'+r.status);e.status=r.status;throw e;}return r.json();}
async function enqueue(ids:string[]){if(ids.length)ok(await db.from('gmail_hub_messages').upsert(ids.map(id=>({email:CENTRAL_EMAIL,message_id:id})),{onConflict:'email,message_id',ignoreDuplicates:true}));}
async function worker(target?:{empresa:string,queries:string[]}){const owner=crypto.randomUUID();if(!ok(await db.rpc('gmail_hub_claim',{p_owner:owner})))return {busy:true};const workerPatch=async(p:any)=>ok(await db.from('gmail_hub_config').update({...p,updated_at:new Date().toISOString()}).eq('id',true).eq('lease_owner',owner));try{
 const deadline=Date.now()+65000;
 const c=await config();if(!c?.refresh_secret_id)return {pending:'AUTORIZACAO_SERVIDOR_PENDENTE'};const t=await token(c),profile=await api(t,'/profile');if(profile.emailAddress.toLowerCase()!==CENTRAL_EMAIL)throw Error('CONTA_GOOGLE_DIVERGENTE');
 let selected:any=null;
 if(target){if(target.empresa!==c.empresa_id)throw Error('Integração de outra empresa.');const pages=[];for(const q of target.queries)pages.push(await api(t,'/messages?'+new URLSearchParams({q,maxResults:'20'})));selected=selectSearchMessages(pages);await enqueue(selected.ids);if(selected.ids.length)ok(await db.from('gmail_hub_messages').update({status:'PENDENTE',attempts:0,error:null}).eq('email',CENTRAL_EMAIL).in('message_id',selected.ids));}
 else {
 if(!c.history_id){c.history_id=profile.historyId;await workerPatch({history_id:c.history_id});}
 if(!c.backfill_done){const q=new URLSearchParams({q:'newer_than:30d has:attachment -in:spam -in:trash',maxResults:'50'});if(c.backfill_page)q.set('pageToken',c.backfill_page);const page=await api(t,'/messages?'+q);await enqueue((page.messages||[]).map((m:any)=>m.id));await workerPatch({backfill_page:page.nextPageToken||null,backfill_done:!page.nextPageToken});}
 else {let pageToken=c.history_page||'',cursor=c.history_id;for(let i=0;i<3;i++){const q=new URLSearchParams({startHistoryId:c.history_id,historyTypes:'messageAdded',maxResults:'50'});if(pageToken)q.set('pageToken',pageToken);let page;try{page=await api(t,'/history?'+q);}catch(e){if(e.status===404){await workerPatch({history_id:profile.historyId,backfill_done:false,backfill_page:null,history_page:null,status:'RECUPERANDO_HISTORICO'});return {recovering:true};}throw e;}
 await enqueue(historyMessages(page));cursor=page.historyId||cursor;pageToken=page.nextPageToken||'';if(!pageToken){await workerPatch({history_id:cursor,history_page:null});break;}await workerPatch({history_page:pageToken});}
 }
 }
 const rules=ok(await db.from('gmail_hub_supplier_rules').select('*').eq('empresa_id',c.empresa_id));
 const recipients=ok(await db.from('gmail_hub_recipient_rules').select('cnpj').eq('empresa_id',c.empresa_id)).map((r:any)=>r.cnpj);
 let query=db.from('gmail_hub_messages').select('*').eq('email',CENTRAL_EMAIL).in('status',['PENDENTE','ERRO']).lt('attempts',8);if(selected&&selected.ids.length)query=query.in('message_id',selected.ids);const pending=selected&&!selected.ids.length?[]:ok(await query.order('received_at').limit(20));let imported=0,processed=0;
 for(const m of pending){if(Date.now()>deadline)break;try{
 const full=await api(t,'/messages/'+m.message_id+'?format=full');const headers=Object.fromEntries((full.payload?.headers||[]).map((h:any)=>[h.name.toLowerCase(),h.value]));
 const parts=partsOf(full.payload).sort((a:any,b:any)=>Number(/\.xml$/i.test(b.filename))-Number(/\.xml$/i.test(a.filename)));const failures=[];
 for(const p of parts){if(Date.now()>deadline){failures.push('PROCESSAMENTO_CONTINUARA');break;}try{
 const part=p.partId||p.body?.attachmentId||p.filename;
 if(p.body?.size>20*1024*1024)throw Error('ANEXO_EXCEDE_20MB');
 const a=p.body?.attachmentId?await api(t,'/messages/'+m.message_id+'/attachments/'+p.body.attachmentId):p.body;
 if(!a?.data)throw Error('ANEXO_SEM_CONTEUDO');const bytes=decodeBytes(a.data);if(bytes.length>20*1024*1024)throw Error('ANEXO_EXCEDE_20MB');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join(''),path=c.empresa_id+'/'+hash;
 let desc:any,pdfText="";try{
 if(/\.xml$/i.test(p.filename)){
 const raw=new TextDecoder().decode(bytes);if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw Error('XML_COM_ENTIDADE_NAO_PERMITIDA');if(XMLValidator.validate(raw)!==true)throw Error('XML_INVALIDO');
 desc=parseNfe(new XMLParser({ignoreAttributes:false,parseTagValue:false,processEntities:false}).parse(raw),recipients);
 }else if(/\.pdf$/i.test(p.filename)||p.mimeType==='application/pdf'){
 const pdf=await getDocumentProxy(bytes,{isEvalSupported:false});try{if(pdf.numPages>50)throw Error('PDF_EXCEDE_50_PAGINAS');pdfText=(await extractText(pdf,{mergePages:true})).text;desc=parsePdfText(pdfText);}finally{await pdf.loadingTask.destroy();}
 }else desc={kind:'DOCUMENTO',issues:['TIPO_DOCUMENTAL_A_CLASSIFICAR']};
 }catch(e){desc={kind:'DOCUMENTO',issues:[e instanceof Error?e.message:'EXTRACAO_A_REVISAR']};}
 desc.pallet=classifyPalletDocument(desc,p.filename,headers.subject||'',pdfText);
 const decision=supplierDecision(desc,headers.from,rules);
 let candidates=[];if(desc.kind==='BOLETO'&&desc.invoice_number)candidates=ok(await db.from('gmail_hub_dossiers').select('metadata').eq('empresa_id',c.empresa_id).eq('metadata->>number',desc.invoice_number)).map((r:any)=>r.metadata);
 const match=matchDossier(desc,candidates,decision.supplier);
 const file=ok(await db.from('gmail_hub_files').select('id').eq('empresa_id',c.empresa_id).eq('hash',hash).maybeSingle());
 if(!file)ok(await db.storage.from('forte-gmail-central').upload(path,bytes,{contentType:p.mimeType||'application/octet-stream',upsert:true}));
 ok(await db.rpc('gmail_hub_intake_save',{p_empresa:c.empresa_id,p_owner:owner,p_data:{hash,storage_path:path,size_bytes:bytes.length,mime_type:p.mimeType,email:CENTRAL_EMAIL,message_id:m.message_id,part_id:part,thread_id:full.threadId,filename:p.filename,sender:headers.from||'',subject:headers.subject||'',gmail_date:full.internalDate?new Date(Number(full.internalDate)).toISOString():null,kind:desc.kind,metadata:desc,key:decision.allowed?match.key:null,allowed:decision.allowed,supplier_id:decision.supplier?.id||null,issues:[...new Set([...(desc.issues||[]),...(decision.issues||[]),...match.issues]) ]}}));imported++;
 }catch(e){failures.push('ANEXO '+p.partId+': '+(e instanceof Error?e.message:'FALHA_PROCESSAMENTO'));}}
 ok(await db.from('gmail_hub_messages').update({status:failures.length?'ERRO':'PROCESSADO',error:failures.length?failures.join(' | '):null,attempts:m.attempts+1}).eq('email',CENTRAL_EMAIL).eq('message_id',m.message_id));if(!failures.length)processed++;
 }catch(e){ok(await db.from('gmail_hub_messages').update({status:'ERRO',error:e instanceof Error?e.message:'FALHA_PROCESSAMENTO',attempts:m.attempts+1}).eq('email',CENTRAL_EMAIL).eq('message_id',m.message_id));}}
 // Complementary boleto arriving before XML can be linked later using the same strict evidence.
 let orphanQuery=db.from('gmail_hub_sources').select('id,metadata,supplier_id').eq('empresa_id',c.empresa_id).eq('allowed',true).eq('kind','BOLETO').is('dossier_id',null);if(selected&&selected.ids.length)orphanQuery=orphanQuery.in('message_id',selected.ids);const orphans=selected&&!selected.ids.length?[]:ok(await orphanQuery.limit(100));
 for(const source of orphans){if(Date.now()>deadline)break;const candidates=ok(await db.from('gmail_hub_dossiers').select('id,metadata').eq('empresa_id',c.empresa_id).eq('metadata->>number',source.metadata.invoice_number||''));const match=matchDossier(source.metadata,candidates.map((r:any)=>r.metadata),rules.find((r:any)=>r.id===source.supplier_id&&r.active));if(match.key){const d=candidates.find((r:any)=>r.metadata.key===match.key);ok(await db.from('gmail_hub_sources').update({dossier_id:d.id,issues:source.metadata.issues||[],updated_at:new Date().toISOString()}).eq('empresa_id',c.empresa_id).eq('id',source.id));}}
 if(target){await workerPatch({status:'SERVIDOR_CONECTADO',error:null});return {imported,found:selected.ids.length,processed,incomplete:selected.limited||processed<selected.ids.length};}
 let notificationError:string|null=null;
 if(c.topic&&(!c.watch_updated_at||Date.parse(c.watch_updated_at)<Date.now()-24*3600000||!c.watch_expires||Date.parse(c.watch_expires)<Date.now()+24*3600000)){try{const w=await api(t,'/watch',{topicName:c.topic,labelIds:['INBOX'],labelFilterBehavior:'INCLUDE'});await workerPatch({watch_expires:new Date(Number(w.expiration)).toISOString(),watch_updated_at:new Date().toISOString(),error:null});}catch{notificationError='NOTIFICACOES_GOOGLE_PENDENTES';}}
 await workerPatch({last_sync:new Date().toISOString(),status:'SERVIDOR_CONECTADO',error:notificationError});return {imported};
 }catch(e){await workerPatch({status:'ERRO',error:e.message});throw e;}finally{ok(await db.from('gmail_hub_config').update({lease_until:null,lease_owner:null}).eq('id',true).eq('lease_owner',owner));}}
function supplierPDF(j:any){const d=new jsPDF();let y=20;const line=(s:string)=>{const lines=d.splitTextToSize(s,180);for(const t of lines){if(y>275){d.addPage();y=20;}d.text(t,15,y);y+=6;}};d.setFillColor(22,42,58);d.rect(0,0,210,34,'F');d.setTextColor(255);d.setFontSize(14);d.text('FORTE ATACAREJO',15,14);d.setFontSize(10);d.text('PEDIDO '+j.reference,15,24);d.setFillColor(228,111,30);d.rect(0,34,210,2,'F');d.setTextColor(22,42,58);y=45;d.setFontSize(10);const o=j.order;line('Fornecedor: '+o.fornecedor+' • Unidade: '+o.unidade);line('Código cliente Forte no fornecedor: '+(o.codigoFornecedor||o.fornecedorSnapshot?.codigoCliente||o.fornecedorSnapshot?.codigoForte||'Não informado'));line('Origem: '+o.origem+' • Destino: '+o.destino);line('Motorista: '+(o.motorista||'A definir')+' • '+o.placas.join(' / '));line('Tipo de compra: '+(o.modalidadeCompra||'PADRAO'));for(const [k,label] of [['cpf','CPF'],['cnhNumero','CNH'],['rntrc','RNTRC'],['proprietario','Proprietário']])if(o.motoristaSnapshot?.[k])line(label+': '+o.motoristaSnapshot[k]);line('Pagamento: '+o.pagamento+' • '+o.modalidadeFrete+' • '+o.regraPallets+' • '+o.palletQuantidade);for(const i of o.itens)line(i.qtd+' • '+i.produto+' • Unitário R$ '+Number(i.custoUnitario).toFixed(2)+' • Total R$ '+Number(i.total).toFixed(2));line('Peso: '+Number(o.pesoKg/1000).toLocaleString('pt-BR')+' t • Total da compra R$ '+o.itens.reduce((a:any,i:any)=>a+Number(i.total),0).toFixed(2));line('Referência interna: '+o.id);line('Contato: (34) 99920-9335');return new Uint8Array(d.output('arraybuffer'));}
async function sendOrder(id:string){
 const c=await config();if(!c?.refresh_secret_id)throw Error('AUTORIZACAO_SERVIDOR_PENDENTE');
 const row=ok(await db.from('fc_app_state').select('estado').eq('empresa_id',c.empresa_id).single()),j=(row.estado.comunicacoes||[]).find((j:any)=>j.id===id);
 if(!j||j.canal!=='EMAIL'||j.audience!=='FORNECEDOR'||j.state!=='SENDING')throw Error('PEDIDO_NAO_AUTORIZADO_PARA_ENVIO');
 const old=ok(await db.from('gmail_hub_outbox').select('*').eq('job_id',id).maybeSingle());if(old?.status==='SENT')return {id:old.message_id,threadId:old.thread_id};if(old)throw Error('ENVIO_ANTERIOR_NAO_CONFIRMADO');
 supplierDispatchCapacity(row.estado,j);
 const t=await token(c),p=await api(t,'/profile');if(p.emailAddress.toLowerCase()!==CENTRAL_EMAIL)throw Error('CONTA_GOOGLE_DIVERGENTE');
 const bytes=supplierPDF(j),raw=orderMime(j,btoa(Array.from(bytes).map(n=>String.fromCharCode(n)).join('')));
 ok(await db.from('gmail_hub_outbox').insert({job_id:id,empresa_id:c.empresa_id,status:'SENDING'}));
 try{const sent=await api(t,'/messages/send',{raw});if(!sent.id)throw Error('GOOGLE_ENVIO_NAO_CONFIRMADO');ok(await db.from('gmail_hub_outbox').update({status:'SENT',message_id:sent.id,thread_id:sent.threadId,updated_at:new Date().toISOString()}).eq('job_id',id));return sent;
 }catch(e){await db.from('gmail_hub_outbox').update({status:'UNCERTAIN',error:e.message,updated_at:new Date().toISOString()}).eq('job_id',id);throw e;}
}
Deno.serve(async req=>{
 const u=new URL(req.url),origin=req.headers.get('origin')||'',source=origins[origin],headers={'Access-Control-Allow-Origin':source?origin:'null','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store',Vary:'Origin'},reply=(x:any,s=200)=>Response.json(x,{status:s,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:source?204:403,headers});
 try{
 if(u.pathname.endsWith('/callback')){
  if(req.method!=='GET')return reply({error:'Método inválido'},405);const state=u.searchParams.get('state')||'',code=u.searchParams.get('code');
  const pending=ok(await db.from('gmail_hub_oauth').delete().eq('state',state).gt('expires_at',new Date().toISOString()).select().maybeSingle());if(!pending)return reply({error:'Autorização expirada. Abra a conexão novamente no sistema.'},400);
  if(!code)return new Response('Autorização cancelada. Volte ao Forte Vendas e tente novamente.',{status:400});const c=await config(),s=await secrets();
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:s.client_secret||env('GOOGLE_CLIENT_SECRET'),code,redirect_uri:callback,grant_type:'authorization_code',code_verifier:pending.verifier}),signal:AbortSignal.timeout(20000)}),j=await r.json();if(!r.ok||!j.access_token||!j.refresh_token)throw Error('Google não forneceu autorização permanente. Tente autorizar novamente.');
  const p=await api(j.access_token,'/profile');if(p.emailAddress.toLowerCase()!==CENTRAL_EMAIL)throw Error('Selecione somente '+CENTRAL_EMAIL);
  ok(await db.rpc('gmail_hub_secret_save',{p_kind:'refresh',p_value:j.refresh_token}));await patch({status:'SERVIDOR_CONECTADO',history_id:p.historyId,history_page:null,backfill_done:false,backfill_page:null,error:null});EdgeRuntime.waitUntil(worker().catch(()=>{}));
  return new Response('Gmail autorizado no servidor. Você pode fechar esta janela e atualizar o painel da integração.',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 }
 if(u.pathname.endsWith('/push')){
  if(req.method!=='POST')return reply({error:'Método inválido'},405);const c=await config();if(!c?.push_email||!c.topic)return reply({error:'Notificações não configuradas'},503);
  const bearer=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');let payload;
  try{({payload}=await jwtVerify(bearer,jwks,{issuer:['accounts.google.com','https://accounts.google.com'],audience:pushURL}));}catch{return reply({error:'OIDC inválido ou expirado'},401);}
  if(payload.email!==c.push_email||payload.email_verified!==true)return reply({error:'Notificação não autorizada'},401);
  if(Number(req.headers.get('content-length')||0)>32768)return reply({error:'Push excede o limite'},413);
  const raw=await req.text();if(raw.length>32768)return reply({error:'Push excede o limite'},413);
  let data;try{data=validatePush(JSON.parse(raw),c,CENTRAL_EMAIL);}catch{return reply({error:'Caixa, assinatura ou dados divergentes'},400);}
  ok(await db.from('gmail_hub_events').upsert({email:CENTRAL_EMAIL,history_id:data.historyId},{onConflict:'email,history_id',ignoreDuplicates:true}));await patch({last_push:new Date().toISOString()});EdgeRuntime.waitUntil(worker().catch(()=>{}));return reply({accepted:true});
 }
 if(req.method!=='POST')return reply({error:'Método inválido'},405);const body=await req.json();
 if(body.action==='SEND_ORDER'){const s=await secrets();if(!s.worker_token||req.headers.get('x-forte-worker')!==s.worker_token)return reply({error:'Não autorizado'},401);return reply(await sendOrder(String(body.id||'')));}
 if(body.action==='TICK'){const s=await secrets();if(!s.worker_token||req.headers.get('x-forte-worker')!==s.worker_token)return reply({error:'Não autorizado'},401);return reply(await worker());}
 if(!source)return reply({error:'Origem não permitida'},403);const auth=req.headers.get('authorization')||'';let actor,empresa,actorProfile;
 if(source.app==='vendas'||source.app==='financeiro'){const client=createClient(url,env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:auth}}});const user=await client.auth.getUser();if(user.error||!user.data.user)return reply({error:'Entre no sistema'},401);const p=ok(await client.from('fc_perfis').select('*').eq('user_id',user.data.user.id).single());if(!p?.ativo||p.trocar_senha||p.status_aprovacao!=='APROVADO'||!(['MASTER','ADMINISTRADOR'].includes(p.perfil)||(source.app==='financeiro'&&(p.permissoes?.financeiro===true||p.permissoes?.FINANCEIRO===true))))return reply({error:'Acesso administrativo necessário'},403);const grant=ok(await db.rpc('access_module_context',{p_user:user.data.user.id,p_app:source.app}));if(!grant.allowed||!grant.isAdmin)return reply({error:'Aprovação administrativa neste módulo é necessária'},403);actor=user.data.user.id;empresa=p.empresa_id;actorProfile={...p,user_id:actor,perfil:grant.role||p.perfil};
 }else{const r=await fetch('https://'+source.project+'.supabase.co/functions/v1/access-invites',{method:'POST',headers:{Origin:origin,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({app:source.app,action:'AUTHORIZE_CONFIG'}),signal:AbortSignal.timeout(15000)});const a=await r.json();if(!r.ok||!a.authorized)return reply({error:'Acesso master necessário'},403);actor=a.actor;empresa=(await config())?.empresa_id;}
 let c=await config();if(c&&c.empresa_id!==empresa)return reply({error:'Integração de outra empresa'},403);
 if(body.action==='CONFIGURE'){if(source.app!=='vendas')throw Error('Configure a conta central no Vendas.');const clientId=String(body.client_id||'').trim(),topic=String(body.topic||'').trim(),pushEmail=String(body.push_email||'').trim();if(!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(clientId))throw Error('Client ID Google inválido');if(topic&&!/^projects\/[a-z0-9-]+\/topics\/[a-zA-Z0-9_.~-]+$/.test(topic))throw Error('Tópico Pub/Sub inválido');if(Boolean(topic)!==Boolean(pushEmail))throw Error('Informe tópico e conta de serviço juntos.');if(topic&&!topic.endsWith('/topics/forte-gmail-central'))throw Error('Selecione o tópico forte-gmail-central.');if(pushEmail&&!/^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/.test(pushEmail))throw Error('Conta de serviço Pub/Sub inválida');if(c&&c.client_id!==clientId&&c.refresh_secret_id)throw Error('Client ID de uma conexão ativa não pode ser substituído.');ok(await db.from('gmail_hub_config').upsert({id:true,empresa_id:empresa,client_id:clientId,topic:topic||null,push_email:pushEmail||null,...(c?.topic!==topic||c?.push_email!==pushEmail?{watch_expires:null,last_push:null,watch_updated_at:null}:{}),error:null}));if(body.client_secret)ok(await db.rpc('gmail_hub_secret_save',{p_kind:'client',p_value:String(body.client_secret)}));return reply({message:'Configuração salva. Autorize a conta central para continuar.'});}
 if(body.action==='STATUS'){const s=await secrets();const pendingCount=await db.from('gmail_hub_messages').select('message_id',{count:'exact',head:true}).in('status',['PENDENTE','ERRO']);const counts=await db.from('gmail_hub_sources').select('id',{count:'exact',head:true}).eq('empresa_id',empresa);return reply({email:CENTRAL_EMAIL,status:c?.status||'CONFIGURACAO_PENDENTE',client_id:c?.client_id||'',secret_configured:Boolean(s.client_secret||env('GOOGLE_CLIENT_SECRET')),server_authorized:Boolean(c?.refresh_secret_id&&c?.status==='SERVIDOR_CONECTADO'),credentials_configured:Boolean(c?.refresh_secret_id),notifications_configured:Boolean(c?.topic&&c?.push_email),notifications_verified:pushReady(c||{}),watch_expires:c?.watch_expires,last_push:c?.last_push,last_sync:c?.last_sync,error:c?.error,documents:counts.count||0,pending_messages:pendingCount.count||0,callback,push_url:pushURL,topic:c?.topic||'',push_email:c?.push_email||''});}
 if(!c)throw Error('Configure o Client ID da conta central.');
 if(source.app==='financeiro'&&['CONNECT','SYNC'].includes(body.action))return reply({error:'Ação exige administrador Vendas'},403);
 if(body.action==='CONNECT'){const s=await secrets();if(!s.client_secret&&!env('GOOGLE_CLIENT_SECRET'))throw Error('Salve a chave secreta Google no campo protegido da integração.');const state=crypto.randomUUID()+crypto.randomUUID(),verifier=crypto.randomUUID()+crypto.randomUUID(),challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');ok(await db.from('gmail_hub_oauth').insert({state,empresa_id:empresa,actor,origin,verifier,expires_at:new Date(Date.now()+10*60000).toISOString()}));const q=new URLSearchParams({client_id:c.client_id,redirect_uri:callback,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',login_hint:CENTRAL_EMAIL,state,code_challenge:challenge,code_challenge_method:'S256'});return reply({url:'https://accounts.google.com/o/oauth2/v2/auth?'+q});}
 if(['SEARCH_ORDER_CONFIRMATION','LINK_ORDER_CONFIRMATION'].includes(body.action)){
  if(source.app!=='vendas'||!actorProfile||!['MASTER','ADMINISTRADOR'].includes(actorProfile.perfil))return reply({error:'Conferência restrita à administração de Vendas.'},403);
  const scoped=createClient(url,env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:auth}}});
  const permission=await scoped.rpc('fc_operacao_autorizada');if(permission.error||permission.data!==true)return reply({error:'Acesso operacional não autorizado.'},403);
  const row=ok(await db.from('fc_app_state').select('estado,versao').eq('empresa_id',empresa).single());
  const order=(row.estado.comprasFornecedor||[]).find((o:any)=>o.id===body.orderId);
  const load=(row.estado.cargas||[]).find((l:any)=>l.id===order?.cargaId||l.compraFornecedorId===order?.id);
  if(!order||!load||order.numeroPedidoFornecedor||load.numeroPedidoFornecedor||load.finalizadaEm||/CANCELAD|EXCLUID|FINALIZAD/i.test(String(order.status))||load.status==='CANCELADA')throw Error('OS indisponível ou já confirmada. Atualize a tela.');
  if(supplierConfirmationChannel((row.estado.fornecedores||[]).find((f:any)=>f.id===order.fornecedorId))==='WHATSAPP')throw Error('Este fornecedor utiliza WhatsApp para confirmações.');
  if(order.fornecedorId!=='f-ciplan')throw Error('O formato de confirmação deste fornecedor ainda não está homologado. Utilize o registro manual.');
  const created=Date.parse(order.criadaEm);if(!Number.isFinite(created))throw Error('A OS não possui data de criação válida.');
  const t=await token(c),profile=await api(t,'/profile');if(String(profile.emailAddress).toLowerCase()!==CENTRAL_EMAIL)throw Error('CONTA_GOOGLE_DIVERGENTE');
  const q=new URLSearchParams({q:'from:BR_Svc_RelaySAP@ciplan.com.br subject:"Ciplan - Pedido de Venda" after:'+Math.floor(created/1000)+' -in:spam -in:trash -in:sent',maxResults:'50'});
  const list=await api(t,'/messages?'+q);
  if(list.nextPageToken)throw Error('Muitas confirmações no período. Revise a OS manualmente para evitar vínculo incorreto.');
  const candidates=[];
  const messages=(list.messages||[]).slice(0,50);
  for(let start=0;start<messages.length;start+=5){
   const batch=await Promise.all(messages.slice(start,start+5).map(async(m:any)=>{
    const full=await api(t,'/messages/'+encodeURIComponent(m.id)+'?format=full');
    const h=Object.fromEntries((full.payload?.headers||[]).map((v:any)=>[String(v.name).toLowerCase(),v.value]));
    if(!full.internalDate||!Number.isFinite(Number(full.internalDate)))return null;
    const receivedAt=new Date(Number(full.internalDate)).toISOString(),parts:any[]=[];
    function collect(part:any){if(!part)return;if(!part.filename&&['text/plain','text/html'].includes(part.mimeType)&&part.body?.data&&part.body.data.length<=500000)parts.push(part);for(const child of part.parts||[])collect(child);}
    collect(full.payload);parts.sort((a,b)=>Number(b.mimeType==='text/plain')-Number(a.mimeType==='text/plain'));
    for(const part of parts){const parsed=parseCiplan({subject:h.subject,from:h.from,body:new TextDecoder().decode(decodeBytes(part.body.data)),receivedAt,messageId:full.id});if(parsed)return parsed;}
    return null;
   }));candidates.push(...batch);
  }
  const matches=safeCandidates(row.estado,order,candidates);
  if(body.action==='SEARCH_ORDER_CONFIRMATION')return reply({candidates:matches,unverified:['Preço','Expedição','Destino/CNPJ de entrega'],mailbox:CENTRAL_EMAIL});
  // Reconsulta o Gmail e a OS no servidor antes da gravação; jamais aceita o número digitado como evidência automática.
  if(matches.length!==1||matches[0].messageId!==body.messageId)throw Error('Confirmação ambígua, alterada ou não localizada. Pesquise novamente; nada foi vinculado.');
  const match=matches[0],evidence='GMAIL '+CENTRAL_EMAIL+' | mensagem '+match.messageId+' | '+match.subject+' | '+match.receivedAt+' | produtos, quantidades, prazo e frete conferidos; valores, expedição e destino não informados.';
  const out=applyWorkflow(row.estado,{action:'OFFICIAL_CONFIRM',requestId:crypto.randomUUID(),id:order.id,numeroPedidoFornecedor:match.numero,evidencia:evidence},actorProfile,{id:crypto.randomUUID(),at:new Date().toISOString()});
  const saved=await db.rpc('fc_gravar_workflow',{p_empresa:empresa,p_actor:actor,p_versao:row.versao,p_estado:out.state});
  if(saved.error||saved.data!==row.versao+1)return reply({error:'Dados alterados durante a consulta. Atualize e pesquise novamente.'},409);
  return reply({ok:true,numero:match.numero,...out.result});
 }
 if(body.action==='IMPORT_ORDER_DOCUMENTS'){
  if(source.app!=='vendas'||!actorProfile||!['MASTER','ADMINISTRADOR'].includes(actorProfile.perfil))return reply({error:'Importação restrita à administração de Vendas.'},403);
  const scoped=createClient(url,env('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:auth}}});
  const permission=await scoped.rpc('fc_operacao_autorizada');if(permission.error||permission.data!==true)return reply({error:'Acesso operacional não autorizado.'},403);
  const state=ok(await db.from('fc_app_state').select('estado').eq('empresa_id',empresa).single()).estado;
  const load=(state.cargas||[]).find((x:any)=>x.id===body.cargaId&&x.status!=='CANCELADA'&&!x.finalizadaEm);
  if(!load)throw Error('OS indisponível para importação.');
  const order=(state.comprasFornecedor||[]).find((o:any)=>o.id===load.compraFornecedorId||o.cargaId===load.id);
  const supplier=(state.fornecedores||[]).find((f:any)=>f.id===(order?.fornecedorId||load.fornecedorId));
  const issuer=String(order?.fornecedorSnapshot?.cnpj||load.fornecedorSnapshot?.cnpj||supplier?.cnpj||'').replace(/\D/g,'');
  const rules=ok(await db.from('gmail_hub_supplier_rules').select('*').eq('empresa_id',empresa).eq('cnpj',issuer).eq('active',true));
  const queries=orderDocumentQueries({references:[order?.numero,load.numeroOS,order?.numeroPedidoFornecedor,load.numeroPedidoFornecedor],senders:rules.flatMap((r:any)=>r.senders||[]),domains:rules.flatMap((r:any)=>r.domains||[]),createdAt:order?.criadaEm||load.criadaEm||load.criadoEm});
  const result=await worker({empresa,queries});if(result.busy)return reply({error:'Central Gmail ocupada. Tente importar novamente.'},409);if(result.pending)return reply({error:'Autorize a conta Google da central Gmail antes de importar.'},400);return reply(result);
 }
 if(body.action==='SYNC')return reply(await worker());
 if(body.action==='RULES')return reply({rules:ok(await db.from('gmail_hub_supplier_rules').select('*').eq('empresa_id',empresa))});
 if(body.action==='SAVE_RULE'){if(source.app!=='vendas')return reply({error:'Cadastre regras no Vendas'},403);const r=body.rule||{};if(!validCnpj(r.cnpj)||!String(r.name||'').trim()||!Array.isArray(r.kinds)||r.kinds.some((k:string)=>!['XML_NFE','DANFE','BOLETO','DOCUMENTO','COMPROVANTE_FRETE'].includes(k)))throw Error('Regra inválida');const senders=(r.senders||[]).map((s:string)=>String(s).trim().toLowerCase()),domains=(r.domains||[]).map((s:string)=>String(s).trim().toLowerCase());if(senders.some((s:string)=>!/^[-a-z0-9._%+]+@[-a-z0-9.]+\.[a-z]{2,}$/.test(s))||domains.some((s:string)=>!/^[-a-z0-9]+(?:\.[-a-z0-9]+)+$/.test(s)))throw Error('Remetente ou domínio inválido');if(r.active&&!senders.length&&!domains.length)throw Error('Cadastre remetente ou domínio antes de ativar');ok(await db.from('gmail_hub_supplier_rules').upsert({empresa_id:empresa,name:String(r.name).trim(),cnpj:r.cnpj,senders,domains,kinds:r.kinds,active:Boolean(r.active)},{onConflict:'empresa_id,cnpj'}));return reply({saved:true});}
 if(body.action==='REPROCESS'){if(source.app!=='vendas')return reply({error:'Reprocessamento exige administrador Vendas'},403);const m=String(body.message_id||'');if(!/^[a-f0-9]{10,40}$/i.test(m))throw Error('Mensagem inválida');ok(await db.from('gmail_hub_messages').update({status:'PENDENTE',attempts:0,error:null}).eq('email',CENTRAL_EMAIL).eq('message_id',m));return reply({queued:true});}
 if(body.action==='LIST'){
 if(source.app==='frete'){const documents=ok(await db.from('gmail_hub_documents').select('id,filename,kind,subject,sender,status,destinations').eq('empresa_id',empresa).contains('destinations',['frete']).limit(100));return reply({documents,dossiers:[],pending:[],next_offset:null});}
 const offset=Math.max(0,Number(body.offset)||0),limit=50;
 const dossiers=ok(await db.from('gmail_hub_dossiers').select('*').eq('empresa_id',empresa).order('created_at',{ascending:false}).range(offset,offset+limit-1));
 const ids=dossiers.map((d:any)=>d.id);const sources=ids.length?ok(await db.from('gmail_hub_sources').select('id,file_id,dossier_id,filename,kind,issues,message_id,metadata').eq('empresa_id',empresa).in('dossier_id',ids)):[];
 const pending=ok(await db.from('gmail_hub_sources').select('id,filename,kind,issues,message_id,sender').eq('empresa_id',empresa).is('dossier_id',null).order('created_at',{ascending:false}).range(offset,offset+limit-1));
 const legacy=ok(await db.from('gmail_hub_legacy_pending').select('id,filename,kind,message_id,sender').eq('empresa_id',empresa).order('created_at',{ascending:false}).range(offset,offset+limit-1));pending.push(...legacy.map((d:any)=>({...d,issues:['CLASSIFICACAO_ANTERIOR_REPROCESSAR']})));
 return reply({dossiers:dossiers.map((d:any)=>({...d,documents:sources.filter((s:any)=>s.dossier_id===d.id)})),pending,next_offset:dossiers.length===limit||pending.length>=limit?offset+limit:null});
 }
 if(body.action==='DOSSIER'){const d=ok(await db.from('gmail_hub_dossiers').select('*').eq('empresa_id',empresa).eq('id',body.id).single());const documents=ok(await db.from('gmail_hub_sources').select('id,filename,kind,issues,sender,subject,gmail_date,message_id,part_id,metadata').eq('empresa_id',empresa).eq('dossier_id',d.id).order('created_at'));return reply({dossier:d,documents});}
 if(body.action==='DOWNLOAD'){const source=ok(await db.from('gmail_hub_sources').select('file_id,kind').eq('id',body.id).eq('empresa_id',empresa).maybeSingle());if(source&&origins[origin]?.app==='frete'&&source.kind!=='COMPROVANTE_FRETE')return reply({error:'Documento de outro módulo'},403);const d=source?ok(await db.from('gmail_hub_files').select('storage_path').eq('id',source.file_id).eq('empresa_id',empresa).single()):ok(await db.from('gmail_hub_documents').select('storage_path,destinations').eq('id',body.id).eq('empresa_id',empresa).single());if(!source&&!['vendas','financeiro','fiscal'].includes(origins[origin]?.app)&&!d.destinations?.includes(origins[origin]?.app))return reply({error:'Documento de outro módulo'},403);return reply(ok(await db.storage.from('forte-gmail-central').createSignedUrl(d.storage_path,60)));}
 return reply({error:'Ação inválida'},400);
 }catch(e){return reply({error:e instanceof Error?e.message:'Integração pendente'},u.pathname.endsWith('/push')?503:400);}
});

