import {latestAssignments,currentAssignments,scopeFor,scopedSnapshot,scopedView,saleForUpload,billingReady,billingVersion,billingCategories} from './ft-dossier-scope.mjs';
import {applyWorkflow} from './domain.mjs';
const fail=(message:string)=>{throw Error(message)};
const table='ft_dossier_assignments_history';
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export async function ftDossierAction(db:any,b:any,p:any,user:any,globalMaster:boolean){
 const empresa=p.empresa_id,uid=user.id;
 if(!p.ativo||p.trocar_senha||p.status_aprovacao!=='APROVADO')fail('Acesso não aprovado.');
 const history=async(userId?:string,cargaId?:string)=>{
  const all:any[]=[];for(let start=0;start<20000;start+=500){
   let q=db.from(table).select('carga_id,user_id,revision,papel,ativo').eq('empresa_id',empresa).order('carga_id').order('user_id').order('revision',{ascending:false});
   if(userId)q=q.eq('user_id',userId);if(cargaId)q=q.eq('carga_id',cargaId);
   const r=await q.range(start,start+499);if(r.error)fail('Atribuições indisponíveis.');all.push(...r.data);if(r.data.length<500)return all;
  }return fail('Histórico excede o limite; solicite revisão.');
 };
 const own=await history(uid),master=globalMaster&&!own.length;
 if(b.action==='FT_SCOPE')return {mode:master?'MASTER':own.length?'RESTRICTED':'DENIED'};
 if(b.action==='FT_ASSIGN_LIST'){
  if(!master)fail('Atribuição exclusiva do MASTER.');
  const r=await db.from('fc_perfis').select('user_id,nome,perfil').eq('empresa_id',empresa).eq('ativo',true).eq('status_aprovacao','APROVADO').eq('trocar_senha',false);
  if(r.error)fail('Cadastros indisponíveis.');
  return {users:r.data.filter((x:any)=>x.user_id!==uid),assignments:latestAssignments(await history())};
 }
 const state=async()=>{const r=await db.from('fc_app_state').select('estado,versao').eq('empresa_id',empresa).single();if(r.error||!r.data)fail('Base indisponível.');return r.data;};
 const row=await state(),s=row.estado,id=String(b.cargaId||'');
 if(b.action==='FT_ASSIGN_SAVE'){
  if(!master)fail('Atribuição exclusiva do MASTER.');
  if(!s.cargas?.some((c:any)=>c.id===id&&c.status!=='CANCELADA'))fail('Carga indisponível.');
  if(!['JULIANA','PEDRO'].includes(b.papel)||typeof b.ativo!=='boolean'||b.userId===uid)fail('Atribuição inválida.');
  const target=await db.from('fc_perfis').select('user_id,ativo,status_aprovacao,trocar_senha').eq('empresa_id',empresa).eq('user_id',b.userId).maybeSingle();
  if(target.error||!target.data?.ativo||target.data.status_aprovacao!=='APROVADO'||target.data.trocar_senha)fail('Selecione login existente, ativo e aprovado.');
  const auth=await db.auth.admin.getUserById(target.data.user_id);if(auth.error||!auth.data?.user)fail('Login autenticado não localizado.');
  const h=await history(b.userId,id),latest=h.reduce((x:any,y:any)=>!x||x.revision<y.revision?y:x,null);
  if(b.revision!==(latest?.revision||0))fail('Atribuição alterada. Atualize.');
  if(!b.ativo&&(!latest||latest.papel!==b.papel))fail('Atribuição inexistente.');
  const r=await db.from(table).insert({empresa_id:empresa,carga_id:id,user_id:b.userId,revision:(latest?.revision||0)+1,papel:b.papel,ativo:b.ativo,actor:uid});
  if(r.error)fail('Não foi possível gravar atribuição. Atualize.');
  return {ok:true};
 }
 if(b.action==='FT_MY_LOADS')return {loads:currentAssignments(own).flatMap(h=>{const c=s.cargas?.find((x:any)=>x.id===h.carga_id&&x.status!=='CANCELADA');if(!c)return [];return [{id:c.id,os:c.numeroOS||c.codigo,fornecedor:c.fornecedor,role:h.papel,finalizadaEm:c.finalizadaEm}];})};
 const role=scopeFor(own,uid,id),snapshot=scopedSnapshot(s,id,role);
 const logAccess=async(action:string,docId?:string)=>{const r=await db.from('ft_dossier_access_log').insert({empresa_id:empresa,carga_id:id,user_id:uid,acao:action,documento_id:docId||null});if(r.error)fail('Não foi possível registrar o acesso.');};
 if(b.action==='FT_LOAD_GET'){await logAccess('DOSSIÊ CONSULTADO');return {dossier:scopedView(s,id,role)};}
 async function assertScope(){if(scopeFor(await history(uid,id),uid,id)!==role)fail('Atribuição alterada.');}
 async function save(next:any){await assertScope();const r=await db.rpc('ft_save_dossier_scope',{p_empresa:empresa,p_actor:uid,p_carga:id,p_papel:role,p_versao:row.versao,p_estado:next});if(r.error||r.data!==row.versao+1)fail('Outra pessoa atualizou a carga. Reabra e confira.');}
 const audit=(next:any,action:string,detail:any)=>{next.auditoria=[...(next.auditoria||[]),{id:crypto.randomUUID(),acao:action,detalhe:JSON.stringify({cargaId:id,...detail}),userId:uid,usuario:p.nome,dataHora:new Date().toISOString()}];};
 if(b.action==='FT_DOC_OPEN'){
  const doc=snapshot.docs.find(d=>d.id===b.documentoId);if(!doc)fail('Documento não pertence a esta carga.');
  if(doc.gmailSourceId){
   if(doc.storageBucket!=='forte-gmail-central')fail('Origem inválida.');
   const source=await db.from('gmail_hub_sources').select('file_id').eq('empresa_id',empresa).eq('id',doc.gmailSourceId).eq('allowed',true).single();
   if(source.error||!source.data)fail('Origem indisponível.');
   const f=await db.from('gmail_hub_files').select('hash,storage_path').eq('empresa_id',empresa).eq('id',source.data.file_id).single();
   if(f.error||f.data.hash!==doc.hash||f.data.storage_path!==doc.storagePath)fail('Documento não confere com a origem.');
  }else if(doc.storageBucket!=='forte-vendas-dossies'||!String(doc.storagePath||'').startsWith(empresa+'/'))fail('Arquivo não autorizado.');
  await assertScope();
  const r=await db.storage.from(doc.storageBucket).createSignedUrl(doc.storagePath,60);if(r.error||!r.data?.signedUrl)fail('Arquivo indisponível.');
  await logAccess('DOCUMENTO ABERTO',doc.id);return {signedUrl:r.data.signedUrl};
 }
 if(snapshot.c.finalizadaEm)fail('Carga finalizada.');
 if(b.action==='FT_BILLING_UPLOAD'){
  if(role!=='JULIANA'||!billingCategories.includes(b.categoria))fail('Operação restrita ao faturamento.');
  saleForUpload(snapshot,b.vendaId,b.clienteId);
  if(typeof b.base64!=='string'||b.base64.length>14*1024*1024)fail('Anexo excede 10 MB.');
  const bytes=Uint8Array.from(atob(b.base64),x=>x.charCodeAt(0));if(!bytes.length||bytes.length>10*1024*1024)fail('Arquivo inválido.');
  const xml=b.categoria==='NF VENDA XML',name=String(b.filename||'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,180);
  if(xml?!/\.xml$/i.test(name)||!/^\s*(?:<\?xml[^>]*\?>\s*)?<(?:nfeProc|NFe)(?:\s|>)/.test(new TextDecoder().decode(bytes))||/<!DOCTYPE|<!ENTITY/i.test(new TextDecoder().decode(bytes)):! /\.pdf$/i.test(name)||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail('Formato do arquivo não corresponde à categoria.');
  const hash=await digest(bytes),prior=snapshot.docs.find(d=>d.vendaId===b.vendaId&&d.clienteId===b.clienteId&&d.categoria===b.categoria&&d.hash===hash);
  if(prior)return {ok:true,id:prior.id};
  const docId=crypto.randomUUID(),path=empresa+'/'+docId+'/'+name;
  await assertScope();const uploaded=await db.storage.from('forte-vendas-dossies').upload(path,bytes,{upsert:false,contentType:xml?'application/xml':'application/pdf'});if(uploaded.error)fail('Não foi possível armazenar o arquivo.');
  s.documentos=[...(s.documentos||[]),{id:docId,cargaId:id,vendaId:b.vendaId,clienteId:b.clienteId,categoria:b.categoria,tipo:b.categoria,filename:name,storageBucket:'forte-vendas-dossies',storagePath:path,hash,validationStatus:'RECEBIDO',identificacaoConfirmada:false,origem:'PEDIDOS FT — FATURAMENTO',receivedAt:new Date().toISOString(),usuario:p.nome}];
  delete snapshot.c.faturamentoFT;audit(s,'FT_DOCUMENTO_PUBLICADO',{documentoId:docId,vendaId:b.vendaId,clienteId:b.clienteId,hash});await save(s);return {ok:true,id:docId};
 }
 if(b.action==='FT_BILLING_CONFIRM'){
  if(role!=='JULIANA'||b.confirmado!==true)fail('Confirmação exclusiva do faturamento.');
  billingReady(snapshot);snapshot.c.faturamentoFT={at:new Date().toISOString(),actor:uid,version:await digest(new TextEncoder().encode(billingVersion(snapshot)))};audit(s,'FT_FATURAMENTO_CONFERIDO',{});await save(s);return {ok:true};
 }
 if(b.action==='FT_DOC_CHECK'){
  if(role!=='PEDRO'||b.confirmado!==true)fail('Conferência exclusiva do fechamento.');
  const doc=snapshot.docs.find(d=>d.id===b.documentoId),evidencia=String(b.evidencia||'').trim();if(!doc||evidencia.length<3||evidencia.length>500)fail('Documento ou evidência inválida.');
  if(doc.cargaId!==id)fail('Peça ao MASTER para regularizar o vínculo do documento.');
  if(doc.categoria==='COMPROVANTE FRETE')fail('Comprovante de frete exige validação financeira pelo MASTER.');
  Object.assign(doc,{validationStatus:'VALIDADO',identificacaoConfirmada:true,validadoEm:new Date().toISOString(),conferente:p.nome,evidencia});audit(s,'FT_DOCUMENTO_CONFERIDO',{documentoId:doc.id});await save(s);return {ok:true};
 }
 if(b.action==='FT_PEDRO_CLOSE'){
  if(role!=='PEDRO'||b.conferidoImpresso!==true)fail('Confirmação exclusiva do fechamento.');
  if(snapshot.c.destinoTipo==='GALPÃO')fail('Carga destinada ao estoque exige fechamento pelo MASTER.');
  billingReady(snapshot);const version=await digest(new TextEncoder().encode(billingVersion(snapshot)));
  if(snapshot.c.faturamentoFT?.version!==version)fail('Faturamento ainda não conferido ou alterado após a conferência.');
  if(snapshot.docs.filter(d=>billingCategories.includes(d.categoria)).some(d=>d.validationStatus!=='VALIDADO'))fail('Confira os documentos de faturamento antes de finalizar.');
  const out=applyWorkflow(s,{action:'PEDRO_CLOSE',requestId:crypto.randomUUID(),cargaId:id,conferidoImpresso:true,observacao:String(b.observacao||'').slice(0,500)}, {...p,perfil:'MASTER',user_id:uid},{id:crypto.randomUUID(),at:new Date().toISOString()});
  out.state.vendas=(out.state.vendas||[]).map(v=>v.cargaId===id?v:(s.vendas||[]).find(x=>x.id===v.id)||v);await save(out.state);return {ok:true};
 }
 fail('Ação não permitida neste escopo.');
}
