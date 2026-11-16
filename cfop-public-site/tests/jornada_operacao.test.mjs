import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../jornada-operacao.js',import.meta.url),'utf8');
const ids='guidedStart journeyMode journeyPurposeBlock journeyPurpose journeyPurposeLabel purchaseChecks purchaseSellerType purchaseInvoiceStatus assetUse assetUseBlock journeyQuestionBlock journeyQuestion journeyHelp journeyAskIA exampleMachine myCompanyAlias myCompanyUF myCompanyRegime myCompanySpecial myCompanyActivity myCompanySave myCompanyForget myCompanyStatus fromUFManual toUFManual fromDocLabel toDocLabel goodsOrigin buyerTaxStatus nature fromCnpj toCnpj product declaredNcm profileRevenda profileIndustria profileEmpresa profileConsumidor myDoc myRole rememberMe taxRegime specialRegime results afterActions clear'.split(' ');
function rig(store=new Map()){
 const E=()=>({value:'',checked:false,hidden:false,disabled:false,textContent:'',innerHTML:'',options:[],handlers:{},
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn)},
  dispatchEvent(e){for(const fn of this.handlers[e.type]||[])fn(e)},
  appendChild(child){this.options.push(child)},replaceChildren(){this.options=[]},
  setAttribute(k,v){this[k]=v},click(){this.clicked=(this.clicked||0)+1;for(const fn of this.handlers.click||[])fn()},
  focus(){},reset(){}});
 const e=Object.fromEntries(ids.map(id=>[id,E()]));
 const buttons=['compra','venda','outra','duvida'].map(x=>Object.assign(E(),{dataset:{journey:x}}));
 for(const id of ['myCompanyUF','fromUFManual','toUFManual'])e[id].options=['','GO','MG','SP'].map(value=>({value}));
 for(const [id,list] of Object.entries({myCompanyRegime:['','simples','normal'],myCompanySpecial:['','sim','nao','nao_sei'],myCompanyActivity:['','empresa','revenda','industria','consumidor']}))
  e[id].options=list.map(value=>({value}));
 const document={readyState:'complete',getElementById(id){if(!e[id])throw Error('DOM '+id);return e[id]},
  querySelectorAll(s){return s==='[data-journey]'?buttons:[]},createElement:()=>E()};
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const window={};
 vm.runInNewContext(code,{window,document,localStorage,Event:class{constructor(type){this.type=type}}},{timeout:1000});
 return{e,window,store,buttons};
}
test('empresa cadastrada apenas no aparelho e somente por botão expresso',()=>{
 const x=rig();
 x.e.myCompanyUF.value='GO';x.e.myCompanyRegime.value='normal';
 assert.equal(x.store.size,0);
 x.e.myCompanySave.click();
 assert.equal(x.store.size,1);
 assert.equal(JSON.parse([...x.store.values()][0]).document,'');
});
test('a empresa salva é restaurada sem sincronização externa',()=>{
 const x=rig();x.e.myCompanyUF.value='GO';x.e.myCompanyRegime.value='normal';
 x.e.myCompanySpecial.value='nao';x.e.myCompanyActivity.value='empresa';x.e.myCompanySave.click();
 const y=rig(x.store);
 assert.equal(y.e.myCompanyUF.value,'GO');assert.equal(y.e.taxRegime.value,'normal');
 assert.equal(y.e.specialRegime.value,'nao');assert.equal(y.e.profileEmpresa.checked,true);
});
test('comprar máquina para uso da empresa orienta a compra de ativo, empresa é destino',()=>{
 const x=rig();x.e.myCompanyUF.value='GO';
 x.window.FORTE_JORNADA.selectMode('compra');
 x.e.journeyPurpose.value='ativo';x.window.FORTE_JORNADA.applyPurpose();
 assert.equal(x.e.myRole.value,'destino');assert.equal(x.e.toUFManual.value,'GO');
 assert.equal(x.e.nature.value,'compra_ativo');
 assert.equal(x.e.goodsOrigin.value,'desconhecida');
});
test('ao trocar compra por venda a UF da empresa muda de lado sem preencher o comprador',()=>{
 const x=rig();x.e.myCompanyUF.value='GO';
 x.window.FORTE_JORNADA.selectMode('compra');
 x.window.FORTE_JORNADA.selectMode('venda');
 x.e.journeyPurpose.value='revenda';x.window.FORTE_JORNADA.applyPurpose();
 assert.equal(x.e.myRole.value,'origem');assert.equal(x.e.fromUFManual.value,'GO');
 assert.equal(x.e.toUFManual.value,'');
 assert.equal(x.e.nature.value,'venda_revenda');
});
test('pergunta livre abre apenas a IA escolhida, sem enviar automaticamente o conteúdo',()=>{
 const x=rig();x.window.FORTE_JORNADA.selectMode('duvida');
 x.e.journeyQuestion.value='Como comprar uma máquina de Minas Gerais para Goiás?';
 x.e.journeyAskIA.click();
 assert.equal(x.e.journeyQuestion.value,'Como comprar uma máquina de Minas Gerais para Goiás?');
 assert.equal(x.e.journeyMode.value,'duvida');
});
test('exemplo MG → GO não inventa documentos nem NCM ou valor de DIFAL',()=>{
 const x=rig();x.e.exampleMachine.click();
 assert.equal(x.e.fromUFManual.value,'MG');
 assert.equal(x.e.toUFManual.value,'GO');
 assert.equal(x.e.nature.value,'compra_ativo');
 assert.equal(x.e.fromCnpj.value,'');
 assert.equal(x.e.toCnpj.value,'');
 assert.equal(x.e.declaredNcm.value,'');
 assert.equal(x.e.taxRegime.value,'nao_sei');
});
test('esquecer perfil não apaga automaticamente a preferência separada de CPF/CNPJ',()=>{
 const x=rig();
 x.e.myCompanyUF.value='GO';x.e.myCompanySave.click();
 x.store.set('other-identity','saved-by-user');
 x.e.myCompanyForget.click();
 assert.equal(x.store.has('other-identity'),true);
 assert.equal(x.store.size,1);
});

test('a compra abre perguntas de fornecedor e documento, e somente o ativo abre pergunta de patrimônio',()=>{
 const x=rig();x.window.FORTE_JORNADA.selectMode('compra');
 assert.equal(x.e.purchaseChecks.hidden,false);
 x.e.journeyPurpose.value='revenda';x.window.FORTE_JORNADA.applyPurpose();
 assert.equal(x.e.assetUseBlock.hidden,true);
 x.e.journeyPurpose.value='ativo';x.window.FORTE_JORNADA.applyPurpose();
 assert.equal(x.e.assetUseBlock.hidden,false);
 x.e.purchaseSellerType.value='pessoa_fisica';
 x.e.purchaseInvoiceStatus.value='nao_emitida';
 x.e.assetUse.value='sim';
 const intent=x.window.FORTE_JORNADA.getIntent();
 assert.equal(intent.sellerType,'pessoa_fisica');
 assert.equal(intent.invoiceStatus,'nao_emitida');
 assert.equal(intent.assetUse,'sim');
 x.window.FORTE_JORNADA.selectMode('venda');
 assert.equal(x.e.purchaseChecks.hidden,true);
 assert.equal(x.window.FORTE_JORNADA.getIntent().sellerType,null);
});
