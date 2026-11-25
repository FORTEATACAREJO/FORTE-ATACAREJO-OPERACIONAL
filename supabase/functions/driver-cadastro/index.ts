import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {fields,documents,validateFields,identifyFile,maxFile,maxBody,validToken} from './validation.mjs';
const origins=new Set(['https://pedidos-ft.onrender.com','https://forte-vendas.onrender.com']);
const url=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='forte-driver-intake';
const hash=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
class Fault extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const check=(r:any)=>{if(r.error)throw new Error('Falha interna de persistência.');return r.data;};
async function readBounded(req:Request){
 const len=Number(req.headers.get('content-length')||0);if(len>maxBody)throw new Fault(413,'Envie até 12 MB por etapa.');
 const reader=req.body?.getReader();if(!reader)throw new Fault(400,'Envio vazio.');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBody){await reader.cancel();throw new Fault(413,'Envie até 12 MB por etapa.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return new Response(bytes,{headers:{'content-type':req.headers.get('content-type')||''}});
}
async function admin(req:Request){
 const jwt=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!jwt)throw new Fault(401,'Entre no FORTE OP.');
 const u=await db.auth.getUser(jwt);if(u.error||!u.data.user)throw new Fault(401,'Sessão inválida.');
 const p=check(await db.from('fc_perfis').select('user_id,empresa_id,perfil,ativo,trocar_senha,status_aprovacao').eq('user_id',u.data.user.id).maybeSingle());
 if(!p||!p.ativo||p.trocar_senha||p.status_aprovacao!=='APROVADO'||!['MASTER','ADMINISTRADOR'].includes(p.perfil))throw new Fault(403,'Acesso restrito à administração.');
 const scoped=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
 const gate=await scoped.rpc('access_current_module',{p_app:'vendas'});if(gate.error||!gate.data?.allowed||!['MASTER','ADMINISTRADOR'].includes(gate.data.role))throw new Fault(403,'Acesso administrativo não autorizado para este módulo.');
 const permission=await scoped.rpc('fc_operacao_autorizada');if(permission.error||permission.data!==true)throw new Fault(403,'Aplicativo sem aprovação operacional.');
 return p;
}
async function linkFor(req:Request){
 const t=req.headers.get('x-cadastro-token');if(!validToken(t))throw new Fault(403,'Link inválido ou expirado.');
 const l=check(await db.from('fc_driver_intake_links').select('id,empresa_id,expira_em,revogado_em').eq('token_hash',await hash(t!)).maybeSingle());
 if(!l||l.revogado_em||Date.parse(l.expira_em)<=Date.now())throw new Fault(403,'Link inválido ou expirado.');
 return l;
}
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-cadastro-token, x-cadastro-action','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Type':'application/json'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply({error:'Origem não autorizada.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método inválido.'},405);
 try{
  const action=req.headers.get('x-cadastro-action');
  if(action==='CHECK'){await linkFor(req);return reply({ok:true});}
  if(action==='SUBMIT'){
   const l=await linkFor(req);
   const body=await readBounded(req),form=await body.formData();
   let data;try{data=validateFields(JSON.parse(String(form.get('dados')||'{}')));}catch(e){throw new Fault(400,e instanceof Error?e.message:'Dados inválidos.');}
   const uploads:any[]=[];const seen=new Set<string>();
   for(const [name,value] of form.entries()){
    if(name==='dados')continue;
    if(!Object.hasOwn(documents,name)||typeof value==='string'||seen.has(name)||!value.size||value.size>maxFile)throw new Fault(400,'Anexo inválido. Limite de 6 MB por arquivo.');
    seen.add(name);const bytes=new Uint8Array(await value.arrayBuffer());let kind;try{kind=identifyFile(bytes);}catch(e){throw new Fault(400,(e as Error).message);}
    uploads.push({name,bytes,...kind});
   }
   if(!Object.keys(data).length&&!uploads.length)throw new Fault(400,'Preencha algum dado ou anexe um documento.');
   const used=check(await db.from('fc_driver_intake_submissions').select('slot').eq('link_id',l.id));
   const slot=Array.from({length:12},(_,i)=>i+1).find(i=>!used.some((x:any)=>x.slot===i));
   if(!slot)throw new Fault(409,'Limite de etapas atingido. Solicite novo link à FORTE.');
   const id=crypto.randomUUID(),saved=await db.from('fc_driver_intake_submissions').insert({id,link_id:l.id,slot,dados:data});
   if(saved.error){if(saved.error.code==='23505')throw new Fault(409,'Outro envio em andamento. Tente novamente.');throw new Error('Falha ao reservar envio.');}
   const uploaded:string[]=[];const docs:any[]=[];
   try{
    for(const f of uploads){const path=l.empresa_id+'/'+l.id+'/'+id+'/'+f.name+'.'+f.ext;
     check(await db.storage.from(bucket).upload(path,f.bytes,{contentType:f.mime,upsert:false}));uploaded.push(path);docs.push({tipo:f.name,path,mime:f.mime});
    }
    await linkFor(req);
    check(await db.from('fc_driver_intake_submissions').update({status:'RECEBIDO',arquivos:docs}).eq('id',id).eq('status','RESERVADO').select('id').single());
   }catch(e){if(uploaded.length)await db.storage.from(bucket).remove(uploaded);await db.from('fc_driver_intake_submissions').delete().eq('id',id).eq('status','RESERVADO');throw e;}
   return reply({ok:true,protocolo:id});
  }
  const p=await admin(req),body=await readBounded(req),b=await body.json();
  if(action==='CREATE'||action==='LIST'){
   const driverId=String(b.motoristaId||'');if(!driverId||driverId.length>150)throw new Fault(400,'Selecione o motorista.');
   const state=check(await db.from('fc_app_state').select('estado').eq('empresa_id',p.empresa_id).maybeSingle());
   const exists=state?.estado?.motoristas?.some((m:any)=>m.id===driverId);
   if(!exists)throw new Fault(404,'Motorista não localizado nesta empresa.');
   if(action==='CREATE'){
    const t=token(),expiry=new Date(Date.now()+7*86400000).toISOString();
    const item=check(await db.from('fc_driver_intake_links').insert({empresa_id:p.empresa_id,motorista_id:driverId,criado_por:p.user_id,token_hash:await hash(t),expira_em:expiry}).select('id,expira_em').single());
    return reply({id:item.id,expiraEm:expiry,link:'https://pedidos-ft.onrender.com/cadastro-motorista.html#'+t});
   }
   const links=check(await db.from('fc_driver_intake_links').select('id,criado_em,expira_em,revogado_em').eq('empresa_id',p.empresa_id).eq('motorista_id',driverId).order('criado_em',{ascending:false}).limit(30));
   const submissions=links.length?check(await db.from('fc_driver_intake_submissions').select('id,link_id,criado_em,dados,arquivos').in('link_id',links.map((l:any)=>l.id)).eq('status','RECEBIDO').order('criado_em',{ascending:false})):[];return reply({links,submissions});
  }
  if(action==='REVOKE'){
   check(await db.from('fc_driver_intake_links').update({revogado_em:new Date().toISOString()}).eq('id',b.id).eq('empresa_id',p.empresa_id).select('id').single());return reply({ok:true});
  }
  if(action==='DOWNLOAD'){
   const sub=check(await db.from('fc_driver_intake_submissions').select('link_id,arquivos').eq('id',b.id).eq('status','RECEBIDO').maybeSingle());
   if(!sub)throw new Fault(404,'Arquivo indisponível.');
   const l=check(await db.from('fc_driver_intake_links').select('id').eq('id',sub.link_id).eq('empresa_id',p.empresa_id).maybeSingle());
   const doc=l&&sub.arquivos.find((x:any)=>x.tipo===b.tipo);
   if(!doc)throw new Fault(404,'Arquivo indisponível.');
   const signed=check(await db.storage.from(bucket).createSignedUrl(doc.path,60,{download:true}));return reply({url:signed.signedUrl});
  }
  throw new Fault(400,'Ação inválida.');
 }catch(e){return reply({error:e instanceof Fault?e.message:'Não foi possível concluir. Tente novamente ou fale com a FORTE.'},e instanceof Fault?e.status:500);}
});
