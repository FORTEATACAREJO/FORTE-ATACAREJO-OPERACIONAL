// FORTECOMPANNY — painel de verificação de fontes oficiais (somente leitura).
// Endpoint público: nenhum CPF/CNPJ/segredo é retornado, e nenhuma regra fiscal é alterada.
const allow = new Set(["https://fortecompanny.com.br","https://www.fortecompanny.com.br","https://forte-tech-cfop-publico.onrender.com"]);
function json(body:unknown,status=200,origin:string|null=null){
  const headers:Record<string,string>={
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"public, max-age=120",
    "Vary":"Origin"
  };
  if(origin && allow.has(origin))headers["Access-Control-Allow-Origin"]=origin;
  return new Response(JSON.stringify(body),{status,headers});
}
Deno.serve(async(req:Request):Promise<Response>=>{
 const origin=req.headers.get("origin");
 if(origin && !allow.has(origin))return json({error:"origin_not_allowed"},403);
 if(req.method==="OPTIONS"){
   return new Response(null,{status:204,headers:{
     "Access-Control-Allow-Origin":origin&&allow.has(origin)?origin:"https://fortecompanny.com.br",
     "Access-Control-Allow-Methods":"GET, OPTIONS",
     "Access-Control-Allow-Headers":"Content-Type, apikey, authorization",
     "Vary":"Origin",
     "Access-Control-Max-Age":"86400"
   }});
 }
 if(req.method!=="GET")return json({error:"method_not_allowed"},405,origin);
 const path=new URL(req.url).pathname;
 if(!path.endsWith("/status") && !path.endsWith("/fontes") && !path.endsWith("/cfop-fontes"))return json({error:"not_found"},404,origin);
 const backend=Deno.env.get("SUPABASE_URL");
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!backend||!key)return json({error:"configuration_unavailable"},503,origin);
 const headers={apikey:key,Authorization:"Bearer "+key};
 const query=backend+"/rest/v1/";
 try{
  const [sr,ar,ufr,lr]=await Promise.all([
    fetch(query+"cfop_fontes_oficiais?select=chave,orgao,assunto,uf,url,ativo,ultimo_http,primeira_verificacao,ultima_verificacao,ultima_alteracao_detectada,ultima_falha&ativo=eq.true&order=chave.asc",{headers,signal:AbortSignal.timeout(5000)}),
    fetch(query+"cfop_alertas_normativos?select=fonte_chave,detectado_em,status&order=detectado_em.desc&limit=20",{headers,signal:AbortSignal.timeout(5000)}),
    fetch(query+"cfop_uf_nacionais?select=uf,cuf,nome,regiao,portal_tributario,situacao_regras&order=cuf.asc",{headers,signal:AbortSignal.timeout(5000)}),
    fetch(query+"cfop_regras_tributarias_uf?select=id&situacao=eq.homologada&limit=1",{headers:{...headers,Prefer:"count=exact"},signal:AbortSignal.timeout(5000)})
  ]);
  if(!sr.ok||!ar.ok||!ufr.ok||!lr.ok)return json({error:"source_database_unavailable"},503,origin);
  const sources=await sr.json(),alerts=await ar.json(),states=await ufr.json();
  if(!Array.isArray(sources)||!Array.isArray(alerts)||!Array.isArray(states))return json({error:"invalid_data"},503,origin);
  const homologatedCount=Number((lr.headers.get("content-range")||"0/0").split("/").pop())||0;
  return json({updatedAt:new Date().toISOString(),scope:"monitoramento_versoes_de_paginas",automaticRuleChanges:false,
  publicDocument:"https://fortecompanny.com.br/fontes-oficiais.html",schedule:"Diariamente às 08:00, Brasília",
  warning:"Alteração detectada exige revisão jurídica/tributária. Não é aplicação automática de novas regras.",
  coverage:{registeredUFs:states.length,originDestinationRoutes:states.length*states.length,
    officiallyValidatedStateRules:homologatedCount,
    status:homologatedCount===0?"base_cadastrada_pendente_homologacao":"homologacao_parcial",
    legalDisclaimer:"Portais oficiais cadastrados não significam regras tributárias estaduais homologadas."},
  states,sources,alerts},200,origin);
 }catch(e){
  return json({error:"temporary_unavailable",detail:String(e instanceof Error?e.name:"request_error")},503,origin);
 }
});
