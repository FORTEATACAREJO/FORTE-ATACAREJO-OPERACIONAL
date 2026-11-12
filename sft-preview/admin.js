"use strict";
(()=> {
const ORIGIN="https://tusmlfhzwlzwnoxfhomt.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_O99oIf3bXMIOkeh_XCpY6w_7OxD3FPI";
const MASTER="sistemasfortetech@gmail.com";
const STORAGE_KEY="sft-secure-admin-session";
const $=id=>document.getElementById(id);
const knownStates="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
let session=null, user=null, isMaster=false;
const messages={
 CNPJ_E_ESTABELECIMENTOS:"CNPJ e estabelecimentos",
 REGIME_TRIBUTARIO:"Regime tributário",CNAE_E_ATIVIDADE:"CNAE e atividade",
 RESPONSAVEL_FISCAL:"Responsável fiscal",CERTIFICADOS:"Certificados digitais",
 PRODUTOS_E_CLASSIFICACAO:"Produtos e classificações",
 REGRAS_VALIDAS:"Regras fiscais homologadas",TESTES_SEFAZ:"Testes SEFAZ"
};
function say(message,error=false){$("status").textContent=message;$("status").classList.toggle("bad",error);}
function showLogin(){session=null;user=null;isMaster=false;sessionStorage.removeItem(STORAGE_KEY);$("login-area").hidden=false;$("dashboard").hidden=true;}
function storeSession(s){
 if(!s || typeof s.access_token!=="string" || typeof s.refresh_token!=="string")throw new Error("Resposta de autenticação incompleta.");
 const expiresIn=Number(s.expires_in)||3600;
 session={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+expiresIn};
 sessionStorage.setItem(STORAGE_KEY,JSON.stringify(session));
}
function parseLoginLink(){
 const p=new URLSearchParams(location.hash.slice(1));
 const query=new URLSearchParams(location.search);
 const err=p.get("error_description")||query.get("error_description");
 if(err){history.replaceState(null,"",location.pathname);say("Não foi possível entrar: "+err,true);return;}
 if(p.has("access_token") && p.has("refresh_token")){
  const access=p.get("access_token"),refresh=p.get("refresh_token");
  const expires=Number(p.get("expires_in"))||3600;
  storeSession({access_token:access,refresh_token:refresh,expires_in:expires});
  history.replaceState(null,"",location.pathname);
 }
}
async function request(path, options={}){
 const headers={apikey:PUBLISHABLE_KEY,"Content-Type":"application/json"};
 if(options.auth===true){
  if(!session)throw new Error("Acesso não autenticado.");
  if(session.expires_at<Math.floor(Date.now()/1000)+60){
   const next=await request("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:session.refresh_token}});
   storeSession(next);
  }
  headers.Authorization="Bearer "+session.access_token;
 }
 const response=await fetch(ORIGIN+path,{method:options.method||"GET",headers,body:options.body===undefined?undefined:JSON.stringify(options.body),cache:"no-store",referrerPolicy:"no-referrer"});
 const raw=await response.text();
 let payload;try{payload=raw?JSON.parse(raw):null;}catch{payload={message:raw.slice(0,160)};}
 if(!response.ok)throw new Error(payload?.msg||payload?.message||payload?.error_description||payload?.error||"HTTP "+response.status);
 return payload;
}
function rpc(name,body={}){return request("/rest/v1/rpc/"+name,{method:"POST",auth:true,body});}
function table(path){return request("/rest/v1/"+path,{auth:true});}
function validateCnpj(input){
 const s=input.toUpperCase().replace(/[^A-Z0-9]/g,"");
 if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(s)||/^(\d)\1{13}$/.test(s))return null;
 const values=[...s.slice(0,12)].map(ch=>ch.charCodeAt(0)-48);
 const digit=weights=>{let x=weights.reduce((sum,w,i)=>sum+values[i]*w,0);let d=11-x%11;return d>=10?0:d;};
 const first=digit([5,4,3,2,9,8,7,6,5,4,3,2]);
 values.push(first);
 const second=digit([6,5,4,3,2,9,8,7,6,5,4,3,2]);
 return s.slice(12)==String(first)+String(second)?s:null;
}
const state=$("company-state");
for(const value of knownStates){const option=document.createElement("option");option.value=value;option.textContent=value;state.append(option);}
state.value="MG";
async function activate(){
 if(!user||user.email?.toLowerCase()!==MASTER)throw new Error("Este e-mail não está autorizado como Master.");
 await rpc("activate_master");
 await load();
 say("Master ativado para o e-mail autorizado.");
}
function textLine(parent,heading,text){
 const p=document.createElement("p");const strong=document.createElement("strong");strong.textContent=heading+": ";p.append(strong,document.createTextNode(text??"—"));parent.append(p);
}
async function details(company){
 const container=$("detail-content");
 $("details").hidden=false;
 container.replaceChildren();
 textLine(container,"Empresa",company.legal_name);
 textLine(container,"CNPJ raiz",company.cnpj_root);
 textLine(container,"Regime",company.tax_regime);
 textLine(container,"Atividade",company.industry_sector);
 textLine(container,"Fase",company.onboarding_status);
 const [estabs,checks]=await Promise.all([
  table("establishments?select=cnpj,state,legal_name,city,fiscal_readiness&company_id=eq."+company.id+"&order=cnpj.asc"),
  table("company_onboarding_checks?select=check_code,status&company_id=eq."+company.id+"&order=check_code.asc")
 ]);
 const h1=document.createElement("h3");h1.textContent="Estabelecimentos";container.append(h1);
 if(estabs.length===0){textLine(container,"Unidades","Nenhuma");}else{
  for(const item of estabs){textLine(container,item.state+" · "+(item.city||""),item.cnpj+" · "+item.fiscal_readiness);}
 }
 const h2=document.createElement("h3");h2.textContent="Lista de verificação";container.append(h2);
 for(const check of checks){
  const p=document.createElement("div");p.className="check";
  const title=document.createElement("span");title.textContent=messages[check.check_code]||check.check_code;
  const status=document.createElement("small");status.className="state";status.textContent=" · "+check.status;
  p.append(title,status);container.append(p);
 }
 const notice=document.createElement("p");notice.className="muted";
 notice.textContent="Todas as empresas permanecem com emissão fiscal real bloqueada.";
 container.append(notice);
}
function renderCompanies(companies){
 const node=$("companies");node.replaceChildren();
 if(!companies.length){const p=document.createElement("p");p.className="muted";p.textContent="Nenhuma empresa cadastrada e autorizada.";node.append(p);return;}
 for(const c of companies){
  const div=document.createElement("div");div.className="company";
  const name=document.createElement("strong");name.textContent=c.legal_name;
  const txt=document.createElement("p");txt.className="muted";txt.textContent=[c.cnpj_root,c.tax_regime.replaceAll("_"," "),c.industry_sector.replaceAll("_"," ")].join(" · ");
  const btn=document.createElement("button");btn.type="button";btn.className="secondary";btn.textContent="Ver estabelecimento e pendências";
  btn.addEventListener("click",async()=>{try{await details(c);}catch(e){say(e.message,true);}});
  div.append(name,txt,btn);node.append(div);
 }
}
async function load(){
 const u=await request("/auth/v1/user",{auth:true});
 user=u;
 isMaster=await rpc("is_platform_master");
 $("login-area").hidden=true;$("dashboard").hidden=false;
 $("identity").textContent="Conta: "+(user.email||"E-mail não informado");
 $("role").textContent=isMaster?"Master Sistemas Forte Tech":"Usuário autenticado";
 $("activate").hidden=isMaster||user.email?.toLowerCase()!==MASTER;
 $("create-card").hidden=!isMaster;
 const companies=await table("companies?select=id,legal_name,cnpj_root,tax_regime,industry_sector,onboarding_status&order=legal_name.asc");
 renderCompanies(companies);
 say(isMaster?"Painel Master conectado ao banco exclusivo.":"Acesso identificado. Mostrando apenas empresas autorizadas.");
}
$("otp-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const email=$("otp-email").value.trim().toLowerCase();
 const button=e.currentTarget.querySelector("button");
 button.disabled=true;
 try{
  await request("/auth/v1/otp?redirect_to="+encodeURIComponent(location.origin+"/admin.html"),{
   method:"POST",
   body:{email,create_user:email===MASTER}
  });
  say("Solicitação enviada. Abra o e-mail de acesso no mesmo navegador. Caso o link não retorne ao painel, verifique as URLs de redirecionamento autorizadas no Supabase.");
 }catch(err){say("Falha no envio: "+err.message,true);}
 finally{button.disabled=false;}
});
$("activate").addEventListener("click",async()=>{try{await activate();}catch(err){say(err.message,true);}});
$("refresh").addEventListener("click",async()=>{try{await load();}catch(err){say(err.message,true);}});
$("logout").addEventListener("click",async()=>{
 try{if(session)await request("/auth/v1/logout",{method:"POST",auth:true});}catch{}
 showLogin();say("Sessão encerrada neste navegador.");
});
$("company-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!isMaster){say("Somente Master pode cadastrar empresas.",true);return;}
 const cnpj=validateCnpj($("company-cnpj").value);
 if(!cnpj){say("Confira o CNPJ completo e os dígitos verificadores.",true);return;}
 const body={
  p_legal_name:$("company-name").value.trim(),
  p_cnpj:cnpj,
  p_uf:$("company-state").value,
  p_city:$("company-city").value.trim(),
  p_tax_regime:$("company-regime").value,
  p_industry_sector:$("company-sector").value,
  p_group_id:null,
  p_state_registration:null,
  p_cnae_primary:$("company-cnae").value.trim()||null
 };
 const button=e.currentTarget.querySelector("button");button.disabled=true;
 try{
  await rpc("bootstrap_company_v2",body);
  e.target.reset();state.value="MG";
  await load();
  say("Empresa cadastrada para configuração, sem estoque ou emissão fiscal habilitada.");
 }catch(err){say("Cadastro não concluído: "+err.message,true);}
 finally{button.disabled=false;}
});
try{
 parseLoginLink();
 if(!session){
  const saved=sessionStorage.getItem(STORAGE_KEY);
  if(saved)session=JSON.parse(saved);
 }
 if(session)load().catch(e=>{showLogin();say("Entre novamente: "+e.message,true);});
}catch(e){showLogin();say("Não foi possível iniciar a sessão: "+e.message,true);}
})();
