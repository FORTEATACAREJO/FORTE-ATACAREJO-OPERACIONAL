// FORTECOMPANNY — Busca indicativa por nome empresarial em dados abertos da Receita.
const ORIGINS=new Set(['https://fortecompanny.com.br','https://www.fortecompanny.com.br','https://forte-tech-cfop-publico.onrender.com']);
const UFS=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
function respond(data:unknown,status:number,origin:string|null){
 const h:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(origin&&ORIGINS.has(origin))h['Access-Control-Allow-Origin']=origin;
 return new Response(JSON.stringify(data),{status,headers:h});
}
function str(v:unknown,max=120):string{return (typeof v==='string'?v:'').trim().slice(0,max)}
function first(o:Record<string,unknown>,keys:string[]):unknown{for(const key of keys)if(o[key]!=null&&o[key]!=='')return o[key];return null}
function list(d:unknown,depth=0):unknown[]{
 if(Array.isArray(d))return d;
 if(!d||typeof d!=='object'||depth>3)return [];
 const obj=d as Record<string,unknown>;
 for(const key of ['resultados','results','empresas','items','data','dados','estabelecimentos','registros']){
  if(Array.isArray(obj[key]))return obj[key] as unknown[];
  if(obj[key]&&typeof obj[key]==='object'){const l=list(obj[key],depth+1);if(l.length)return l}
 }
 return [];
}
Deno.serve(async (req:Request):Promise<Response>=>{
 const origin=req.headers.get('origin');
 if(origin&&!ORIGINS.has(origin))return respond({error:'origin_not_allowed'},403,origin);
 if(req.method==='OPTIONS'){
  const h:Record<string,string>={'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, authorization','Vary':'Origin'};
  if(origin&&ORIGINS.has(origin))h['Access-Control-Allow-Origin']=origin;
  return new Response(null,{status:204,headers:h});
 }
 if(req.method!=='GET')return respond({error:'method_not_allowed'},405,origin);
 const url=new URL(req.url);
 if(!url.pathname.endsWith('/search'))return respond({error:'not_found'},404,origin);
 const q=str(url.searchParams.get('q'),60),uf=str(url.searchParams.get('uf'),2).toUpperCase();
 if(q.length<3||!(/^[\p{L}\p{N}\s.\-&/]+$/u).test(q)||(uf&&!UFS.has(uf)))return respond({error:'invalid_parameters'},400,origin);
 const provider=new URL('https://fichario.app/api/v1/busca');
 provider.searchParams.set('q',q);
 if(uf)provider.searchParams.set('uf',uf);
 try{
  const upstream=await fetch(provider,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8500)});
  if(upstream.status===429)return respond({error:'public_source_quota_reached'},429,origin);
  if(!upstream.ok)return respond({error:'public_source_unavailable'},503,origin);
  const body=await upstream.json();
  const found=list(body).slice(0,40).map(v=>{
   if(!v||typeof v!=='object')return null;
   const x=v as Record<string,unknown>;
   const cnpj=str(first(x,['cnpj','CNPJ','numero_cnpj','documento']),25).toUpperCase().replace(/[^0-9A-Z]/g,'');
   const name=str(first(x,['razao_social','nome_empresarial','razaoSocial','nome','nome_fantasia','fantasia']),130);
   const tradeName=str(first(x,['nome_fantasia','fantasia','nomeFantasia']),100);
   const ufFound=str(first(x,['uf','sigla_uf','estado']),2).toUpperCase();
   const city=str(first(x,['municipio','cidade','nome_municipio']),80);
   return /^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)&&name?{cnpj,name,tradeName,uf:UFS.has(ufFound)?ufFound:'',city}:null;
  }).filter((x):x is NonNullable<typeof x>=>!!x);
  const items=Array.from(new Map(found.map(x=>[x.cnpj,x])).values()).slice(0,15);
  return respond({items,source:'Fichário — dados abertos da Receita Federal (intermediário)',sourceUrl:'https://fichario.app/api',officialLive:false,requiresSelection:true,warning:'Selecione o CNPJ correto antes da consulta cadastral. O resultado por nome não é certidão da Receita.'},200,origin);
 }catch(_){return respond({error:'public_source_unavailable'},503,origin)}
});