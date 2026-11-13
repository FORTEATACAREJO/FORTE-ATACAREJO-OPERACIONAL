"use strict";
(()=> {
const ORIGIN="https://tusmlfhzwlzwnoxfhomt.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_O99oIf3bXMIOkeh_XCpY6w_7OxD3FPI";
const MASTER="sistemasfortetech@gmail.com";
const STORAGE_KEY="sft-secure-admin-session";
const $=id=>document.getElementById(id);
const knownStates="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
let session=null, user=null, isMaster=false, selectedCompany=null, groups=[];
const messages={
 CNPJ_E_ESTABELECIMENTOS:"CNPJ e estabelecimentos",
 REGIME_TRIBUTARIO:"Regime tributário",CNAE_E_ATIVIDADE:"CNAE e atividade",
 RESPONSAVEL_FISCAL:"Responsável fiscal",CERTIFICADOS:"Certificados digitais",
 PRODUTOS_E_CLASSIFICACAO:"Produtos e classificações",
 REGRAS_VALIDAS:"Regras fiscais homologadas",TESTES_SEFAZ:"Testes SEFAZ"
};
function say(message,error=false){$("status").textContent=message;$("status").classList.toggle("bad",error);}
function showLogin(){session=null;user=null;isMaster=false;selectedCompany=null;sessionStorage.removeItem(STORAGE_KEY);$("login-area").hidden=false;$("dashboard").hidden=true;$("details").hidden=true;}
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
 selectedCompany=company;
 const container=$("detail-content");
 $("details").hidden=false;
 container.replaceChildren();
 textLine(container,"Empresa",company.legal_name);
 textLine(container,"Grupo empresarial",groups.find(g=>g.id===company.group_id)?.name||"Independente / não vinculado");
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
 const [parties,products,invites,memberships]=await Promise.all([
  table("company_parties?select=id&company_id=eq."+company.id),
  table("company_products?select=id&company_id=eq."+company.id),
  table("company_user_invitations?select=id,status,email,role,accepted_by&company_id=eq."+company.id),
  table("company_memberships?select=role&company_id=eq."+company.id+"&user_id=eq."+user.id)
 ]);
 const role=isMaster?"ADMIN":(memberships[0]?.role||"CONSULTA");
 $("onboarding-review-card").hidden=!["ADMIN","CONTADOR"].includes(role);
 const checkSelect=$("review-check");checkSelect.replaceChildren();
 for(const check of checks){
  const opt=document.createElement("option");opt.value=check.check_code;
  opt.textContent=(messages[check.check_code]||check.check_code)+" · "+check.status;
  checkSelect.append(opt);
 }
 function configureApprovalOption(){
  const critical=["CERTIFICADOS","REGRAS_VALIDAS","TESTES_SEFAZ"].includes(checkSelect.value);
  const option=$("review-status").querySelector('[value="CONFERIDO"]');
  option.disabled=!isMaster||critical;
  if(option.disabled&&$("review-status").value==="CONFERIDO")$("review-status").value="EM_ANALISE";
 }
 checkSelect.onchange=configureApprovalOption;
 configureApprovalOption();
 $("assign-group-card").hidden=!isMaster;
 if(isMaster){fillGroupSelect($("assign-group"),company.group_id||"");}
 $("branch-form").parentElement.hidden=role!=="ADMIN";
 $("party-form").parentElement.hidden=!["ADMIN","CONTADOR","OPERADOR"].includes(role);
 $("product-form").parentElement.hidden=!["ADMIN","CONTADOR"].includes(role);
 $("invite-form").parentElement.hidden=role!=="ADMIN";
 $("company-summary").replaceChildren();
 const summary=[
  "Clientes/fornecedores: "+parties.length,
  "Produtos e serviços: "+products.length,
  "Convites pendentes visíveis ao administrador: "+invites.filter(i=>i.status==="PENDENTE").length,
  "Seu perfil nesta empresa: "+role
 ];
 for(const line of summary){const el=document.createElement("p");el.textContent=line;$("company-summary").append(el);}
 if(role==="ADMIN"){
  const members=await table("company_memberships?select=user_id,role&company_id=eq."+company.id);
  const h=document.createElement("h3");h.textContent="Gerenciar usuários autorizados";$("company-summary").append(h);
  const map=new Map(invites.filter(i=>i.status==="ACEITO"&&i.accepted_by).map(i=>[i.accepted_by,i.email]));
  for(const m of members){
   const line=document.createElement("div");line.className="check";
   const label=document.createElement("p");label.textContent=(m.user_id===user.id?user.email:map.get(m.user_id)||"Usuário "+m.user_id.slice(0,8))+" · "+m.role;
   line.append(label);
   if(m.user_id!==user.id){
    const field=document.createElement("input");field.type="text";field.maxLength=400;field.placeholder="Motivo da revogação (mínimo 15 caracteres)";
    field.setAttribute("aria-label","Justificativa da revogação de acesso");
    const button=document.createElement("button");button.type="button";button.className="secondary";button.textContent="Revogar acesso";
    button.addEventListener("click",async()=>{
     if(field.value.trim().length<15){say("Informe uma justificativa com pelo menos 15 caracteres.",true);return;}
     if(!confirm("Revogar o acesso deste usuário à empresa selecionada?"))return;
     button.disabled=true;
     try{
      await rpc("revoke_company_user_access",{p_company_id:company.id,p_user_id:m.user_id,p_reason:field.value.trim()});
      await details(company);
      say("Acesso revogado e registrado na auditoria.");
     }catch(e){say("Não foi possível revogar: "+e.message,true);}
     finally{button.disabled=false;}
    });
    line.append(field,button);
   }
   $("company-summary").append(line);
  }
 }
 await loadIntegrationSettings(company,role);
}
const connectionKinds={
 BANK_API:"API bancária",OPEN_FINANCE:"Open Finance",BANK_FILE:"Arquivo bancário (OFX/CSV)",
 CARD_ACQUIRER:"Credenciadora de cartões",CARD_POS:"Maquininha / POS",CARD_GATEWAY:"Gateway de cartões",CARD_FILE:"Arquivo de conciliação de cartões",CARD_ISSUER:"Emissor de cartões empresariais",
 AI_PROVIDER:"Inteligência artificial"
};
async function loadIntegrationSettings(company,role){
 const box=$("integrations-card");
 if(!["ADMIN","CONTADOR"].includes(role)){box.hidden=true;return;}
 box.hidden=false;
 const [connections,agents,requests,accounts,merchants,sales,receivables,adjustments,settlements,establishments,corpCards,corpStatements,corpExpenses]=await Promise.all([
  table("integration_connections?select=id,kind,provider_name,display_name,status,environment,credential_status&company_id=eq."+company.id+"&order=created_at.desc"),
  table("ai_agent_profiles?select=id,label,purpose,status,connection_id&company_id=eq."+company.id+"&order=created_at.desc"),
  table("ai_assistance_requests?select=id,task_type,state,created_at&company_id=eq."+company.id+"&order=created_at.desc&limit=30"),
  table("bank_account_profiles?select=id,bank_name,account_label,status&company_id=eq."+company.id+"&limit=40"),
  table("card_merchant_profiles?select=id,merchant_label,terminal_label,status&company_id=eq."+company.id+"&limit=100"),
  table("card_sales?select=id,sale_on,modality,gross_brl&company_id=eq."+company.id+"&order=sale_on.desc&limit=50"),
  table("card_receivable_installments?select=id,due_on,net_brl,reconciliation_state&company_id=eq."+company.id+"&order=due_on.asc&limit=50"),
  table("card_adjustment_events?select=id,event_type,amount_brl&company_id=eq."+company.id+"&limit=50"),
  table("card_settlement_batches?select=id,net_brl,state&company_id=eq."+company.id+"&limit=50"),
  table("establishments?select=id,cnpj,legal_name,state&company_id=eq."+company.id+"&order=cnpj.asc"),
  table("corporate_card_profiles?select=id,card_label,card_last4,status&company_id=eq."+company.id+"&limit=100"),
  table("corporate_card_statements?select=id,due_on,invoice_total_brl,reconciliation_state&company_id=eq."+company.id+"&order=due_on.desc&limit=50"),
  table("corporate_card_expenses?select=id,booked_on,amount_brl&company_id=eq."+company.id+"&order=booked_on.desc&limit=50")
 ]);
 $("integration-create-card").hidden=role!=="ADMIN";
 const cardConnections=connections.filter(c=>["CARD_ACQUIRER","CARD_POS","CARD_GATEWAY","CARD_FILE"].includes(c.kind));
 $("card-merchant-create-card").hidden=role!=="ADMIN"||!cardConnections.length||!establishments.length;
 const cardConnEl=$("card-merchant-connection");
 cardConnEl.replaceChildren();
 for(const c of cardConnections){const opt=document.createElement("option");opt.value=c.id;opt.textContent=c.display_name+" · "+c.provider_name;cardConnEl.append(opt);}
 const cardEstEl=$("card-merchant-establishment");
 cardEstEl.replaceChildren();
 for(const e of establishments){const opt=document.createElement("option");opt.value=e.id;opt.textContent=e.legal_name+" · "+e.state+" · "+e.cnpj;cardEstEl.append(opt);}
 const issuerConnections=connections.filter(c=>c.kind==="CARD_ISSUER");
 $("corporate-card-create-card").hidden=role!=="ADMIN"||!issuerConnections.length||!establishments.length;
 const issuerConnEl=$("corporate-card-connection");
 issuerConnEl.replaceChildren();
 for(const c of issuerConnections){const opt=document.createElement("option");opt.value=c.id;opt.textContent=c.display_name+" · "+c.provider_name;issuerConnEl.append(opt);}
 const corpEstEl=$("corporate-card-establishment");
 corpEstEl.replaceChildren();
 for(const e of establishments){const opt=document.createElement("option");opt.value=e.id;opt.textContent=e.legal_name+" · "+e.state+" · "+e.cnpj;corpEstEl.append(opt);}
 const corporateSummary=$("corporate-card-summary");corporateSummary.replaceChildren();
 const cr=document.createElement("p");cr.textContent="Cartões empresariais: "+corpCards.length+
 " · Faturas importadas (até 50): "+corpStatements.length+
 " · Despesas importadas (até 50): "+corpExpenses.length;
 corporateSummary.append(cr);
 for(const st of corpStatements.slice(0,5)){
  const line=document.createElement("p");line.className="check";
  line.textContent="Fatura com vencimento em "+st.due_on+" · R$ "+st.invoice_total_brl+" · "+st.reconciliation_state;
  corporateSummary.append(line);
 }
 const cs=$("card-receivables-summary");
 cs.replaceChildren();
 const cp=document.createElement("p");
 cp.textContent="Vínculos com operadoras: "+merchants.length+" · Vendas importadas (até 50): "+sales.length+
 " · Parcelas previstas (até 50): "+receivables.length+
 " · Ajustes/estornos (até 50): "+adjustments.length+" · Repasses bancários (até 50): "+settlements.length;
 cs.append(cp);
 const expl=document.createElement("p");expl.className="muted";
 expl.textContent="Nenhuma cobrança é realizada por esta tela. Valores, taxas, agenda e conciliações devem vir da adquirente homologada; todas as baixas exigem conferência.";
 cs.append(expl);
 for(const item of receivables.slice(0,5)){
  const el=document.createElement("p");el.className="check";
  el.textContent="Recebível previsto "+item.due_on+" · líquido R$ "+item.net_brl+" · "+item.reconciliation_state;
  cs.append(el);
 }
 $("ai-agent-create-card").hidden=role!=="ADMIN";
 $("ai-request-create-card").hidden=agents.length===0;
 const providerSelect=$("ai-agent-provider");
 providerSelect.replaceChildren();
 const empty=document.createElement("option");empty.value="";empty.textContent="Ainda sem provedor";providerSelect.append(empty);
 for(const c of connections.filter(c=>c.kind==="AI_PROVIDER")){
  const option=document.createElement("option");option.value=c.id;option.textContent=c.display_name+" · "+c.provider_name;providerSelect.append(option);
 }
 const agentSelect=$("ai-request-agent");
 agentSelect.replaceChildren();
 for(const a of agents){
  const option=document.createElement("option");option.value=a.id;option.textContent=a.label+" · "+a.status;agentSelect.append(option);
 }
 const summary=$("integrations-overview");summary.replaceChildren();
 const text=document.createElement("p");text.className="muted";
 text.textContent="Conexões previstas: "+connections.length+
 " · Agentes de IA inativos: "+agents.length+
 " · Contas bancárias ligadas: "+accounts.length+
 " · Credenciadoras/lojas: "+merchants.length+
 " · Cartões empresariais: "+corpCards.length+
 " · Solicitações de IA aguardando configuração: "+requests.length;
 summary.append(text);
 const list=$("integration-list");list.replaceChildren();
 const display=[...connections.map(c=>({
 title:c.display_name,detail:(connectionKinds[c.kind]||c.kind)+" · "+c.provider_name,
 status:c.status+" · credenciais "+c.credential_status
 })),...agents.map(a=>({title:a.label,detail:"Agente de IA · "+a.purpose.replaceAll("_"," "),
 status:a.status+" · revisão humana obrigatória"}))];
 if(!display.length){const p=document.createElement("p");p.className="muted";
 p.textContent="Nenhuma integração configurada. Inicie pelo cadastro de uma conexão em sandbox, sem informar credenciais.";list.append(p);}
 for(const item of display){
  const p=document.createElement("p");p.className="check";
  const strong=document.createElement("strong");strong.textContent=item.title;
  const small=document.createElement("small");small.className="state";
  small.textContent=" · "+item.detail+" · "+item.status;
  p.append(strong,small);list.append(p);
 }
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
 groups=isMaster?await table("business_groups?select=id,name&order=name.asc"):[];
 $("group-card").hidden=!isMaster;
 if(isMaster){fillGroupSelect($("company-group"),"");const gl=$("groups-list");gl.replaceChildren();for(const g of groups){const row=document.createElement("p");row.textContent=g.name;gl.append(row);}}
 const companies=await table("companies?select=id,group_id,legal_name,cnpj_root,tax_regime,industry_sector,onboarding_status&order=legal_name.asc");
 renderCompanies(companies);
 if(selectedCompany&&!companies.some(c=>c.id===selectedCompany.id)){$("details").hidden=true;selectedCompany=null;}
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
   body:{email,create_user:true}
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
  p_group_id:$("company-group").value||null,
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

const branchState=$("branch-uf");
for(const code of knownStates){const opt=document.createElement("option");opt.value=code;opt.textContent=code;branchState.append(opt);}
branchState.value="MG";
function requireCompany(){if(!selectedCompany)throw new Error("Selecione primeiro uma empresa autorizada.");return selectedCompany;}
async function insertRow(tableName,payload){
 return request("/rest/v1/"+tableName,{auth:true,method:"POST",body:payload});
}
function onForm(formId,fn){
 $(formId).addEventListener("submit",async e=>{
  e.preventDefault();
  const button=e.currentTarget.querySelector("button");
  button.disabled=true;
  try{await fn(e.currentTarget);}
  catch(ex){say("Operação não concluída: "+ex.message,true);}
  finally{button.disabled=false;}
 });
}
function fillGroupSelect(el,selected){
 el.replaceChildren();
 const empty=document.createElement("option");empty.value="";empty.textContent="Nenhum grupo — empresa independente";el.append(empty);
 for(const g of groups){const opt=document.createElement("option");opt.value=g.id;opt.textContent=g.name;el.append(opt);}
 el.value=selected||"";
}
onForm("integration-connection-form",async form=>{
 const company=requireCompany();
 const kind=$("integration-kind").value;
 if(!["BANK_API","OPEN_FINANCE","BANK_FILE","CARD_ACQUIRER","CARD_POS","CARD_GATEWAY","CARD_FILE","CARD_ISSUER","AI_PROVIDER"].includes(kind))throw new Error("Modalidade inválida");
 const scopes=kind==="BANK_FILE"?["ARQUIVOS_OFX_CSV"]:
  kind==="AI_PROVIDER"?["ASSISTENTE_CADASTROS"]:
  kind==="CARD_FILE"?["ARQUIVOS_CONCILIACAO_CARTAO"]:
  kind==="CARD_ISSUER"?["CONSULTA_FATURAS_CORPORATIVAS","CONSULTA_DESPESAS_CORPORATIVAS","CONSULTA_PAGAMENTOS_FATURA"]:
  ["CARD_ACQUIRER","CARD_POS","CARD_GATEWAY"].includes(kind)?
  ["CONSULTA_VENDAS_CARTAO","CONSULTA_RECEBIVEIS_CARTAO","CONSULTA_TAXAS_CARTAO","CONSULTA_ESTORNOS_CONTESTACOES"]:
  ["CONSULTA_SALDO","CONSULTA_EXTRATO"];
 await insertRow("integration_connections",{
  company_id:company.id,kind,
  provider_name:$("integration-provider").value.trim(),
  display_name:$("integration-name").value.trim(),
  environment:"SANDBOX",status:"RASCUNHO",
  requested_scopes:scopes,
  created_by:user.id
 });
 form.reset();await details(company);
 say("Conexão preparada em sandbox. Não foram vinculadas credenciais nem dados bancários.");
});
onForm("card-merchant-form",async form=>{
 const company=requireCompany();
 const connectionId=$("card-merchant-connection").value;
 const establishmentId=$("card-merchant-establishment").value;
 if(!connectionId||!establishmentId)throw new Error("Cadastre antes uma conexão de cartão e selecione o estabelecimento.");
 await insertRow("card_merchant_profiles",{
  company_id:company.id,connection_id:connectionId,establishment_id:establishmentId,
  merchant_label:$("card-merchant-label").value.trim(),
  terminal_label:$("card-terminal-label").value.trim()||null,
  provider_merchant_reference:null,settlement_bank_account_id:null,
  status:"AGUARDANDO_VINCULO"
 });
 form.reset();await details(company);
 say("Vínculo da operadora/maquininha registrado sem credenciais. Nenhum pagamento foi realizado.");
});
onForm("corporate-card-form",async form=>{
 const company=requireCompany();
 const connectionId=$("corporate-card-connection").value;
 const establishmentId=$("corporate-card-establishment").value;
 if(!connectionId||!establishmentId)throw new Error("Cadastre antes um emissor de cartão e selecione um estabelecimento.");
 const last4=$("corporate-card-last4").value.trim();
 if(last4&&!/^[0-9]{4}$/.test(last4))throw new Error("Informe somente quatro últimos dígitos.");
 await insertRow("corporate_card_profiles",{
  company_id:company.id,connection_id:connectionId,establishment_id:establishmentId,
  card_label:$("corporate-card-label").value.trim(),
  card_last4:last4||null,
  holder_label:null,
  status:"AGUARDANDO_VINCULO"
 });
 form.reset();await details(company);
 say("Cartão empresarial cadastrado sem credenciais e sem consultar faturas reais.");
});
onForm("ai-agent-form",async form=>{
 const company=requireCompany();
 const label=$("ai-agent-label").value.trim(), purpose=$("ai-agent-purpose").value;
 const connectionId=$("ai-agent-provider").value||null;
 await insertRow("ai_agent_profiles",{
  company_id:company.id,connection_id:connectionId,
  label,purpose,created_by:user.id,status:"PLANEJADO"
 });
 form.reset();await details(company);
 say("Agente de IA criado inativo, com revisão humana e sem envio de dados externos.");
});
onForm("ai-request-form",async form=>{
 const company=requireCompany();
 await insertRow("ai_assistance_requests",{
  company_id:company.id,agent_id:$("ai-request-agent").value,
  requested_by:user.id,task_type:$("ai-request-type").value,
  record_kind:"EMPRESA",record_id:company.id,
  state:"AGUARDANDO_CONFIGURACAO"
 });
 form.reset();await details(company);
 say("Solicitação registrada como pendente. Nenhuma requisição foi enviada a uma IA externa.");
});
onForm("onboarding-review-form",async form=>{
 const company=requireCompany();
 if(!["PENDENTE","EM_ANALISE","CONFERIDO"].includes($("review-status").value))
 throw new Error("Etapa inválida.");
 const code=$("review-check").value,status=$("review-status").value,
 evidence=$("review-evidence").value.trim();
 if(status==="CONFERIDO" && evidence.length<15)
 throw new Error("A conferência final exige fundamentação de pelo menos 15 caracteres.");
 await rpc("review_company_onboarding_check",{
  p_company_id:company.id,p_check_code:code,p_new_status:status,p_evidence:evidence||null
 });
 company.onboarding_status="EM_CONFIGURACAO";
 form.reset();await details(company);
 say("Revisão registrada. Emissão fiscal continua bloqueada até homologação.");
});
onForm("group-form",async form=>{
 if(!isMaster)throw new Error("Somente Master pode cadastrar grupos empresariais.");
 const name=$("group-name").value.trim();
 if(name.length<3)throw new Error("Informe um nome de grupo válido.");
 await insertRow("business_groups",{name});
 form.reset();await load();say("Grupo empresarial criado; cada empresa permanece juridicamente independente.");
});
onForm("assign-group-form",async()=>{
 const company=requireCompany();
 if(!isMaster)throw new Error("Somente Master pode vincular empresas a grupos.");
 const groupId=$("assign-group").value||null;
 await request("/rest/v1/companies?id=eq."+company.id,{
  auth:true,method:"PATCH",body:{group_id:groupId}
 });
 company.group_id=groupId;
 await load();await details(company);
 say(groupId?"Empresa vinculada ao grupo. CNPJ, estoque e operações permanecem independentes.":"Empresa desvinculada do grupo.");
});

onForm("branch-form",async form=>{
 const company=requireCompany();
 const cnpj=validateCnpj($("branch-cnpj").value);
 if(!cnpj||cnpj.slice(0,8)!==company.cnpj_root)throw new Error("O CNPJ da filial deve ser válido e possuir a mesma raiz da empresa.");
 const city=$("branch-city").value.trim();
 await insertRow("establishments",{
  company_id:company.id,cnpj,state:$("branch-uf").value,legal_name:$("branch-name").value.trim(),
  city,state_registration:$("branch-ie").value.trim()||null,
  address:{city},is_headquarters:false
 });
 form.reset();branchState.value="MG";
 await details(company);
 say("Filial adicionada com estoque inicial zero e emissão fiscal bloqueada.");
});
onForm("party-form",async form=>{
 const company=requireCompany();
 const kind=$("party-kind").value;
 const raw=$("party-document").value.trim();
 const documentNumber=kind==="CNPJ"?validateCnpj(raw):kind==="CPF"?raw.replace(/\D/g,""):raw;
 if(!documentNumber||kind==="CPF"&&!/^\d{11}$/.test(documentNumber))throw new Error("Documento inválido. Confira os dígitos.");
 const role=$("party-role").value;
 await insertRow("company_parties",{
  company_id:company.id,legal_name:$("party-name").value.trim(),
  document_kind:kind,document:documentNumber,
  is_customer:role==="CUSTOMER"||role==="BOTH",
  is_supplier:role==="SUPPLIER"||role==="BOTH",
  is_service_provider:role==="SERVICE_PROVIDER",
  created_by:user.id
 });
 form.reset();await details(company);
 say("Cliente/fornecedor cadastrado somente para esta empresa; classificação fiscal pendente.");
});
onForm("product-form",async form=>{
 const company=requireCompany();
 const kind=$("product-kind").value;
 const ncm=$("product-ncm").value.trim(),cest=$("product-cest").value.trim();
 if(ncm&&!/^[0-9]{8}$/.test(ncm))throw new Error("NCM deve conter 8 dígitos.");
 if(cest&&!/^[0-9]{7}$/.test(cest))throw new Error("CEST deve conter 7 dígitos.");
 await insertRow("company_products",{
  company_id:company.id,sku:$("product-sku").value.trim(),description:$("product-name").value.trim(),
  category:$("product-category").value.trim(),item_kind:kind,
  commercial_unit:kind==="SERVICO"?"SV":"UN",ncm:ncm||null,cest:cest||null,
  classification_status:"PENDENTE_REVISAO"
 });
 form.reset();await details(company);
 say(kind==="SERVICO"?"Serviço cadastrado sem estoque físico.":"Mercadoria cadastrada com saldo inicial zero.");
});
onForm("invite-form",async form=>{
 const company=requireCompany();
 const email=$("invite-email").value.trim().toLowerCase(),role=$("invite-role").value;
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error("E-mail inválido");
 await insertRow("company_user_invitations",{
  company_id:company.id,email,role,invited_by:user.id,
  status:"PENDENTE",establishment_ids:null
 });
 form.reset();await details(company);
 say("Convite registrado. Informe ao colaborador que ele deve acessar o painel, confirmar seu e-mail e aceitar o convite.");
});
$("accept-invites").addEventListener("click",async()=>{
 try{
  const num=await rpc("accept_my_company_invitations");
  await load();
  say(num>0?num+" convite(s) aceito(s) para esta conta.":"Nenhum convite pendente para este e-mail confirmado.");
 }catch(e){say("Não foi possível aceitar convites: "+e.message,true);}
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
