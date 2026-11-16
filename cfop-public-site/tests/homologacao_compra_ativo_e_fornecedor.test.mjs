import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const load=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const [main,journey,triage,catalog,qa,st]=['consulta-automatica.js','jornada-operacao.js','triagem-fiscal.js','classificacao.js','qualidade-fiscal.js','st-mg-evidencias.js'].map(load);
const ids='guidedStart journeyMode journeyPurposeBlock journeyPurpose journeyPurposeLabel journeyQuestionBlock journeyQuestion journeyHelp journeyAskIA exampleMachine purchaseChecks purchaseSellerType purchaseInvoiceStatus assetUse assetUseBlock myCompanyAlias myCompanyUF myCompanyRegime myCompanySpecial myCompanyActivity myCompanySave myCompanyForget myCompanyStatus fromUFManual toUFManual fromDocLabel toDocLabel goodsOrigin priorSt priorStContainer buyerTaxStatus nature fromCnpj toCnpj product declaredNcm profileRevenda profileIndustria profileEmpresa profileConsumidor profileHelp goodsOriginHelp myDoc myRole rememberMe myDocStatus companyNameSearch companyUfSearch companyTarget companySearchStatus companySearchResults searchCompanies registerCompany registerBox registerRole registerName registerAccept registerState message results afterActions submit consultation clear print removeSaved swapCnpj swapStatus taxRegime specialRegime specialKind specialScope specialValidity specialAct specialFields unusualOperation unusualKind unusualFields operationDate triageStatus triageFiscal aiOpen'.split(' ');
const cases=[
 {name:'máquina para ativo',mode:'compra',purpose:'ativo',seller:'empresa',regime:'normal',asset:'sim',ncm:'84798999',cfop:'2.551 ou 2.406'},
 {name:'máquina comprada de pessoa física',mode:'compra',purpose:'ativo',seller:'pessoa_fisica',regime:'normal',asset:'sim',ncm:'84798999',cfop:'Confirmar documento de entrada e CFOP aplicável'},
 {name:'compra de produtor rural',mode:'compra',purpose:'revenda',seller:'produtor_rural',regime:'normal',ncm:'10063021',cfop:'Confirmar documento de entrada e CFOP aplicável'},
 {name:'máquina não será ativo',mode:'compra',purpose:'ativo',seller:'empresa',regime:'normal',asset:'nao',ncm:'84798999',cfop:'Finalidade da compra a corrigir'},
 {name:'máquina de empresa Simples',mode:'compra',purpose:'ativo',seller:'empresa',regime:'simples',asset:'sim',ncm:'84798999',cfop:'2.551 ou 2.406'},
 {name:'máquina sem NCM validado',mode:'compra',purpose:'ativo',seller:'empresa',regime:'normal',asset:'sim',ncm:'',cfop:'Confirmar NCM do produto'},
 {name:'venda interestadual comum',mode:'venda',purpose:'revenda',regime:'normal',ncm:'64039990',cfop:'6.102 ou 6.108'}
];
function fixture(c){
 const E=()=>({value:'',checked:false,hidden:false,disabled:false,innerHTML:'',textContent:'',selectedOptions:[{textContent:'Natureza declarada'}],options:[],events:{},
 addEventListener(k,fn){(this.events[k]??=[]).push(fn)},dispatchEvent(x){for(const fn of this.events[x.type]||[])fn(x)},
 appendChild(x){this.options.push(x)},replaceChildren(){this.options=[]},setAttribute(k,v){this[k]=v},contains(){return true},focus(){},scrollIntoView(){},click(){for(const fn of this.events.click||[])fn()},reset(){}});
 const els=Object.fromEntries(ids.map(k=>[k,E()]));
 const buttons=['compra','venda','outra','duvida'].map(mode=>Object.assign(E(),{dataset:{journey:mode}}));
 for(const k of ['myCompanyUF','fromUFManual','toUFManual'])els[k].options=['','MG','GO'].map(value=>({value}));
 for(const [k,opts] of Object.entries({myCompanyRegime:['','normal','simples'],myCompanySpecial:['','nao','sim'],myCompanyActivity:['','empresa','revenda']}))
  els[k].options=opts.map(value=>({value}));
 const document={readyState:'complete',getElementById(id){if(!els[id])throw Error('DOM missing '+id);return els[id]},
 querySelectorAll(q){return q==='[data-journey]'?buttons:[]},createElement:()=>E(),addEventListener(){}};
 const window={};
 for(const script of [catalog,qa,st])vm.runInNewContext(script,{window},{timeout:1000});
 vm.runInNewContext(triage,{window,document},{timeout:1000});
 const requests=[];
 const fetch=async url=>{
  const u=String(url);requests.push(u);
  let x={};
  if(u.endsWith('/status'))x={cnpjAvailable:false};
  else if(u.includes('/code?code='))x={entry:{nivel:8,codigo:c.ncm,descricao:'Produto simulado'}};
  else if(u.includes('/cest-by-ncm'))x={items:[]};
  else if(u.includes('/search?q='))x={items:[]};
  else if(u.includes('/regras-nacionais/route'))x={verifiedRules:[],verifiedRuleCount:0,ufs:[]};
  return {ok:true,status:200,json:async()=>x};
 };
 const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 vm.runInNewContext(main,{window,document,fetch,localStorage,
 setTimeout:()=>1,clearTimeout:()=>{},AbortController:class{constructor(){this.signal={}}abort(){}}
 },{timeout:1000});
 vm.runInNewContext(journey,{window,document,localStorage,Event:class{constructor(type){this.type=type}}},{timeout:1000});
 return {e:els,window,requests};
}
for(const c of cases){
 test('homologação funcional: '+c.name,async()=>{
  const {e,window,requests}=fixture(c);
  window.FORTE_JORNADA.selectMode(c.mode);
  e.journeyPurpose.value=c.purpose;window.FORTE_JORNADA.applyPurpose();
  e.fromUFManual.value=c.mode==='compra'?'MG':'GO';
  e.toUFManual.value=c.mode==='compra'?'GO':'MG';
  e.profileEmpresa.checked=c.mode==='compra';e.profileRevenda.checked=c.mode==='venda';
  e.goodsOrigin.value=c.mode==='compra'?'desconhecida':'terceiros';
  e.purchaseSellerType.value=c.seller||'nao_sei';
  e.purchaseInvoiceStatus.value='nao_emitida';e.assetUse.value=c.asset||'nao_sei';
  e.product.value=c.ncm?'Produto com NCM informado':'Máquina sem especificação';
  e.declaredNcm.value=c.ncm;
  e.taxRegime.value=c.regime;e.specialRegime.value='nao';e.unusualOperation.value='nao';
  e.buyerTaxStatus.value='unknown';
  await e.consultation.events.submit[0]({preventDefault(){}});
  const result=e.results.innerHTML,cfop=result.match(/class="result-value">([^<]*)/)?.[1]||null;
  assert.equal(cfop,c.cfop);
  assert.equal(e.message.textContent,'');
  assert.match(result,/Ficha orientativa — não homologada/);
  if(c.mode==='compra'){
   assert.match(result,/Como proceder com sua compra/);
   assert.ok(requests.every(u=>!u.includes('brasilapi.com.br')));
   if(c.seller==='pessoa_fisica')assert.match(result,/não presumir NF-e de saída/i);
   if(c.regime==='simples')assert.match(result,/não presumir créditos normais de ICMS\/CIAP/i);
   if(c.asset==='nao')assert.match(result,/Finalidade da compra a corrigir/);
  }
 });
}
