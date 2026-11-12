
type AnyObject=Record<string,unknown>;
const CNPJ_API_KEY=Deno.env.get('CNPJAPI_API_KEY')||'';
const SINTEGRAPI_API_KEY=Deno.env.get('SINTEGRAPI_API_KEY')||'';
const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const serviceKey=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const permittedOrigin='https://forte-tech-cfop-publico.onrender.com';
const UFS=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
const headers={
 'Content-Type':'application/json; charset=utf-8',
 'Access-Control-Allow-Origin':permittedOrigin,
 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
 'Access-Control-Allow-Headers':'content-type',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Vary':'Origin'
};
function answer(status:number,obj:AnyObject){return new Response(JSON.stringify(obj),{status,headers})}
const val=(v:unknown)=>typeof v==='string'?v:'';
const format=(v:unknown,max=120)=>(typeof v==='number'?String(v):val(v)).trim().slice(0,max);
function cnpjValid(c:string){if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(c)||c.slice(0,12)===c[0].repeat(12))return false;
 const w1=[5,4,3,2,9,8,7,6,5,4,3,2],w2=[6,5,4,3,2,9,8,7,6,5,4,3,2];
 const digit=(str:string,w:number[])=>{let n=0;for(let i=0;i<w.length;i++)n+=(str.charCodeAt(i)-48)*w[i];const r=n%11;return r<2?0:11-r};
 const d=digit(c.slice(0,12),w1);return c.slice(-2)===String(d)+String(digit(c.slice(0,12)+d,w2));
}
function cpfValid(s:string){if(!/^\d{11}$/.test(s)||s.split('').every(c=>c===s[0]))return false;
 for(let length=9;length<=10;length++){let sum=0;for(let i=0;i<length;i++)sum+=Number(s[i])*(length+1-i);let d=sum*10%11;if(d===10)d=0;if(d!==Number(s[length]))return false}return true;
}
function asObject(v:unknown):AnyObject{return v&&typeof v==='object'&&!Array.isArray(v)?v as AnyObject:{}}
function from(v:unknown,k:string){return asObject(v)[k]}
function selection(v:unknown):boolean|null {
 if(typeof v==='boolean')return v;
 if(typeof v==='number')return v===1?true:v===0?false:null;
 if(typeof v==='object'&&v!==null){for(const k of ['OpcaoPeloSimples','Optante','optante','OptanteSimples','optanteSimples','ehOptante']){const u=from(v,k);if(u!==undefined){const r=selection(u);if(r!==null)return r}}return null}
 if(typeof v==='string'){
  const x=v.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  if(['SIM','S','1','TRUE','OPTANTE'].includes(x))return true;
  if(['NAO','N','0','FALSE','NAO OPTANTE'].includes(x))return false;
 }return null;
}
async function reserve(key:string){
 if(!supabaseUrl||!serviceKey)throw new Error('indisponivel');
 const hd:Record<string,string>={'apikey':serviceKey,'Content-Type':'application/json'};
 if(!serviceKey.startsWith('sb_secret_'))hd.Authorization='Bearer '+serviceKey;
 const res=await fetch(supabaseUrl+'/rest/v1/rpc/cfop_reserve_provider_lookup',{
  method:'POST',headers:hd,body:JSON.stringify({p_provider:key}),signal:AbortSignal.timeout(5000)
 });
 if(!res.ok){if(res.status>=400&&res.status<500)throw new Error('quota');throw new Error('indisponivel')}
 const data=await res.json();if(!data?.allowed)throw new Error('quota');
}
async function external(url:string,key:string,kind:'cnpj'|'rural'){
 const hd:Record<string,string>={Accept:'application/json'};
 if(kind==='cnpj')hd.Authorization='Bearer '+key;
 else hd['x-api-key']=key;
 const res=await fetch(url,{headers:hd,signal:AbortSignal.timeout(9000)});
 if(res.status===429)throw new Error('quota');
 if(res.status===401||res.status===403)throw new Error('credencial');
 if(res.status===404)return null;
 if(res.status===422)throw new Error('invalido');
 if(!res.ok)throw new Error('indisponivel');
 const body=await res.json();if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('indisponivel');
 if(body.error===true||body.success===false)throw new Error('indisponivel');
 return body as AnyObject;
}
function baseResult(source:string, data:AnyObject){return {source,verifiedAt:new Date().toISOString(),sourceType:'terceiro_com_base_cadastral',verificationState:'retorno_de_intermediario',sourceUpdatedAt:format(data.UltimaAtualizacao,30)||null,regimeFederal:'não confirmado',regimeICMS:'não confirmado'}}
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin');
 if(origin&&origin!==permittedOrigin)return answer(403,{error:'origin_forbidden'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const pathname=new URL(request.url).pathname;
 if(request.method==='GET'&&pathname.endsWith('/status'))return answer(200,{
  cnpjAvailable:!!CNPJ_API_KEY, ruralAvailable:!!SINTEGRAPI_API_KEY,
  cnpjProvider:'CNPJ API', ruralProvider:'SintegrAPI',
  cnpjIncludesIE:'opcional', automaticFederalProfitRegime:false
 });
 if(request.method!=='POST'||!pathname.endsWith('/lookup'))return answer(404,{error:'not_found'});
 const size=request.headers.get('content-length');if(size&&Number(size)>700)return answer(413,{error:'payload_too_large'});
 let raw:AnyObject;
 try{const text=await request.text();if(new TextEncoder().encode(text).length>700)return answer(413,{error:'payload_too_large'});raw=asObject(JSON.parse(text))}catch{return answer(400,{error:'invalid_json'})}
 const type=raw.type,doc=format(raw.document,25).toUpperCase().replace(/[^0-9A-Z]/g,'');
 const uf=format(raw.uf,2).toUpperCase();
 if(type!=='cnpj'&&type!=='rural')return answer(400,{error:'invalid_type'});
 if(type==='cnpj'){
  if(!cnpjValid(doc))return answer(422,{error:'invalid_cnpj'});
  if(raw.includeIE!==undefined&&typeof raw.includeIE!=='boolean')return answer(400,{error:'invalid_request'});
  if(uf&&!UFS.has(uf))return answer(400,{error:'invalid_uf'});
  if(!CNPJ_API_KEY)return answer(503,{error:'provider_not_configured',provider:'CNPJ API'});
 }else{
  if(!cpfValid(doc))return answer(422,{error:'invalid_cpf'});
  if(!UFS.has(uf))return answer(400,{error:'invalid_uf'});
  if(raw.consent!==true)return answer(403,{error:'rural_lookup_requires_consent'});
  if(!SINTEGRAPI_API_KEY)return answer(503,{error:'provider_not_configured',provider:'SintegrAPI'});
 }
 try{
  const ie=type==='cnpj'&&raw.includeIE===true;
  await reserve(type==='rural'?'rural':ie?'cnpj_ie':'cnpj');
  if(type==='cnpj'){
   const url='https://api.cnpjapi.com.br/'+doc+(ie?'?incluir=ie&ie_uf='+(uf||'auto'):'');
   const src=await external(url,CNPJ_API_KEY,'cnpj');
   if(!src)return answer(404,{error:'not_found'});
   if(format(src.CNPJ,25).replace(/[^A-Z0-9]/gi,'').toUpperCase()!==doc||!format(src.RazaoSocial))throw new Error('indisponivel');
   const addr=asObject(src.Endereco);
   const vIE=src.InscricoesEstaduais;
   const ies=Array.isArray(vIE)?vIE.slice(0,15).map(x=>({
    uf:format(from(x,'UF'),2),
    ie:format(from(x,'IE'),25),
    situacao:format(from(x,'Situacao'),70),
    indicador:format(from(x,'Indicador'),20),
    tipo:format(from(x,'Tipo'),45),
    consultedAt:format(from(x,'ConsultadoEm'),40)||null,
    active:from(x,'Situacao')==='habilitado'?true:from(x,'Situacao')==='nao_habilitado'?false:null,
    source:'CNPJ API / SEFAZ'
   })):[];
   return answer(200,{
    ...baseResult('CNPJ API — base pública da Receita Federal',src),
    documentType:'cnpj',name:format(src.RazaoSocial),tradeName:format(src.NomeFantasia),
    uf:format(addr.UF,2),city:format(from(addr.Municipio,'Nome')||addr.Municipio,90),
    situation:format(from(src.SituacaoCadastral,'Descricao'),80),
    cnae:format(from(src.AtividadePrincipal,'Codigo'),12),
    simplesNacional:selection(src.SimplesNacional),
    ieRequested:ie, ieStatus:ie?format(src.InscricoesEstaduaisErro)||'consultado':'não solicitado',
    ieFallbackUFs:Array.isArray(src.InscricoesEstaduaisUFsDaBase)?src.InscricoesEstaduaisUFsDaBase.filter(x=>typeof x==='string'&&UFS.has(x)):[],
    ieUnavailableUFs:Array.isArray(src.InscricoesEstaduaisUFsIndisponiveis)?src.InscricoesEstaduaisUFsIndisponiveis.filter(x=>typeof x==='string'&&UFS.has(x)):[],
    registrations:ies
   });
  }
  const url='https://api.sintegrapi.com.br/consultas/v2/produtor-rural/'+doc+'?uf='+uf+'&cache_strategy=CACHE_PREFERENCIAL&cache=7';
  const src=await external(url,SINTEGRAPI_API_KEY,'rural');
  if(!src)return answer(404,{error:'not_found'});
  if(src.success!==true||src.error!==false||format(src.cpf,15).replace(/\D/g,'')!==doc||format(src.uf,2)!==uf)throw new Error('indisponivel');
  const list=src.inscricoes_estaduais;
  if(!Array.isArray(list))throw new Error('indisponivel');
  const reg=list.filter(x=>format(from(x,'uf'),2)===uf).slice(0,20).map(x=>({
    ie:format(from(x,'inscricao_estadual'),25),uf:format(from(x,'uf'),2),
    active:typeof from(x,'ativa')==='boolean'?from(x,'ativa'):null,
    updatedAt:format(from(x,'updated_at'),30)||null,
    statusDate:format(from(x,'data_status'),30),
    type:format(from(x,'tipo_ie'),60),
    situation:format(from(x,'situacao_pj'),80)
  }));
  return answer(200,{
   ...baseResult('SintegrAPI — Sintegra produtor rural',src),
   documentType:'cpf_rural',name:format(src.nome),
   uf,registrations:reg,
   hasActiveRegistration:reg.some(x=>x.active),
   requestId:/^[a-f0-9-]{36}$/i.test(val(src.request_id))?src.request_id:null,
   isCached:src.is_cache===true
  });
 }catch(error){
  const msg=String((error as Error)?.message||'');
  if(msg==='quota')return answer(429,{error:'free_quota_exhausted'});
  if(msg==='credencial')return answer(503,{error:'provider_credentials_invalid'});
  if(msg==='invalido')return answer(422,{error:'provider_rejected_document'});
  return answer(503,{error:'provider_temporarily_unavailable'});
 }
});
