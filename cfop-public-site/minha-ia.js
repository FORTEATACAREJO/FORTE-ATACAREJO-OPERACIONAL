/* FORTECOMPANNY+ IA — usar a IA que o usuário já utiliza.
 * Não conecta contas; não solicita credenciais; não usa API paga.
 * O aplicativo copia uma pergunta fiscal sem documentos pessoais e abre o serviço escolhido.
 */
(function(){
 'use strict';
 const urls=Object.freeze({
  chatgpt:'https://chatgpt.com/',
  gemini:'https://gemini.google.com/app',
  claude:'https://claude.ai/',
  copilot:'https://copilot.microsoft.com/'
 });
 const names=Object.freeze({chatgpt:'ChatGPT',gemini:'Gemini',claude:'Claude',copilot:'Copilot',outro:'minha IA'});
 const key='fortecompanny-ai-provider-v1';
 const el=id=>document.getElementById(id);
 const onlyWords=value=>String(value||'').replace(/\b(?:\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11,14})\b/g,'[documento omitido]').slice(0,170);
 const state=()=>({
  provider:el('aiProvider').value,
  profile:document.querySelector('input[name="userProfile"]:checked')?.value||'não informado',
  nature:el('nature')?.selectedOptions?.[0]?.textContent?.trim()||'não informada',
  goodsOrigin:el('goodsOrigin')?.selectedOptions?.[0]?.textContent?.trim()||'não informada',
  st:el('priorStContainer')?.hidden?'não se aplica/sem confirmação':el('priorSt')?.selectedOptions?.[0]?.textContent?.trim()||'não confirmada',
  product:onlyWords(el('product')?.value),
  taxStatus:el('buyerTaxStatus')?.value||'unknown'
 });
 function prompt(){
  const v=state(),result=el('results');
  const hasResult=result&&!result.hidden;
  const route=hasResult?result.querySelector('p.muted')?.textContent?.match(/\b([A-Z]{2})\s*→\s*([A-Z]{2})\b/):null;
  const rawCFOP=hasResult?result.querySelector('.result-value')?.textContent?.trim():'';
  const boxes=hasResult?Array.from(result.querySelectorAll('.result-compact>div strong')):[];
  const ncm=boxes[1]?.textContent?.trim()||'não conferido';
  const cest=boxes[2]?.textContent?.trim()||'não conferido';
  const base=[
   'Ajude-me a CONFERIR uma orientação fiscal para NF-e brasileira. Não emita nota nem considere a ficha homologada.',
   'Origem da orientação: FORTECOMPANNY+ IA (versão experimental em validação).',
   'Perfil do usuário: '+v.profile+'.',
   'Operação/finalidade: '+onlyWords(v.nature)+'.',
   'Origem da mercadoria declarada: '+onlyWords(v.goodsOrigin)+'.',
   'Produto: '+(v.product||'não informado')+'.',
   'ST na aquisição anterior: '+onlyWords(v.st)+'.',
   'Condição de contribuinte do destinatário: '+(v.taxStatus==='sim'?'informado como contribuinte; IE ainda precisa de validação':v.taxStatus==='nao'?'informado como não contribuinte; comprovar condição':'não confirmada')+'.'
  ];
  if(route)base.push('UF remetente: '+route[1]+'; UF destinatário: '+route[2]+'.');
  if(hasResult){
   base.push('CFOP sugerido pela plataforma, ainda não homologado: '+onlyWords(rawCFOP||'indefinido')+'.');
   base.push('NCM indicado: '+onlyWords(ncm)+'; CEST indicado: '+onlyWords(cest)+'.');
  }
  base.push('Preciso de explicação objetiva, com fontes oficiais e normas vigentes na data da operação, e indicação dos dados ainda necessários para CFOP, CST/CSOSN, ICMS, ICMS-ST, DIFAL, FCP, PIS, COFINS, IPI, IBS/CBS. Informe quem poderá recolher tributos adicionais ao estado de destino, sem inventar valores.');
  base.push('Não presuma que ST anterior em uma UF quita a ST da UF de destino. Se não houver comprovação, diga expressamente que não é possível fechar a parametrização.');
  base.push('Não foram enviados automaticamente CPF/CNPJ, razão social, XML, nomes de pessoas ou acesso a contas. Não deduza que a IA conhece todos os detalhes omitidos.');
  return base.join('\n');
 }
 function setStatus(message){el('aiStatus').textContent=message;}
 function update(){
  const id=el('aiProvider').value;
  el('aiOpen').textContent=id&&id!=='outro'?'Perguntar ao '+names[id]:'Perguntar à minha IA';
  if(id) setStatus('Preferência: '+names[id]+'. A pergunta será copiada sem CPF/CNPJ. Você decidirá se deseja enviá-la.');
  else setStatus('Escolha a IA que já utiliza; nenhuma conta será conectada automaticamente.');
 }
 try{
  const remembered=localStorage.getItem(key);
  if(Object.hasOwn(names,remembered))el('aiProvider').value=remembered;
 }catch(_){}
 update();
 el('aiProvider').addEventListener('change',()=>{
  const id=el('aiProvider').value;
  try{if(id)localStorage.setItem(key,id);else localStorage.removeItem(key)}catch(_){}
  update();
 });
 function showPrompt(value,message){
  const field=el('aiManualPrompt');
  field.hidden=false;field.value=value;
  setStatus(message);
 }
 async function copy(value){
  if(!navigator.clipboard?.writeText)return false;
  try{await navigator.clipboard.writeText(value);return true}catch(_){return false}
 }
 el('aiCopy').addEventListener('click',async()=>{
  const q=prompt(),copied=await copy(q);
  if(copied){el('aiManualPrompt').hidden=true;setStatus('Pergunta copiada. Abra a IA da sua preferência e cole o texto.');}
  else showPrompt(q,'Selecione e copie o texto abaixo para usar na sua IA.');
 });
 el('aiOpen').addEventListener('click',async()=>{
  const id=el('aiProvider').value;
  if(!id){
   el('aiSettings').open=true;el('aiProvider').focus();
   setStatus('Primeiro escolha qual IA você já utiliza.');return;
  }
  const q=prompt();
  // A abertura não envia a pergunta. O usuário a cola e decide se quer compartilhar.
  const pendingCopy=copy(q);
  let newTab=null;
  if(urls[id]){
   try{newTab=window.open(urls[id],'_blank','noopener,noreferrer')}catch(_){}
  }
  const copied=await pendingCopy;
  if(copied){
   el('aiManualPrompt').hidden=true;
   setStatus(urls[id]?
    'Pergunta copiada. Na aba da '+names[id]+', cole o texto e envie somente se concordar.':
    'Pergunta copiada. Cole na IA que você já utiliza.');
  }else{
   showPrompt(q,'Não foi possível copiar automaticamente. Selecione o texto abaixo, copie e cole na sua IA.');
  }
  if(urls[id]&&!newTab)setStatus(el('aiStatus').textContent+' Se a IA não abriu, permita a abertura de uma nova aba.');
 });
})();
