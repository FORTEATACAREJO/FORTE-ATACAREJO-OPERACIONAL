// FORTECOMPANNY — consulta de base legislativa nacional (27 UFs, somente leitura).
// As regras estaduais só podem orientar cálculo quando homologadas e vigentes.
const allowed=new Set(['https://fortecompanny.com.br','https://www.fortecompanny.com.br','https://forte-tech-cfop-publico.onrender.com']);
const validUfs=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
type RecordValue=Record<string,unknown>;
function answer(data:unknown,status=200,origin:string|null=null){
 const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=90','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 return new Response(JSON.stringify(data),{status,headers});
}
function digits(v:string){return v.replace(/\D/g,'')}
Deno.serve(async (req:Request)=>{
 const origin=req.headers.get('origin');
 if(origin&&!allowed.has(origin))return answer({error:'origin_not_allowed'},403,origin);
 if(req.method==='OPTIONS'){
  const headers:Record<string,string>={'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Max-Age':'86400','Vary':'Origin'};
  if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
  return new Response(null,{status:204,headers});
 }
 if(req.method!=='GET')return answer({error:'method_not_allowed'},405,origin);
 const path=new URL(req.url).pathname;
 const route=new URL(req.url);
 const isStatus=path.endsWith('/status');
 if(!isStatus&&!path.endsWith('/route'))return answer({error:'not_found'},404,origin);
 const from=(route.searchParams.get('from')||'').toUpperCase();
 const to=(route.searchParams.get('to')||'').toUpperCase();
 const ncm=digits(route.searchParams.get('ncm')||'');
 const cest=digits(route.searchParams.get('cest')||'');
 const date=(route.searchParams.get('date')||new Date().toISOString().slice(0,10));
 if(!isStatus&&(!validUfs.has(from)||!validUfs.has(to)))return answer({error:'invalid_uf'},400,origin);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return answer({error:'invalid_date'},400,origin);
 if(ncm&&ncm.length!==8)return answer({error:'invalid_ncm'},400,origin);
 if(cest&&cest.length!==7)return answer({error:'invalid_cest'},400,origin);
 const backend=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!backend||!key)return answer({error:'configuration_unavailable'},503,origin);
 const hdr={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
 async function get(table:string,params:Record<string,string>){
  const url=new URL(backend+'/rest/v1/'+table);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  const r=await fetch(url,{headers:hdr,signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error('database_unavailable');
  const data=await r.json();
  if(!Array.isArray(data))throw Error('unexpected_database_result');
  return data as RecordValue[];
 }
 try{
  if(isStatus){
   const states=await get('cfop_uf_nacionais',{select:'uf,nome,portal_tributario,situacao_regras',order:'uf.asc',limit:'27'});
   const approved=states.filter(x=>x.situacao_regras==='homologada').length;
   return answer({ufs:states,ufCount:states.length,fullyHomologatedUFs:approved,note:'URLs são fontes para consulta, não regras fiscais automaticamente homologadas.'},200,origin);
  }
  const states=await get('cfop_uf_nacionais',{select:'uf,nome,portal_tributario,situacao_regras',uf:'in.('+from+','+to+')',limit:'2'});
  const all=await get('cfop_regras_tributarias_uf',{
   select:'uf_origem,uf_destino,tributo,ncm,cest,finalidade,natureza,regime,regra_json,fonte_url,ato_normativo,artigo,inicio_vigencia,fim_vigencia,situacao,homologado_em',
   uf_origem:'eq.'+from,uf_destino:'eq.'+to,situacao:'eq.homologada',limit:'100'
  });
  const verified=all.filter(x=>x.homologado_em&&(!x.inicio_vigencia||String(x.inicio_vigencia)<=date)&&(!x.fim_vigencia||String(x.fim_vigencia)>=date)&&(!x.ncm||digits(String(x.ncm))===ncm)&&(!x.cest||digits(String(x.cest))===cest));
  return answer({from,to,date,ufs:states,verifiedRules:verified,verifiedRuleCount:verified.length,
    sourceStatus:verified.length?'contains_homologated_rules':'only_state_portal_indexed',
    note:verified.length?'Regras selecionadas segundo rota, produto e vigência. Finalidade/regime/responsabilidade devem ser conferidos.':'27 portais oficiais indexados; nenhum cálculo estadual específico autorizado sem regra homologada.',
    baseFederal:[
     {title:'Lei Complementar 87/1996 (LC 190/2022 — DIFAL)',url:'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp87.htm'},
     {title:'Convênio ICMS 142/2018 — ST e CEST',url:'https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18'}
    ]
   },200,origin);
 }catch(e){return answer({error:'state_rules_temporarily_unavailable'},503,origin)}
});