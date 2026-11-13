// Sistemas Forte Tech — backend Asaas Sandbox for recurring credit-card checkout.
// PUBLIC WEBHOOK RECEIVER: authenticated with dedicated Asaas authToken, NEVER with a card.
const PROJECT_URL=Deno.env.get("SUPABASE_URL")||"";
const API_KEY=Deno.env.get("ASAAS_SANDBOX_API_KEY")||"";
const HOOK_TOKEN=Deno.env.get("ASAAS_WEBHOOK_TOKEN")||"";
const KEYS=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
const SECRET_KEY=KEYS.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const PUBLISHABLE=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||
  Deno.env.get("SUPABASE_ANON_KEY")||"";
const ALLOWED_ORIGIN="https://sistemas-forte-tech.onrender.com";
const ASAAS="https://api-sandbox.asaas.com/v3";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(value,status=200,headers={}){
 return new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
}
function cors(req){
 const origin=req.headers.get("origin");
 return origin===ALLOWED_ORIGIN?{"access-control-allow-origin":ALLOWED_ORIGIN,
 "access-control-allow-headers":"authorization,apikey,content-type",
 "access-control-allow-methods":"GET,POST,OPTIONS","vary":"Origin"}:{};
}
function configReady(){return !!(PROJECT_URL&&SECRET_KEY&&PUBLISHABLE&&API_KEY&&HOOK_TOKEN);}
async function sameToken(a,b){
 if(!a||!b)return false;
 const enc=new TextEncoder();
 const [x,y]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(a)),
 crypto.subtle.digest("SHA-256",enc.encode(b))]);
 const left=new Uint8Array(x),right=new Uint8Array(y);
 let mismatch=0;for(let i=0;i<left.length;i++)mismatch|=left[i]^right[i];
 return mismatch===0;
}
function moneyCents(v){
 const s=String(v);
 if(!/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/.test(s))throw Error("Valor monetário inválido");
 const [a,b=""]=s.split(".");
 return Number(a)*100+Number((b+"00").slice(0,2));
}
async function rpc(path,body,secret=false,authToken=null){
 const key=secret?SECRET_KEY:PUBLISHABLE;
 if(!key)throw Error("Supabase não configurado");
 const headers={"apikey":key,"content-type":"application/json"};
 if(authToken)headers.authorization="Bearer "+authToken;
 else if(secret && key.startsWith("eyJ"))headers.authorization="Bearer "+key;
 const response=await fetch(PROJECT_URL+"/rest/v1/rpc/"+path,{
  method:"POST",headers,body:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(14000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||data.msg||"RPC indisponível");
 return data;
}
async function asaas(method,path,body){
 if(!API_KEY)throw Error("Provedor sandbox não conectado");
 const r=await fetch(ASAAS+path,{
  method,headers:{"access_token":API_KEY,"accept":"application/json",
  "user-agent":"SistemasForteTech/0.1","content-type":"application/json"},
  body:body===undefined?undefined:JSON.stringify(body),
  redirect:"error",signal:AbortSignal.timeout(65000)
 });
 const payload=await r.json().catch(()=>({}));
 if(!r.ok)throw Error("Asaas Sandbox respondeu "+r.status+"; consulte o log seguro do gateway");
 return payload;
}
function localDueDate(){
 const value=new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",
  year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
  second:"2-digit",hour12:false}).format(new Date(Date.now()+15*60000));
 return value.replace("T"," ");
}
async function checkout(req){
 if(!configReady())return json({status:"BLOQUEADO",
  message:"Cobrança ainda não habilitada: credenciais Asaas Sandbox e autenticação estão pendentes."},503,cors(req));
 if(req.headers.get("origin")!==ALLOWED_ORIGIN)return json({error:"origem não permitida"},403,cors(req));
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer\s+[A-Za-z0-9._~-]+$/i.test(bearer))return json({error:"login obrigatório"},401,cors(req));
 const token=bearer.replace(/^Bearer\s+/i,"");
 const u=await fetch(PROJECT_URL+"/auth/v1/user",{headers:{"apikey":PUBLISHABLE,
   "authorization":"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!u.ok)return json({error:"sessão inválida"},401,cors(req));
 const body=await req.json();
 const company=body.company_id,plan=body.plan_code;
 if(!UUID.test(company)||!/^SFT_[A-Z0-9_]{4,60}$/.test(plan))
  return json({error:"empresa ou plano inválido"},400,cors(req));
 const contractId=await rpc("sft_billing_begin_contract",{p_company:company,p_plan_code:plan},false,token);
 if(!UUID.test(contractId))throw Error("Contrato inválido");
 const context=await rpc("sft_billing_checkout_context",{p_contract:contractId},true);
 if(context?.checkout_id){
  return json({status:"AGUARDANDO_PAGAMENTO",sandbox:true,
   checkout_url:"https://asaas.com/checkoutSession/show?id="+encodeURIComponent(context.checkout_id),
   message:"Checkout existente em sandbox"},200,cors(req));
 }
 // Reserve before calling payment API: a timeout must NOT create a second charge.
 const reference=await rpc("sft_billing_reserve_checkout",{p_contract:contractId},true);
 const priceCents=context?.price_cents;
 if(!Number.isSafeInteger(priceCents)||priceCents<100)
  throw Error("Plano sem valor aprovado");
 const checkoutReq={
  billingTypes:["CREDIT_CARD"],chargeTypes:["RECURRENT"],
  minutesToExpire:60,externalReference:reference,
  items:[{name:context.plan_name,description:"Sistemas Forte Tech — assinatura mensal em homologação",
    quantity:1,value:priceCents/100}],
  subscription:{cycle:"MONTHLY",nextDueDate:localDueDate()},
  callback:{successUrl:ALLOWED_ORIGIN+"/admin.html?cobranca=verificar",
    cancelUrl:ALLOWED_ORIGIN+"/admin.html?cobranca=cancelada",
    expiredUrl:ALLOWED_ORIGIN+"/admin.html?cobranca=expirada"}
 };
 const checkoutResponse=await asaas("POST","/checkouts",checkoutReq);
 if(typeof checkoutResponse?.id!=="string"||checkoutResponse.id.length<6)
  throw Error("Checkout sem identificador; requer reconciliação manual");
 await rpc("sft_billing_attach_checkout",{p_contract:contractId,
  p_checkout_id:checkoutResponse.id,p_checkout_ref:reference},true);
 return json({status:"AGUARDANDO_PAGAMENTO",sandbox:true,
  checkout_url:"https://asaas.com/checkoutSession/show?id="+encodeURIComponent(checkoutResponse.id),
  message:"Pagamento não confirmado; acesso permanece bloqueado até comprovação financeira."},200,cors(req));
}
// One-off recovery when PAYMENT_CONFIRMED arrived before SUBSCRIPTION_CREATED.
// Always re-fetch every charge; never license from an unverified list/webhook alone.
async function reconcileSubscriptionPayments(contractId,subscriptionId){
 const result=await asaas("GET","/subscriptions/"+encodeURIComponent(subscriptionId)+"/payments");
 const list=Array.isArray(result?.data)?result.data.slice(0,30):[];
 let processed=0;
 for(const item of list){
  if(typeof item?.id!=="string"||item.id.length<6)continue;
  if(!["CONFIRMED","RECEIVED"].includes(item.status))continue;
  const charge=await asaas("GET","/payments/"+encodeURIComponent(item.id));
  if(charge.id!==item.id||charge.subscription!==subscriptionId||
   charge.billingType!=="CREDIT_CARD"||
   !["CONFIRMED","RECEIVED"].includes(charge.status))continue;
  const due=charge.originalDueDate||charge.dueDate;
  if(typeof due!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(due))continue;
  const amount=moneyCents(charge.value);
  const syntheticEventId="sft-recovered-"+charge.id+"-"+charge.status;
  await rpc("sft_billing_record_verified_event",{
   p_event_id:syntheticEventId,p_event_type:"PAYMENT_RECONCILED",
   p_payment_id:charge.id,p_subscription_id:subscriptionId,
   p_amount_cents:amount,p_provider_status:charge.status,p_contract_id:contractId},true);
  await rpc("sft_billing_apply_verified_card_payment",{
   p_contract:contractId,p_event_id:syntheticEventId,p_payment_id:charge.id,
   p_provider_subscription_id:subscriptionId,p_amount_cents:amount,
   p_due_on:due,p_provider_status:charge.status},true);
  processed++;
 }
 return processed;
}
async function webhook(req){
 if(!configReady())return json({error:"Integração de pagamento desativada"},503);
 const sent=req.headers.get("asaas-access-token");
 if(!await sameToken(sent,HOOK_TOKEN))return json({error:"acesso não autorizado"},401);
 const raw=await req.text();
 if(raw.length>65000)return json({error:"evento excessivo"},413);
 let data;
 try{data=JSON.parse(raw)}catch{return json({error:"JSON inválido"},400)}
 const eventId=data?.id,eventType=data?.event;
 if(typeof eventId!=="string"||eventId.length<4||eventId.length>220||
 typeof eventType!=="string"||!(/^(PAYMENT_|SUBSCRIPTION_|CHECKOUT_)[A-Z_]+$/).test(eventType))
 return json({error:"evento não reconhecido"},400);
 // Checkout callback alone NEVER activates a license.
 if(eventType==="SUBSCRIPTION_CREATED"){
  const subId=typeof data.subscription==="string"?data.subscription:data.subscription?.id;
  if(typeof subId!=="string"||subId.length<8)return json({ok:true,pending:"subscription_id"},200);
  const remote=await asaas("GET","/subscriptions/"+encodeURIComponent(subId));
  if(remote.id!==subId)return json({error:"assinatura não verificada"},409);
  if(remote.cycle!=="MONTHLY"||remote.billingType!=="CREDIT_CARD"||
     remote.deleted===true||remote.status!=="ACTIVE")
   return json({ok:true,pending:"recorrencia_incompativel"});
  const ref=typeof remote.externalReference==="string"?remote.externalReference:"";
  // If Asaas does not preserve the checkout externalReference, leave it unlinked.
  // Never match a payer to a company by name, e-mail or payment value.
  const contractId=ref?await rpc("sft_billing_lookup_checkout_ref",{p_checkout_reference:ref},true):null;
  if(contractId){
   const c=await rpc("sft_billing_checkout_context",{p_contract:contractId},true);
   if(!c||c.checkout_reference!==ref||moneyCents(remote.value)!==c.price_cents)
     return json({error:"assinatura não confere com o contrato"},409);
   await rpc("sft_billing_attach_subscription",{
     p_contract:contractId,p_provider_subscription_id:subId},true);
  }
  await rpc("sft_billing_record_verified_event",{
   p_event_id:eventId,p_event_type:eventType,p_payment_id:null,p_subscription_id:subId,
   p_amount_cents:null,p_provider_status:String(remote.status||"UNSPECIFIED"),
   p_contract_id:contractId||null},true);
  // Recover paid invoices whose notifications arrived before the subscription link.
  const recovered=contractId?await reconcileSubscriptionPayments(contractId,subId):0;
  return json({ok:true,linked:!!contractId,recovered,sandbox:true});
 }
 if(eventType==="PAYMENT_CONFIRMED"||eventType==="PAYMENT_RECEIVED"){
  const paymentId=data?.payment?.id;
  if(typeof paymentId!=="string"||paymentId.length<6)return json({error:"pagamento inválido"},400);
  const remote=await asaas("GET","/payments/"+encodeURIComponent(paymentId));
  if(remote.id!==paymentId||remote.billingType!=="CREDIT_CARD"||
    !["CONFIRMED","RECEIVED"].includes(remote.status))
    return json({error:"pagamento ainda não confirmado pelo Asaas"},409);
  const subscriptionId=remote.subscription;
  if(typeof subscriptionId!=="string"||subscriptionId.length<8)
    return json({ok:true,pending:"subscription_ausente"});
  const contractId=await rpc("sft_billing_lookup_subscription",{
    p_external_subscription_id:subscriptionId},true);
  const amount=moneyCents(remote.value);
  await rpc("sft_billing_record_verified_event",{
   p_event_id:eventId,p_event_type:eventType,p_payment_id:paymentId,
   p_subscription_id:subscriptionId,p_amount_cents:amount,
   p_provider_status:remote.status,p_contract_id:contractId||null},true);
  if(!contractId)return json({ok:true,pending:"vinculo_assinatura"},200);
  const due=remote.originalDueDate||remote.dueDate;
  if(typeof due!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(due))
    return json({error:"competência inválida"},422);
  await rpc("sft_billing_apply_verified_card_payment",{
   p_contract:contractId,p_event_id:eventId,p_payment_id:paymentId,
   p_provider_subscription_id:subscriptionId,p_amount_cents:amount,
   p_due_on:due,p_provider_status:remote.status},true);
  return json({ok:true,licensed:true,sandbox:true});
 }
 if(eventType==="CHECKOUT_PAID"){
  const checkoutId=data.checkout?.id;
  if(typeof checkoutId==="string"&&checkoutId.length>5){
   const contractId=await rpc("sft_billing_lookup_checkout_id",{p_checkout_id:checkoutId},true);
   await rpc("sft_billing_record_verified_event",{
    p_event_id:eventId,p_event_type:eventType,p_payment_id:null,
    p_subscription_id:null,p_amount_cents:null,p_provider_status:String(data.checkout?.status||"PAID"),
    p_contract_id:contractId||null},true);
   // Checkout PAID is not enough to authorize a specific recurring payment.
   return json({ok:true,contract_linked:!!contractId,license_unchanged:true});
  }
 }
 // No automatic license modification on overdue, refunds, or chargebacks until
 // their own provider-verified reconciliation and business rules are homologated.
 return json({ok:true,ignored:eventType});
}
Deno.serve(async(req)=>{
 const url=new URL(req.url);
 const path=url.pathname.replace(/\/+$/,"");
 if(req.method==="OPTIONS"&&path.endsWith("/checkout"))
   return new Response(null,{status:204,headers:cors(req)});
 if(req.method==="GET"&&path.endsWith("/health"))
   return json({app:"Sistemas Forte Tech",billing:"cartao_recorrente",
    hosting:"shared_cloud",environment:"SANDBOX",provider:"ASAAS",
    provider_configured:!!API_KEY,webhook_configured:!!HOOK_TOKEN,
    secrets_ready:!!SECRET_KEY,checkout_enabled:configReady(),
    production_charges_enabled:false});
 try{
  if(req.method==="POST"&&path.endsWith("/checkout"))return await checkout(req);
  if(req.method==="POST"&&path.endsWith("/webhook"))return await webhook(req);
  return json({error:"não encontrado"},404);
 }catch(err){
  // Never return tokens, raw API responses, card data, or private provider payloads.
  return json({error:"Integração indisponível",message:
    err instanceof Error&&/Plano indisponível|Checkout já reservado|Contrato não está|login obrigatório|sem valor aprovado/.test(err.message)
      ?err.message:"Não foi possível concluir a operação com segurança."},503,
    path.endsWith("/checkout")?cors(req):{});
 }
});