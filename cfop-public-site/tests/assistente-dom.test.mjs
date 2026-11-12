import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const html=readFileSync(new URL('../assistente.html',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
let errors=[],flows=0,checks=0;
async function app(){let lookups=0,release=null;const dom=new JSDOM(html,{url:'https://cfop.test/',runScripts:'dangerously',beforeParse(w){
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.addEventListener('error',e=>errors.push(e.message));
 w.fetch=async(url,options)=>{
  if(url.endsWith('/status'))return Response.json({cnpjAvailable:true,ruralAvailable:true});
  if(url.endsWith('/lookup')){lookups++;const b=JSON.parse(options.body);if(release)await release;return Response.json({name:'CADASTRO DE TESTE',uf:b.uf||'MG',city:'Cidade de teste',simplesNacional:false,source:'Provedor simulado',verifiedAt:'2026-11-12T20:00:00Z',verificationState:'retorno_de_intermediario',registrations:[{ie:'123',uf:b.uf||'MG',active:true},{ie:'456',uf:b.uf||'MG',active:false}]});}
  return Response.json({ok:true});
 };
}});await tick();const d=dom.window.document;
const el=id=>d.getElementById(id),input=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new dom.window.Event('input'));el(id).dispatchEvent(new dom.window.Event('change'));};
return {dom,d,el,input,lookups:()=>lookups,delay:p=>release=p};}
for(const op of ['entrada','saida'])for(const own of ['company','rural','person'])for(const other of ['company','rural','person']){
 const a=await app();const {d,el,input}=a;d.querySelector(`[data-entry-operation="${op}"]`).click();
 if(own!=='company')d.querySelector(`[data-profile="${own}"]`).click();
 input(own==='company'?'ownCnpj':'ownCpf',own==='company'?'99999999000191':'52998224725');
 if(own==='rural'){input('ownIe','123');input('ownUf','GO');}
 el('accept').checked=true;await el('saveOwn').onclick();assert(!el('step2').classList.contains('hidden'));
 assert(el('counterpartyTitle').textContent.includes(op==='entrada'?'comprando':'vendendo'));
 if(own==='rural')assert.equal(el(op==='entrada'?'destUf':'originUf').value,'GO');
 if(other!=='company')d.querySelector(`[data-other-kind="${other}"]`).click();
 input('otherDoc',other==='company'?'12ABC34501DE35':'52998224725');
 if(other==='rural'){input('otherIe','456');input('otherIeUf','MG');}
 el('next2').click();assert(!el('step3').classList.contains('hidden'));input('product','Produto de teste');el('next3').click();await tick();
 assert(!el('step4').classList.contains('hidden'));assert(el('summary').textContent.includes('Pendente de validação'));flows++;a.dom.window.close();
}
const a=await app(),{el,input,d}=a;d.querySelector('[data-entry-operation="saida"]').click();d.querySelector('[data-profile="rural"]').click();input('ownCpf','52998224725');input('ownUf','GO');el('accept').checked=true;
await el('lookupOwn').onclick();assert.equal(a.lookups(),0);assert(el('msg').textContent.includes('autorize'));checks++;
el('ownRuralConsent').checked=true;await el('lookupOwn').onclick();assert.equal(el('ownIe').value,'');assert(!el('ownRegistrationsWrap').classList.contains('hidden'));checks++;
input('ownRegistrations','1');el('ownRegistrations').onchange();assert.equal(el('ownIe').value,'456');assert(el('ownStatus').textContent.includes('não optante'));checks++;
input('ownUf','MG');assert(el('ownRegistrationsWrap').classList.contains('hidden'));checks++;
let release;const delay=new Promise(r=>release=r);a.delay(delay);const pending=el('lookupOwn').onclick();input('ownCpf','11111111111');el('ownName').value='NOME DIGITADO';release();await pending;assert(el('ownRegistrationsWrap').classList.contains('hidden'));assert.equal(el('ownName').value,'NOME DIGITADO');checks++;
a.dom.window.close();assert.deepEqual(errors,[]);
console.log(JSON.stringify({suite:'DOM execution / simulated network, no remote writes',flowsPassed:flows,additionalChecks:checks,pageErrors:errors}));
