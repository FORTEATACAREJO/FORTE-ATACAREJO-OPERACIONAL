import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(readFileSync(new URL('../backend/cfop-cadastros.ts',import.meta.url),'utf8'));
const CNPJ='99999999000191', CPF='52998224725'; // synthetic, never sent to a provider
const company={CNPJ,RazaoSocial:'EMPRESA DE TESTE',Endereco:{UF:'MG',Municipio:{Nome:'Cidade de teste'}},SimplesNacional:{OpcaoPeloSimples:true},InscricoesEstaduais:[{UF:'MG',IE:'123',Indicador:1,Situacao:'habilitado'}],InscricoesEstaduaisUFsDaBase:['MG']};
let count=0;
async function run(body,{payload=company,status=200,env=true,origin='https://forte-tech-cfop-publico.onrender.com',quota=true}={}){
 let handler,externalCalls=0;
 const sandbox={Request,Response,Headers,URL,AbortSignal,TextEncoder,console,Deno:{env:{get:k=>env?({CNPJAPI_API_KEY:'test-only',SINTEGRAPI_API_KEY:'test-only',SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test-only'}[k]):undefined},serve:h=>handler=h},fetch:async(url,options)=>{
  if(url.startsWith('https://db.test'))return Response.json({allowed:quota});
  externalCalls++;assert(!options.headers['Authorization']?.includes('undefined'));
  return Response.json(payload,{status});
 }};
 vm.runInNewContext(source,sandbox);
 const request=new Request('https://edge.test/lookup',{method:'POST',headers:{origin,'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});
 const response=await handler(request);const data=await response.json();count++;return {status:response.status,data,externalCalls};
}
let r=await run({type:'cnpj',document:CNPJ,includeIE:true});assert.equal(r.status,200);assert.equal(r.data.city,'Cidade de teste');assert.equal(r.data.simplesNacional,true);assert.equal(r.data.registrations[0].indicador,'1');assert.equal(r.data.registrations[0].active,true);assert.deepEqual(r.data.ieFallbackUFs,['MG']);assert.equal(r.data.regimeFederal,'não confirmado');
for(const simple of [false,null]){r=await run({type:'cnpj',document:CNPJ},{payload:{...company,SimplesNacional:{OpcaoPeloSimples:simple}}});assert.equal(r.data.simplesNacional,simple);assert.equal(r.data.regimeFederal,'não confirmado');}
for(const [status,expected] of [[401,503],[403,503],[404,404],[422,422],[429,429],[502,503],[503,503]]){r=await run({type:'cnpj',document:CNPJ},{status});assert.equal(r.status,expected);assert(!JSON.stringify(r.data).includes('test-only'));}
for(const payload of [{},{...company,CNPJ:'00776574000156'},{...company,error:true}]){r=await run({type:'cnpj',document:CNPJ},{payload});assert.equal(r.status,503);}
r=await run({type:'cnpj',document:'00000000000000'});assert.equal(r.status,422);assert.equal(r.externalCalls,0);
r=await run({type:'cnpj',document:CNPJ},{env:false});assert.equal(r.status,503);assert.equal(r.externalCalls,0);
r=await run({type:'cnpj',document:CNPJ},{quota:false});assert.equal(r.status,429);assert.equal(r.externalCalls,0);
r=await run({type:'cnpj',document:CNPJ},{origin:'https://other.test'});assert.equal(r.status,403);assert.equal(r.externalCalls,0);
r=await run('{');assert.equal(r.status,400);
r=await run(' '.repeat(701));assert.equal(r.status,413);
for(const uf of ['MG','GO']){
 const payload={cpf:CPF,uf,success:true,error:false,request_id:'12345678-1234-1234-1234-123456789abc',is_cache:true,nome:'PESSOA DE TESTE',inscricoes_estaduais:[{uf,inscricao_estadual:'123',ativa:true},{uf,inscricao_estadual:'456',ativa:false},{uf,inscricao_estadual:'789'},{uf:'SP',inscricao_estadual:'000',ativa:true}]};
 r=await run({type:'rural',document:CPF,uf,consent:true},{payload});assert.equal(r.status,200);assert.equal(r.data.registrations.length,3);assert.equal(r.data.registrations[2].active,null);assert.equal(r.data.hasActiveRegistration,true);assert(!JSON.stringify(r.data).includes(CPF));
 for(const invalid of [{...payload,error:true},{...payload,success:false},{...payload,uf:'SP'},{...payload,cpf:'11111111111'},{...payload,inscricoes_estaduais:null}]){r=await run({type:'rural',document:CPF,uf,consent:true},{payload:invalid});assert.equal(r.status,503);}
}
r=await run({type:'rural',document:CPF,uf:'MG'});assert.equal(r.status,403);assert.equal(r.externalCalls,0);
r=await run({type:'cnpj',document:'12ABC34501DE35'},{payload:{...company,CNPJ:'12ABC34501DE35',SimplesNacional:null}});assert.equal(r.status,200);
console.log(JSON.stringify({suite:'edge contracts / simulated provider responses',passed:count,realProviderCalls:0}));
