import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

/**
 * Teste de integração SIMULADO. Os códigos são válidos na base NCM importada em
 * 13/11/2026. Os rótulos são exemplos; isto NÃO confirma classificação fiscal
 * de mercadoria, obrigação CEST ou alíquota por fabricante/UF.
 */
const main=readFileSync(new URL('../consulta-automatica.js',import.meta.url),'utf8');
const triage=readFileSync(new URL('../triagem-fiscal.js',import.meta.url),'utf8');
const helpers=['classificacao.js','st-mg-evidencias.js','qualidade-fiscal.js']
  .map(name=>readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const scenarios=[
 {sector:'alimentos',label:'Arroz polido',ncm:'10063021',uf:'GO'},
 {sector:'alimentos',label:'Café torrado',ncm:'09012100',uf:'SP'},
 {sector:'calçados',label:'Tênis de couro',ncm:'64039990',uf:'MG'},
 {sector:'vestuário',label:'Camiseta algodão',ncm:'61091000',uf:'RJ'},
 {sector:'vestuário',label:'Calça de algodão',ncm:'62034200',uf:'PR'},
 {sector:'eletrônicos',label:'Notebook portátil',ncm:'84713012',uf:'SP'},
 {sector:'máquinas',label:'Máquina industrial',ncm:'84798999',uf:'MT'},
 {sector:'farmacêutico',label:'Medicamento',ncm:'30049099',uf:'CE'},
 {sector:'veículos',label:'Automóvel',ncm:'87032310',uf:'MG'},
 {sector:'construção',label:'Cimento CP II F32',ncm:'25232910',uf:'MG'}
];
const IDS='taxRegime specialRegime specialKind specialScope specialValidity specialAct specialFields unusualOperation unusualKind unusualFields operationDate triageStatus triageFiscal goodsOrigin priorSt priorStContainer buyerTaxStatus nature fromCnpj toCnpj product declaredNcm profileRevenda profileIndustria profileConsumidor profileHelp goodsOriginHelp myDoc myRole rememberMe myDocStatus companyNameSearch companyUfSearch companyTarget companySearchStatus companySearchResults searchCompanies registerCompany registerBox registerRole registerName registerAccept registerState message results afterActions submit consultation clear print removeSaved swapCnpj swapStatus'.split(' ');
const mk=()=>({value:'',checked:false,hidden:false,disabled:false,textContent:'',innerHTML:'',selectedOptions:[],
 handlers:{},addEventListener(type,fn){this.handlers[type]=fn},appendChild(){},replaceChildren(){},contains(){return true},reset(){}});

function validCnpj(base){
 const check=(numbers,weights)=>{
  const sum=[...numbers].reduce((acc,c,i)=>acc+Number(c)*weights[i],0);
  return sum%11<2?'0':String(11-sum%11);
 };
 const a=base+check(base,[5,4,3,2,9,8,7,6,5,4,3,2]);
 return a+check(a,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
}
const FROM=validCnpj('112223330001'),TO=validCnpj('998887770001');

function setup({label='Produto de teste',ncm='',uf='MG',candidate='',family=false}={}){
 const e=Object.fromEntries(IDS.map(id=>[id,mk()]));
 const document={getElementById(id){if(!e[id])throw Error('element_missing:'+id);return e[id]},createElement:mk};
 e.taxRegime.value='normal';e.specialRegime.value='nao';e.unusualOperation.value='nao';
 e.profileRevenda.checked=true;e.goodsOrigin.value='terceiros';e.priorSt.value='unknown';e.buyerTaxStatus.value='unknown';
 e.nature.value='venda_revenda';e.nature.selectedOptions=[{textContent:'Venda para revenda'}];
 e.fromCnpj.value=FROM;e.toCnpj.value=TO;e.product.value=label;e.declaredNcm.value=ncm;
 const win={};
 for(const script of helpers)vm.runInNewContext(script,{window:win},{timeout:1000});
 vm.runInNewContext(triage,{window:win,document},{timeout:1000});
 const urls=[];
 const fetch=async url=>{
  const u=String(url);urls.push(u);let result={};
  if(u.endsWith('/status'))result={cnpjAvailable:false};
  else if(u.includes('brasilapi.com.br'))result={cnpj:u.split('/').at(-1),
   uf:u.endsWith(FROM)?'GO':uf,razao_social:'EMPRESA FICTICIA',opcao_pelo_simples:false};
  else if(u.includes('/code?code='))result={entry:{codigo:ncm||candidate,nivel:8,descricao:'Código presente na base NCM'}};
  else if(u.includes('/cest-by-ncm'))result={items:[]};
  else if(u.includes('/regras-nacionais/route'))result={ufs:[],verifiedRules:[],verifiedRuleCount:0};
  else if(u.includes('/search?q='))result={items:family?[{codigo:'1006',nivel:4,descricao:'Arroz'}]:
   candidate?[{codigo:candidate,nivel:8,descricao:'Possível classificação oficial'}]:[]};
  else if(u.includes('/family?prefix='))result={items:candidate?[{codigo:candidate,nivel:8,descricao:'Código da família NCM'}]:[],hasMore:false};
  return {ok:true,status:200,json:async()=>result};
 };
 vm.runInNewContext(main,{window:win,document,fetch,
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},
  setTimeout:()=>1,clearTimeout:()=>{},AbortController:class{constructor(){this.signal={}}abort(){}}
 },{timeout:1000});
 return {e,urls};
}

for(const c of scenarios){
 test('orientação de NCM opcional em produto do setor '+c.sector+': '+c.ncm,async()=>{
  const {e,urls}=setup(c);
  await e.consultation.handlers.submit({preventDefault(){}});
  const output=e.results.innerHTML,pretty=c.ncm.slice(0,4)+'.'+c.ncm.slice(4,6)+'.'+c.ncm.slice(6);
  assert.ok(output.includes(pretty));
  assert.match(output,/Ficha orientativa — não homologada/);
  assert.ok(urls.some(x=>x.includes('code?code='+c.ncm)));
  assert.equal(e.message.textContent,'');
  if(c.sector!=='construção')assert.match(output,/pode não ser aplicável/);
 });
}
test('produto não catalogado mostra candidatos oficiais em vez de inventar NCM',async()=>{
 const {e,urls}=setup({label:'Peça especial de equipamento',candidate:'84798999'});
 await e.consultation.handlers.submit({preventDefault(){}});
 assert.match(e.results.innerHTML,/Confirmar NCM do produto/);
 assert.match(e.results.innerHTML,/data-confirm-ncm="84798999"/);
 e.results.handlers.click({target:{closest(name){return name==='[data-confirm-ncm]'?{dataset:{confirmNcm:'84798999'}}:null}}});
 for(let i=0;i<35;i++)await Promise.resolve();
 assert.equal(e.declaredNcm.value,'84798999');
 assert.ok(urls.some(x=>x.includes('code?code=84798999')));
 assert.match(e.results.innerHTML,/Ficha orientativa — não homologada/);
});
test('NCM informado com menos de oito dígitos é rejeitado',async()=>{
 const {e}=setup({label:'Produto de teste',ncm:'8479'});
 await e.consultation.handlers.submit({preventDefault(){}});
 assert.match(e.message.textContent,/oito dígitos/);
});

test('busca por todos os produtos encontra código em grupo NCM sem inferir classificação',async()=>{
 const {e,urls}=setup({label:'Arroz polido',candidate:'10063021',family:true});
 await e.consultation.handlers.submit({preventDefault(){}});
 assert.ok(urls.some(x=>x.includes('/family?prefix=1006')));
 assert.match(e.results.innerHTML,/data-confirm-ncm="10063021"/);
 assert.match(e.results.innerHTML,/Confirmar NCM do produto/);
});
