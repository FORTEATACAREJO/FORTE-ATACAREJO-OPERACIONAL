/* FORTECOMPANNY+ IA — perguntas simples e perfil empresarial opcional.
 * Orientação, nunca emissão de NF-e. Perfil salvo somente por ação do usuário.
 */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const KEY='fortecompanny-empresa-local-v1';
const MESSAGES={
 compra:'Você está comprando. Normalmente o fornecedor emite a nota de venda. Aqui orientaremos a conferência da nota recebida e a entrada na sua empresa.',
 venda:'Você está vendendo. Vamos identificar a finalidade da venda e os dados necessários à nota que sua empresa irá emitir.',
 outra:'Selecione a operação no campo “Natureza da operação”. O resultado será orientativo e dependerá dos documentos vinculados.',
 duvida:'Escreva sua pergunta. Nesta versão, dúvidas livres podem ser levadas à Minha IA; a consulta fiscal estruturada começa em Comprar ou Vender.'
};
const choices={
 compra:[
  ['','Para que sua empresa vai usar a mercadoria?'],
  ['ativo','Vou usar como máquina, veículo ou equipamento da empresa'],
  ['revenda','Vou comprar para revender'],
  ['consumo','Vou usar ou consumir na empresa'],
  ['industrializacao','Vou usar para fabricar outros produtos'],
  ['indefinido','Ainda não sei a finalidade']
 ],
 venda:[
  ['','Para quem será feita a venda?'],
  ['revenda','Meu cliente vai revender a mercadoria'],
  ['consumo','Meu cliente vai usar ou consumir'],
  ['indefinido','Ainda não sei como o cliente vai usar']
 ]
};
const nature={
 compra:{ativo:'compra_ativo',revenda:'compra_revenda',consumo:'compra_consumo',
  industrializacao:'compra_industrializacao',indefinido:'compra'},
 venda:{revenda:'venda_revenda',consumo:'venda_consumo',indefinido:'venda'}
};
function setStatus(message){$('myCompanyStatus').textContent=message}
function clearCurrentOutput(){
 window.FORTE_FICHA_EXPORTACAO?.clearSnapshot();
 $('results').hidden=true;$('results').innerHTML='';$('afterActions').hidden=true;
}
function notify(el,type='change'){
 if(el)el.dispatchEvent(new Event(type,{bubbles:true}));
}
function populateChoices(mode){
 const el=$('journeyPurpose');el.replaceChildren();
 for(const [value,label] of (choices[mode]||[])){
  const item=document.createElement('option');
  item.value=value;item.textContent=label;el.appendChild(item);
 }
}
function applyActivity(value){
 const ref={revenda:'profileRevenda',industria:'profileIndustria',
  empresa:'profileEmpresa',consumidor:'profileConsumidor'}[value];
 if(ref){$(ref).checked=true;notify($(ref))}
 if($('journeyMode').value==='compra')$('goodsOrigin').value='desconhecida';
}
function applyRole(mode){
 if(!['compra','venda'].includes(mode))return;
 const role=mode==='compra'?'destino':'origem';
 if($('myRole').value!==role){
  $('myRole').value=role;
  if($('myDoc').value)notify($('myRole'));
 }
 const uf=$('myCompanyUF').value;
 if(uf){
  const own=$(role==='destino'?'toUFManual':'fromUFManual');
  // A UF da empresa configurada prevalece no lado que ela ocupa.
  // O usuário pode corrigir a UF manualmente se a compra/venda for de outro estabelecimento.
  own.value=uf;
 }
 $('fromDocLabel').textContent=mode==='compra'?'CNPJ/CPF do fornecedor (se souber)':'CNPJ/CPF da sua empresa vendedora (se souber)';
 $('toDocLabel').textContent=mode==='compra'?'CNPJ/CPF da sua empresa compradora (se souber)':'CNPJ/CPF do comprador (se souber)';
}
function applyPurpose(){
 const mode=$('journeyMode').value;
 const code=nature[mode]?.[$('journeyPurpose').value]||'';
 if(!code)return;
 if($('nature').value!==code){$('nature').value=code;notify($('nature'))}
 // A origem fiscal do remetente não se confunde com o perfil do comprador.
 if(mode==='compra'&&!$('goodsOrigin').value){
  $('goodsOrigin').value='desconhecida';notify($('goodsOrigin'));
 }
}
function selectMode(mode){
 if(!['compra','venda','outra','duvida'].includes(mode))return;
 $('journeyMode').value=mode;
 document.querySelectorAll('[data-journey]').forEach(btn=>{
  btn.setAttribute('aria-pressed',String(btn.dataset.journey===mode));
 });
 $('journeyPurposeBlock').hidden=!(mode in choices);
 $('journeyQuestionBlock').hidden=mode!=='duvida';
 if(mode in choices){populateChoices(mode)}
 else if(mode==='duvida'){$('journeyQuestion').focus()}
 $('journeyHelp').textContent=MESSAGES[mode];
 if(mode==='compra'||mode==='venda')applyRole(mode);
 if(mode==='outra')$('nature').value='';
 clearCurrentOutput();
}
function applyCompanyDefaults(){
 if($('myCompanyRegime').value){
  $('taxRegime').value=$('myCompanyRegime').value;notify($('taxRegime'));
 }
 if($('myCompanySpecial').value){
  $('specialRegime').value=$('myCompanySpecial').value;notify($('specialRegime'));
 }
 if($('myCompanyActivity').value)applyActivity($('myCompanyActivity').value);
 window.FORTE_TRIAGEM_FISCAL?.refresh();
 applyRole($('journeyMode').value);
}
function saveCompany(){
 const doc=$('myDoc').value.trim();
 if(doc&&$('rememberMe').checked){
  notify($('myDoc'));
  if($('rememberMe').checked===false){setStatus('O documento foi considerado inválido pelo formulário; confira antes de guardar.');return}
 }
 const data={
  document:doc&&$('rememberMe').checked?doc.replace(/[^0-9A-Z]/gi,''):'',
  label:$('myCompanyAlias').value.trim().slice(0,70),
  uf:$('myCompanyUF').value,
  taxRegime:$('myCompanyRegime').value,
  special:$('myCompanySpecial').value,
  activity:$('myCompanyActivity').value
 };
 if(!data.uf&&!data.document){setStatus('Informe ao menos a UF da sua empresa ou um CPF/CNPJ válido para guardar o perfil.');return}
 try{
  localStorage.setItem(KEY,JSON.stringify(data));
  applyCompanyDefaults();
  setStatus('Perfil salvo neste aparelho. Dados de regime especial são declarados, não validados. Para utilizar em outro aparelho será necessário configurar novamente.');
 }catch(_){setStatus('O aparelho não permitiu guardar o perfil. Continue sem salvamento.')}
}
function restoreCompany(){
 let data;
 try{data=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){data=null}
 if(!data||typeof data!=='object')return;
 const uf=String(data.uf||'');
 if(uf&&Array.from($('myCompanyUF').options).some(o=>o.value===uf))$('myCompanyUF').value=uf;
 $('myCompanyAlias').value=String(data.label||'').slice(0,70);
 const defaults=[['myCompanyRegime','taxRegime'],['myCompanySpecial','special'],['myCompanyActivity','activity']];
 for(const [id,key] of defaults){
  if(Array.from($(id).options).some(o=>o.value===data[key]))$(id).value=data[key];
 }
 if(data.document&&/^[A-Z0-9]{11,14}$/.test(data.document)){
  $('myDoc').value=data.document;$('rememberMe').checked=true;
  notify($('myDoc'));
 }
 applyCompanyDefaults();
 setStatus('Perfil local recuperado. Confira se o regime e os dados continuam atuais antes de cada operação.');
}
function forgetCompany(){
 try{localStorage.removeItem(KEY)}catch(_){}
 // Não apagar memória separada do CPF/CNPJ sem consentimento expresso;
 // a opção de lembrar documento deve ser desmarcada pelo próprio usuário.
 ['myCompanyAlias','myCompanyUF','myCompanyRegime','myCompanySpecial','myCompanyActivity'].forEach(id=>{$(id).value=''});
 setStatus('Parâmetros empresariais locais apagados. Para esquecer também o CPF/CNPJ, desmarque “Lembrar meu CPF/CNPJ”.');
}
function exampleMachine(){
 selectMode('compra');$('journeyPurpose').value='ativo';applyPurpose();
 $('myRole').value='destino';
 $('fromCnpj').value='';$('toCnpj').value='';
 $('fromUFManual').value='MG';$('toUFManual').value='GO';
 $('product').value='Máquina para uso da empresa (modelo ainda não identificado)';
 $('declaredNcm').value='';
 $('goodsOrigin').value='desconhecida';
 $('buyerTaxStatus').value='unknown';
 if(!$('profileRevenda').checked&&!$('profileIndustria').checked&&!$('profileEmpresa').checked&&!$('profileConsumidor').checked){
  $('profileEmpresa').checked=true;notify($('profileEmpresa'));
 }
 for(const [id,value] of [['taxRegime','nao_sei'],['specialRegime','nao_sei'],['unusualOperation','nao_sei']]){
  if(!$(id).value){$(id).value=value;notify($(id))}
 }
 window.FORTE_TRIAGEM_FISCAL?.refresh();
 $('journeyHelp').textContent='Demonstração MG → GO pronta: confirme a finalidade e a classificação da máquina, depois consulte. Não foram utilizados CNPJs reais nem presumida obrigação tributária.';
 clearCurrentOutput();
}
function init(){
 document.querySelectorAll('[data-journey]').forEach(btn=>{
  btn.addEventListener('click',()=>selectMode(btn.dataset.journey));
 });
 $('journeyPurpose').addEventListener('change',applyPurpose);
 $('journeyAskIA').addEventListener('click',()=>{
  if(!$('journeyQuestion').value.trim()){
   $('journeyHelp').textContent='Escreva sua dúvida antes de levar à Minha IA.';
   $('journeyQuestion').focus();return;
  }
  $('aiOpen').click();
 });
 $('myCompanySave').addEventListener('click',saveCompany);
 $('myCompanyForget').addEventListener('click',forgetCompany);
 $('exampleMachine').addEventListener('click',exampleMachine);
 $('myCompanyUF').addEventListener('change',()=>applyRole($('journeyMode').value));
 $('myCompanyRegime').addEventListener('change',applyCompanyDefaults);
 $('myCompanySpecial').addEventListener('change',applyCompanyDefaults);
 $('myCompanyActivity').addEventListener('change',applyCompanyDefaults);
 $('journeyQuestion').addEventListener('input',clearCurrentOutput);
 $('clear').addEventListener('click',()=>{
  // Restaura apenas perfil explicitamente salvo; nova consulta inicia sem finalidade anterior.
  $('journeyMode').value='';
  $('journeyPurposeBlock').hidden=true;
  $('journeyQuestionBlock').hidden=true;
  document.querySelectorAll('[data-journey]').forEach(btn=>btn.setAttribute('aria-pressed','false'));
  $('journeyHelp').textContent='Escolha comprar, vender, outra operação ou tirar uma dúvida.';
  restoreCompany();
 });
 restoreCompany();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
root.FORTE_JORNADA=Object.freeze({selectMode,applyPurpose,saveCompany,restoreCompany,
 getIntent:()=>({mode:$('journeyMode').value,purpose:$('journeyPurpose').value,
 question:$('journeyQuestion').value.trim().slice(0,350)})});
})(window);