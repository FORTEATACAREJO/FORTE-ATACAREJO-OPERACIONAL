
const DB=Deno.env.get('SUPABASE_URL')||'';
const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const KEY=keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const BASE=DB+'/rest/v1/';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'content-type','Content-Type':'application/json; charset=utf-8','Cache-Control':'public,max-age=600','X-Content-Type-Options':'nosniff'};
function reply(status,obj){return new Response(JSON.stringify(obj),{status,headers:cors})}
async function rest(table, params, count=false){
  if(!DB||!KEY)throw Error('backend_missing_config');
  const u=new URL(BASE+table);
  for(const [key,value] of Object.entries(params))u.searchParams.set(key,String(value));
  const hd={'apikey':KEY};
  if(!KEY.startsWith('sb_secret_'))hd.Authorization='Bearer '+KEY;
  const resp=await fetch(u,{headers:hd,signal:AbortSignal.timeout(7000)});
  if(!resp.ok)throw Error('database_unavailable_'+resp.status);
  return resp.json()
}
function digits(v){return String(v||'').replace(/\D/g,'')}
function textLimit(v){return String(v||'').normalize('NFC').trim().slice(0,70)}
const fields='codigo,descricao,nivel,data_inicio,data_fim,ato_inicio';
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='GET')return reply(405,{error:'method_not_allowed'});
  const u=new URL(req.url), mode=u.pathname.split('/').filter(Boolean).at(-1);
  try{
    if(mode==='version'){
      const data=await rest('cfop_ncm_versao',{select:'referencia,ato,fonte_url,importado_em,quantidade',id:'eq.1',limit:1});
      return reply(200,{source:'Receita Federal / Portal Único Siscomex — Classif',snapshot:data[0]||null,completeCodes:10516});
    }
    if(mode==='code'){
      const raw=u.searchParams.get('code')||'';
      const code=digits(raw);
      if(raw.length>20||code.length<2||code.length>8||!/^[\d.]+$/.test(raw))return reply(400,{error:'invalid_code'});
      const records=await rest('cfop_ncm_vigente',{select:fields,codigo:'eq.'+code,limit:1});
      if(!records.length)return reply(404,{error:'not_found'});
      const family=await rest('cfop_ncm_vigente',{select:'codigo,descricao,nivel',order:'nivel.asc',limit:7,codigo:'in.('+[2,4,5,6,7,8].filter(n=>n<=code.length).map(n=>code.slice(0,n)).join(',')+')'});
      return reply(200,{entry:records[0],hierarchy:family,officialTable:true,productMatchConfirmed:false});
    }
    if(mode==='family'){
      const prefix=digits(u.searchParams.get('prefix')||'');
      if(prefix.length<2||prefix.length>7||!/^\d+$/.test(prefix))return reply(400,{error:'invalid_prefix'});
      const items=await rest('cfop_ncm_vigente',{select:fields,codigo:'like.'+prefix+'*',nivel:'eq.8',order:'codigo.asc',limit:60});
      return reply(200,{prefix,items,hasMore:items.length===60,officialTable:true,productMatchConfirmed:false});
    }
    if(mode==='search'){
      const q=textLimit(u.searchParams.get('q')||'');
      if(q.length<3||q.length>70||!(/^[\p{L}\p{N}\s\-]+$/u).test(q))return reply(400,{error:'invalid_search'});
      const numeric=/^\d+$/.test(q);
      const data=numeric?await rest('cfop_ncm_vigente',{select:fields,codigo:'like.'+q+'*',order:'nivel.asc,codigo.asc',limit:30}):
        await rest('cfop_ncm_vigente',{select:fields,descricao:'ilike.*'+q.replace(/\s+/g,'*')+'*',order:'nivel.asc,codigo.asc',limit:30});
      return reply(200,{query:q,items:data,officialTable:true,productMatchConfirmed:false,note:'A busca localiza códigos e descrições da NCM oficial, não comprova a classificação fiscal de uma mercadoria específica.'});
    }

    if(mode==='cest-version'){
      const data=await rest('cfop_cest_fonte',{select:'fonte,url_cest,url_relacao,url_legal,gerado_em,consultado_em,registros_cest,registros_relacao,situacao',id:'eq.1',limit:1});
      return reply(200,{snapshot:data[0]||null,registrosRelacionadosImportados:1223,officialLegislationVerified:false,warning:'Compilação de terceiro baseada no Convênio ICMS 142/18. Não demonstra incidência de ICMS-ST nem vigência em cada UF.'});
    }
    if(mode==='cest-by-ncm'){
      const raw=u.searchParams.get('ncm')||'';
      const ncm=digits(raw);
      if(raw.length>20 || !/^[0-9.]+$/.test(raw) || ncm.length!==8)return reply(400,{error:'invalid_ncm'});
      const prefixes=[4,5,6,7,8].map(n=>ncm.slice(0,n));
      const maps=await rest('cfop_cest_ncm_relacao',{select:'cest,ncm_prefixo',ncm_prefixo:'in.('+prefixes.join(',')+')',limit:90});
      const unique=[...new Set(maps.map(m=>m.cest))];
      const items=unique.length?await rest('cfop_cest_referencia',{select:'cest,descricao,segmento',cest:'in.('+unique.join(',')+')',order:'cest.asc',limit:90}):[];
      return reply(200,{ncm,items:items.map(x=>({...x,matchPrefixes:maps.filter(m=>m.cest===x.cest).map(m=>m.ncm_prefixo)})),hasCandidates:items.length>0,
        status:'possibilidades_nao_homologadas',
        origin:'Tabelas Fiscais — compilação do Convênio ICMS 142/18',
        warning:'A correspondência NCM/SH pode ser ampla, incompleta e não confirmar a mercadoria. O CEST exige conferir DESCRIÇÃO legal e vigência. ST depende de UF, protocolo, data, finalidade, contribuinte e responsabilidade.',
        legalUrl:'https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18'});
    }
    if(mode==='cest-code'){
      const raw=u.searchParams.get('code')||'';
      const cest=digits(raw);
      if(raw.length>16 || cest.length!==7 || !/^[0-9.]+$/.test(raw))return reply(400,{error:'invalid_cest'});
      const items=await rest('cfop_cest_referencia',{select:'cest,descricao,segmento',cest:'eq.'+cest,limit:1});
      if(!items.length)return reply(404,{error:'not_found'});
      const maps=await rest('cfop_cest_ncm_relacao',{select:'ncm_prefixo',cest:'eq.'+cest,order:'ncm_prefixo.asc',limit:50});
      return reply(200,{item:items[0],ncmPrefixes:maps.map(m=>m.ncm_prefixo),status:'referencia_agregada_nao_homologada',
        warning:'Verificar a descrição no CONFAZ e a aplicabilidade no estado e data da operação.'});
    }
    if(mode==='cest-search'){
      const q=textLimit(u.searchParams.get('q')||'');
      if(q.length<3||!/^[\p{L}\p{N}\s\-]+$/u.test(q))return reply(400,{error:'invalid_search'});
      const numeric=/^\d+$/.test(q);
      const items=numeric?await rest('cfop_cest_referencia',{select:'cest,descricao,segmento',cest:'like.'+q+'*',limit:40,order:'cest.asc'}):
        await rest('cfop_cest_referencia',{select:'cest,descricao,segmento',descricao:'ilike.*'+q.replace(/\s+/g,'*')+'*',limit:40,order:'cest.asc'});
      return reply(200,{items,status:'referencia_agregada_nao_homologada',warning:'Pesquisa informativa da descrição CEST; conferir item e regras no Convênio ICMS 142/18.'});
    }
    return reply(404,{error:'not_found'});
  }catch(error){
    return reply(503,{error:'catalog_temporarily_unavailable'});
  }
});