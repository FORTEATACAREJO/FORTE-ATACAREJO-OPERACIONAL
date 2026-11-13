"use strict";
(()=> {
const ORIGIN="https://tusmlfhzwlzwnoxfhomt.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_O99oIf3bXMIOkeh_XCpY6w_7OxD3FPI";
const MASTER="sistemasfortetech@gmail.com";
const STORAGE_KEY="sft-secure-admin-session";
const $=id=>document.getElementById(id);
const knownStates="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
let session=null, user=null, isMaster=false, selectedCompany=null, groups=[],licensedSystems=[];
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
function toBrazilDate(date){
 return new Date(date.getTime()-3*3600*1000).toISOString().slice(0,10);
}
async function showCompanyLicense(company){
 const el=$("license-status"),systemsEl=$("license-other-systems");
 el.textContent="Verificando a licença no servidor...";
 systemsEl.replaceChildren();
 $("license-master-form-card").hidden=!isMaster;
 const records=[];
 for(const system of licensedSystems){
  const status=await rpc("get_company_system_license_status",{
   p_company:company.id,p_system_code:system.code
  });
  records.push({...status,name:system.name});
 }
 const current=records.find(r=>r.system_code==="SFT_SETOR_FISCAL");
 if(!current)throw Error("Sistema atual não está cadastrado no servidor de licenças.");
 const b=document.createElement("strong");
 b.textContent=current.effective_active?"Licença ativa":"Acesso empresarial bloqueado";
 el.replaceChildren(b);
 const description=document.createElement("p");
 let detail=current.computed_state.replaceAll("_"," ");
 if(current.ends_at)detail+=" · vencimento: "+new Date(current.ends_at).toLocaleString("pt-BR");
 if(current.plan)detail+=" · plano "+current.plan;
 description.textContent=detail+". "+(current.effective_active?
  "Empresa autorizada a utilizar os módulos de configuração. Emissão fiscal continua dependente de homologação.":
  "Esta empresa não poderá consultar nem alterar dados operacionais sem licença válida.");
 el.append(description);
 el.style.background=current.effective_active?"#ebf7ee":"#fff5df";
 const h=document.createElement("h3");h.textContent="Licenças dos demais sistemas";
 systemsEl.append(h);
 for(const item of records.filter(x=>x.system_code!=="SFT_SETOR_FISCAL")){
  const p=document.createElement("p");
  p.className="muted";
  p.textContent=item.name+" · "+item.computed_state.replaceAll("_"," ")+
  (item.integration_ready?"":" · aplicação independente ainda sem integração do bloqueio");
  systemsEl.append(p);
 }
 if(isMaster){
  const allowed=licensedSystems.filter(x=>x.integration_state==="IMPLEMENTADO");
  const select=$("license-product");select.replaceChildren();
  for(const item of allowed){const opt=document.createElement("option");opt.value=item.code;opt.textContent=item.name;select.append(opt);}
  select.value="SFT_SETOR_FISCAL";
  const localDate=toBrazilDate(new Date());
  const future=new Date(Date.now()+30*24*3600*1000);
  $("license-start").value=localDate;
  $("license-end").value=toBrazilDate(future);
  if(current.effective_active){
   $("license-mode").value=current.mode||"ASSINATURA";
   $("license-plan").value=current.plan||"PADRAO";
   if(current.starts_at)$("license-start").value=toBrazilDate(new Date(current.starts_at));
   if(current.ends_at)$("license-end").value=toBrazilDate(new Date(current.ends_at));
  }
 }
 return current.effective_active===true;
}
const BILLING_URL="https://tusmlfhzwlzwnoxfhomt.supabase.co/functions/v1/sft-billing-asaas-sandbox";
function amountToCents(input){
 const txt=String(input).trim().replace(",",".");
 if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(txt))throw new Error("Informe o valor em reais com até duas casas decimais.");
 const [int,frac=""]=txt.split(".");
 const n=Number(int)*100+Number((frac+"00").slice(0,2));
 if(!Number.isSafeInteger(n)||n<100)throw new Error("Mensalidade mínima: R$ 1,00.");
 return n;
}
function formatCents(num){
 return (num/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
async function loadCompanyBilling(company){
 const container=$("billing-card");
 const memberships=isMaster?[]:await table("company_memberships?select=role&company_id=eq."+company.id+"&user_id=eq."+user.id);
 const hasPermission=isMaster||memberships.some(m=>m.role==="ADMIN");
 container.hidden=!hasPermission;
 if(!hasPermission)return;
 const [plans,contracts]=await Promise.all([
  table("sft_recurring_plans?select=id,plan_code,plan_name,amount_cents,availability,hosting,billing_interval&order=plan_name.asc"),
  rpc("sft_billing_get_company_status",{p_company:company.id})
 ]);
 const info=$("billing-status");
 const arr=Array.isArray(contracts)?contracts:[];
 info.textContent=arr.length?arr.map(c=>c.plan+" · "+c.state.replaceAll("_"," ")+
   " · "+(c.price_cents?formatCents(c.price_cents):"sem preço")+
   " · "+(c.expires?"vigência até "+new Date(c.expires).toLocaleDateString("pt-BR"):"aguardando pagamento"))
   .join(" | "):"Nenhuma assinatura mensal registrada para esta empresa.";
 const list=$("billing-plans");list.replaceChildren();
 for(const p of plans){
  const el=document.createElement("p");el.className="check";
  el.textContent=p.plan_name+" · "+(p.amount_cents?formatCents(p.amount_cents)+"/mês":"preço ainda não definido")+
    " · "+(p.availability==="SANDBOX_PRONTO"?"somente testes":"indisponível para contratação")+
    " · nuvem compartilhada";
  list.append(el);
 }
 $("billing-master-card").hidden=!isMaster;
 if(isMaster){
  const select=$("billing-price-plan");
  select.replaceChildren();
  for(const p of plans){const option=document.createElement("option");option.value=p.plan_code;option.textContent=p.plan_name;select.append(option);}
 }
 const eligible=plans.filter(p=>p.availability==="SANDBOX_PRONTO"&&p.amount_cents>0);
 $("billing-checkout-card").hidden=!eligible.length;
 const choose=$("billing-checkout-plan");choose.replaceChildren();
 for(const p of eligible){const option=document.createElement("option");
  option.value=p.plan_code;option.textContent=p.plan_name+" — "+formatCents(p.amount_cents)+"/mês";choose.append(option);}
}
async function details(company){
 selectedCompany=company;
 $("details").hidden=false;
 const licensed=await showCompanyLicense(company);
 await loadCompanyBilling(company);
 $("company-licensed-content").hidden=!licensed;
 if(!licensed){$("detail-content").replaceChildren();return;}
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
 await loadAccountingSettings(company,role);
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
function populateSelect(select,items,idKey,labelFn){
 select.replaceChildren();
 for(const item of items){
  const option=document.createElement("option");
  option.value=item[idKey];option.textContent=labelFn(item);
  select.append(option);
 }
}
async function loadAccountingSettings(company,role){
 const portal=$("accountant-portal");
 if(!["ADMIN","CONTADOR"].includes(role)){portal.hidden=true;return;}
 portal.hidden=false;
 const assignments=await table("accounting_professional_assignments?select=id,accountant_user_id,professional_name,crc_number,crc_uf,status,assignment_scope&company_id=eq."+company.id+"&order=appointed_at.desc");
 const authorized=role==="ADMIN"||assignments.some(x=>x.accountant_user_id===user.id&&x.status==="AUTORIZADO");
 const state=$("accountant-access-status");state.textContent=authorized?
  "Acesso operacional de contabilidade autorizado nesta empresa. O registro CRC e a procuração para transmitir obrigações não são verificados automaticamente.":
  "Seu convite CONTADOR está aceito, mas o vínculo contábil desta empresa ainda aguarda autorização do administrador. Nenhuma rotina contábil privada foi liberada.";
 $("accountant-authorize-card").hidden=role!=="ADMIN";
 const assignEl=$("accountant-assignments");assignEl.replaceChildren();
 if(role==="ADMIN"){
  const members=await table("company_memberships?select=user_id,role&company_id=eq."+company.id);
  const accountants=members.filter(m=>m.role==="CONTADOR"&&!assignments.some(a=>a.accountant_user_id===m.user_id));
  populateSelect($("accountant-member"),accountants,"user_id",m=>"Contador convidado · "+m.user_id.slice(0,8));
  if(!$("accountant-crc-uf").options.length){
   for(const uf of knownStates){const o=document.createElement("option");o.value=uf;o.textContent=uf;$("accountant-crc-uf").append(o);}
  }
  for(const a of assignments){
   const line=document.createElement("div");line.className="check";
   const text=document.createElement("p");
   text.textContent=a.professional_name+" · CRC informado "+(a.crc_number||"não informado")+"/"+(a.crc_uf||"-")+" · "+a.status;
   line.append(text);
   if(a.status!=="REVOGADO"){
    const btn=document.createElement("button");btn.type="button";btn.className="secondary";
    const next=a.status==="AUTORIZADO"?"REVOGADO":"AUTORIZADO";
    btn.textContent=next==="AUTORIZADO"?"Autorizar acesso contábil após conferência":"Revogar acesso contábil";
    btn.onclick=async()=>{
     if(!confirm(next==="AUTORIZADO"?
       "Você conferiu a identidade, o CRC e a autorização deste contador para esta empresa? O sistema não verifica o CRC automaticamente.":
       "Revogar o acesso contábil? Para revogar também o acesso geral ao CNPJ, utilize Gestão de usuários."))return;
     btn.disabled=true;
     try{
      await request("/rest/v1/accounting_professional_assignments?id=eq."+a.id,{auth:true,method:"PATCH",body:{status:next}});
      await details(company);
      say(next==="AUTORIZADO"?"Acesso interno do contador autorizado, sem poderes de transmissão oficial.":"Acesso contábil revogado. Revogue também o vínculo geral na Gestão de usuários se necessário.");
     }catch(e){say(e.message,true);}
     finally{btn.disabled=false;}
    };
    line.append(btn);
   }
   assignEl.append(line);
  }
 }
 const cardIds=["accounting-service-card","accounting-period-card","accounting-obligation-card",
 "accounting-documents-card","accounting-chart-card","accounting-draft-card"];
 for(const id of cardIds)$(id).hidden=!authorized;
 if(!authorized)return;
 const [services,periods,obligations,documents,accounts,journals]=await Promise.all([
  table("accounting_service_requests?select=id,service_type,subject,status,due_on&company_id=eq."+company.id+"&order=created_at.desc&limit=50"),
  table("accounting_periods?select=id,period_month,status&company_id=eq."+company.id+"&order=period_month.desc&limit=50"),
  table("accounting_obligation_tracking?select=id,obligation_type,reference_period,due_on,status,applicability&company_id=eq."+company.id+"&order=reference_period.desc&limit=60"),
  table("accounting_document_register?select=id,document_kind,label,status&company_id=eq."+company.id+"&order=created_at.desc&limit=50"),
  table("accounting_chart_accounts?select=id,account_code,account_name,normal_balance&company_id=eq."+company.id+"&order=account_code.asc&limit=100"),
  table("accounting_draft_journals?select=id,posting_date,narration,status&company_id=eq."+company.id+"&order=posting_date.desc&limit=40")
 ]);
 const summaries=[
  ["accounting-service-list",services.map(x=>x.service_type.replaceAll("_"," ")+" · "+x.subject+" · "+x.status)],
  ["accounting-period-list",periods.map(x=>x.period_month.slice(0,7)+" · "+x.status)],
  ["accounting-obligation-list",obligations.map(x=>x.obligation_type+" · "+x.reference_period.slice(0,7)+" · "+x.status+" · "+x.applicability)],
  ["accounting-document-list",documents.map(x=>x.document_kind+" · "+x.label+" · "+x.status)],
  ["accounting-chart-list",accounts.map(x=>x.account_code+" · "+x.account_name+" · saldo "+x.normal_balance)],
  ["accounting-draft-list",journals.map(x=>x.posting_date+" · "+x.narration+" · "+x.status)]
 ];
 for(const [id,lines] of summaries){
  const div=$(id);div.replaceChildren();
  if(!lines.length){const el=document.createElement("p");el.className="muted";el.textContent="Nenhum registro desta empresa.";div.append(el);}
  for(const line of lines.slice(0,18)){const el=document.createElement("p");el.className="check";el.textContent=line;div.append(el);}
 }

 const serviceStates=["ABERTO","EM_ANALISE","AGUARDANDO_DOCUMENTOS","EM_CONFERENCIA","CONCLUIDO_INTERNO","CANCELADO"];
 const obligationStates=["PLANEJADA","DOCUMENTOS_PENDENTES","EM_CONFERENCIA","PRONTA_PARA_REVISAO","ENCERRADA_INTERNAMENTE"];
 const obligationApplicability=["NAO_ANALISADA","EM_ANALISE","APLICAVEL","NAO_APLICAVEL"];
 async function patchAccounting(tableName,id,body,success){
  await request("/rest/v1/"+tableName+"?id=eq."+id,{auth:true,method:"PATCH",body});
  await details(company);
  say(success);
 }
 const serviceBox=$("accounting-service-list");
 serviceBox.replaceChildren();
 if(!services.length){const p=document.createElement("p");p.className="muted";p.textContent="Nenhuma solicitação.";serviceBox.append(p);}
 for(const svc of services.slice(0,15)){
  const row=document.createElement("div");row.className="check";
  const label=document.createElement("p");label.textContent=svc.service_type.replaceAll("_"," ")+" · "+svc.subject;
  const select=document.createElement("select");select.setAttribute("aria-label","Etapa da solicitação");
  populateSelect(select,serviceStates.map(x=>({code:x})),"code",x=>x.code.replaceAll("_"," "));
  select.value=svc.status;
  const btn=document.createElement("button");btn.type="button";btn.className="secondary";btn.textContent="Atualizar etapa";
  btn.onclick=async()=>{btn.disabled=true;
   try{await patchAccounting("accounting_service_requests",svc.id,{status:select.value},
    "Etapa da solicitação atualizada nesta empresa.");}
   catch(e){say("Falha na atualização: "+e.message,true);}
   finally{btn.disabled=false;}
  };
  row.append(label,select,btn);serviceBox.append(row);
 }
 const obligationBox=$("accounting-obligation-list");
 obligationBox.replaceChildren();
 if(!obligations.length){const p=document.createElement("p");p.className="muted";p.textContent="Nenhuma obrigação registrada. A aplicabilidade deve ser analisada.";obligationBox.append(p);}
 for(const ob of obligations.slice(0,15)){
  const row=document.createElement("div");row.className="check";
  const label=document.createElement("p");label.textContent=ob.obligation_type+" · "+ob.reference_period.slice(0,7)+" · prazo informado: "+(ob.due_on||"não definido");
  const status=document.createElement("select");status.setAttribute("aria-label","Etapa interna da obrigação");
  populateSelect(status,obligationStates.map(x=>({code:x})),"code",x=>x.code.replaceAll("_"," "));
  status.value=ob.status;
  const applicability=document.createElement("select");applicability.setAttribute("aria-label","Aplicabilidade da obrigação para este CNPJ");
  populateSelect(applicability,obligationApplicability.map(x=>({code:x})),"code",x=>x.code.replaceAll("_"," "));
  applicability.value=ob.applicability;
  const btn=document.createElement("button");btn.type="button";btn.className="secondary";btn.textContent="Salvar revisão interna";
  btn.onclick=async()=>{btn.disabled=true;
   try{await patchAccounting("accounting_obligation_tracking",ob.id,
     {status:status.value,applicability:applicability.value},
     "Controle atualizado. Nenhuma declaração foi transmitida.");}
   catch(e){say("Falha na atualização: "+e.message,true);}
   finally{btn.disabled=false;}
  };
  row.append(label,status,applicability,btn);obligationBox.append(row);
 }
 populateSelect($("accounting-draft-period"),periods.filter(x=>x.status==="ABERTO"),"id",x=>x.period_month.slice(0,7));
 for(const id of ["accounting-draft-debit","accounting-draft-credit"]){
  populateSelect($(id),accounts,"id",x=>x.account_code+" · "+x.account_name);
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
 licensedSystems=await table("sft_system_catalog?select=code,name,integration_state&order=name.asc");
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
onForm("billing-price-form",async form=>{
 if(!isMaster)throw new Error("Somente Master pode definir os preços de contratação.");
 const value=amountToCents($("billing-price-value").value);
 const rationale=$("billing-price-why").value.trim();
 if(rationale.length<10)throw new Error("Justificativa com pelo menos 10 caracteres.");
 await rpc("sft_publish_sandbox_plan",{
  p_plan_code:$("billing-price-plan").value,
  p_amount_cents:value,
  p_justification:rationale
 });
 form.reset();
 await loadCompanyBilling(requireCompany());
 say("Preço registrado no banco para homologação. Nenhuma cobrança real foi autorizada.");
});
onForm("billing-checkout-form",async form=>{
 const company=requireCompany();
 if(!session)throw new Error("Acesse o sistema antes de solicitar um checkout.");
 const button=form.querySelector("button");
 button.disabled=true;
 const result=$("billing-checkout-result");result.replaceChildren();
 try{
  const res=await fetch(BILLING_URL+"/checkout",{
   method:"POST",headers:{"Content-Type":"application/json",
    "Authorization":"Bearer "+session.access_token},
   body:JSON.stringify({company_id:company.id,plan_code:$("billing-checkout-plan").value}),
   cache:"no-store"
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||data.error||"Provedor de pagamentos não disponível.");
  if(data.sandbox!==true||!data.checkout_url||!/^https:\/\/asaas\.com\/checkoutSession\/show\?id=/.test(data.checkout_url))
   throw new Error("Link de teste do processador não pôde ser validado.");
  const p=document.createElement("p");p.textContent="Checkout de homologação preparado. Não é uma cobrança de produção.";
  const a=document.createElement("a");a.href=data.checkout_url;a.target="_blank";a.rel="noopener noreferrer";
  a.textContent="Abrir página segura do Asaas Sandbox";
  result.append(p,a);
  await loadCompanyBilling(company);
  say("Checkout de testes criado. A assinatura só é ativada após confirmação bancária verificada.");
 }finally{button.disabled=false;}
});
onForm("license-form",async form=>{
 if(!isMaster)throw Error("Licenças só podem ser concedidas pelo Master.");
 const company=requireCompany();
 const start=$("license-start").value,end=$("license-end").value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)
  throw Error("Informe datas de início e término válidas.");
 const reason=$("license-justification").value.trim();
 if(reason.length<10)throw Error("A justificativa da licença precisa de pelo menos 10 caracteres.");
 const product=$("license-product").value;
 const status=$("license-action").value;
 if(!licensedSystems.some(x=>x.code===product&&x.integration_state==="IMPLEMENTADO"))
  throw Error("Não é permitido liberar sistema sem integração de licença concluída.");
 await rpc("set_company_system_license",{
  p_company:company.id,p_system_code:product,
  p_status:status,p_mode:$("license-mode").value,
  p_starts_at:start+"T00:00:00-03:00",
  p_ends_at:end+"T23:59:59-03:00",
  p_plan:$("license-plan").value.trim(),p_justification:reason
 });
 form.reset();
 await details(company);
 say(status==="ATIVA"?"Licença cadastrada no servidor. A validade será conferida em cada acesso.":
   "Licença suspensa/cancelada no servidor. Os módulos empresariais ficarão bloqueados.");
});
onForm("accountant-assignment-form",async form=>{
 const company=requireCompany();
 const id=$("accountant-member").value;
 if(!id)throw Error("O contador precisa aceitar o convite como CONTADOR antes do vínculo.");
 const crc=$("accountant-crc").value.trim().toUpperCase();
 if(!/^[0-9A-Za-z ./-]{4,30}$/.test(crc))throw Error("Registro CRC informado fora do formato esperado.");
 await insertRow("accounting_professional_assignments",{
  company_id:company.id,accountant_user_id:id,
  professional_name:$("accountant-name").value.trim(),
  crc_number:crc,crc_uf:$("accountant-crc-uf").value,
  assignment_scope:$("accountant-scope").value,
  appointed_by:user.id,status:"PENDENTE_CRC"
 });
 form.reset();await details(company);
 say("Contador vinculado em pendência de conferência. Revise o CRC antes de autorizar o acesso.");
});
onForm("accounting-service-form",async form=>{
 const company=requireCompany();
 await insertRow("accounting_service_requests",{
  company_id:company.id,service_type:$("accounting-service-type").value,
  subject:$("accounting-service-subject").value.trim(),
  due_on:$("accounting-service-due").value||null,
  requested_by:user.id,status:"ABERTO"
 });
 form.reset();await details(company);
 say("Solicitação contábil registrada nesta empresa.");
});
onForm("accounting-period-form",async form=>{
 const company=requireCompany();
 const month=$("accounting-period-month").value;
 if(!/^\d{4}-\d{2}$/.test(month))throw Error("Informe a competência.");
 await insertRow("accounting_periods",{
  company_id:company.id,period_month:month+"-01",status:"ABERTO",created_by:user.id
 });
 form.reset();await details(company);
 say("Competência aberta para rascunhos, sem fechamento ou transmissão oficial.");
});
onForm("accounting-obligation-form",async form=>{
 const company=requireCompany();
 const month=$("accounting-obligation-month").value;
 if(!/^\d{4}-\d{2}$/.test(month))throw Error("Informe a competência.");
 await insertRow("accounting_obligation_tracking",{
  company_id:company.id,obligation_type:$("accounting-obligation-type").value,
  reference_period:month+"-01",due_on:$("accounting-obligation-due").value||null,
  applicability:"NAO_ANALISADA",status:"PLANEJADA",official_transmission_enabled:false,
  created_by:user.id
 });
 form.reset();await details(company);
 say("Obrigação incluída em planejamento. Verifique aplicabilidade, legislação e vencimento antes de qualquer transmissão.");
});
onForm("accounting-document-form",async form=>{
 const company=requireCompany();
 await insertRow("accounting_document_register",{
  company_id:company.id,document_kind:$("accounting-document-type").value,
  label:$("accounting-document-label").value.trim(),
  status:"AGUARDANDO_ARQUIVO",created_by:user.id
 });
 form.reset();await details(company);
 say("Documento registrado como pendência. Nenhum arquivo sensível foi enviado.");
});
onForm("accounting-chart-form",async form=>{
 const company=requireCompany();
 await insertRow("accounting_chart_accounts",{
  company_id:company.id,account_code:$("accounting-chart-code").value.trim(),
  account_name:$("accounting-chart-name").value.trim(),
  account_type:$("accounting-chart-kind").value,
  normal_balance:$("accounting-chart-side").value,
  created_by:user.id,status:"PENDENTE_CONFERENCIA"
 });
 form.reset();await details(company);
 say("Conta do plano registrada como pendente de conferência.");
});
onForm("accounting-draft-form",async form=>{
 const company=requireCompany();
 const val=$("accounting-draft-amount").value.trim();
 if(!/^\d{1,16}(?:\.\d{1,2})?$/.test(val)||Number(val)<=0)throw Error("Informe valor monetário com até duas casas decimais.");
 await rpc("create_balanced_accounting_draft",{
  p_company_id:company.id,p_period_id:$("accounting-draft-period").value,
  p_posting_date:$("accounting-draft-date").value,
  p_narration:$("accounting-draft-title").value.trim(),
  p_debit_account_id:$("accounting-draft-debit").value,
  p_credit_account_id:$("accounting-draft-credit").value,
  p_amount:val,p_document_reference:null
 });
 form.reset();await details(company);
 say("Débito e crédito equilibrados registrados em rascunho, sem escrituração oficial.");
});
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
