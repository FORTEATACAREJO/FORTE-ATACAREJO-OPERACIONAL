(function(){
'use strict';
const $=id=>document.getElementById(id);
const CAD='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-cadastros';
const NCM='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-ncm';
const REGISTER='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/consulta-cfop/api/access';
const COMPANY_KEY='fortecompanny-optional-company-v1';
const TERMS='cfop-privacy-2026-11-12-v1';
const ufList=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
let providerReady=null,runId=0,lastInput=null;
function normCnpj(value){return String(value||'').toUpperCase().replace(/[^0-9A-Z]/g,'')}
function validCnpj(v){
 const c=normCnpj(v);
 if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(c)||c.slice(0,12)===c[0].repeat(12))return false;
 const weights1=[5,4,3,2,9,8,7,6,5,4,3,2],weights2=[6,5,4,3,2,9,8,7,6,5,4,3,2];
 function digit(str,weights){let sum=0;for(let i=0;i<weights.length;i++)sum+=(str.charCodeAt(i)-48)*weights[i];const rem=sum%11;return rem<2?0:11-rem}
 const a=digit(c.slice(0,12),weights1);return c.slice(12)===String(a)+String(digit(c.slice(0,12)+a,weights2));
}
function safe(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
function short(str,n=150){return String(str||'').slice(0,n)}
function digits(s){return String(s||'').replace(/\D/g,'')}
function ncmFmt(x){return digits(x).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1.$2.$3')}
function cestFmt(x){return digits(x).replace(/^(\d{2})(\d{3})(\d{2})$/,'$1.$2.$3')}
function validUf(x){return ufList.has(String(x||'').toUpperCase())}
async function jsonFetch(url,opts={},ms=9500){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),ms);
 try{
  const response=await fetch(url,{...opts,signal:controller.signal,cache:'no-store'});
  let body={};try{body=await response.json()}catch(e){}
  if(!response.ok)throw Error('HTTP '+response.status+(body.error?' — '+short(body.error,75):''));
  return body;
 }finally{clearTimeout(timeout)}
}
async function registryStatus(){
 if(providerReady!==null)return providerReady;
 try{providerReady=await jsonFetch(CAD+'/status',{},4000)}
 catch(e){providerReady={cnpjAvailable:false}}
 return providerReady;
}
function registeredSource(x,doc){
 return {cnpj:doc,name:short(x.name||x.tradeName,120),uf:validUf(x.uf)?x.uf:'',
 city:short(x.city,90),situation:short(x.situation,90),simple:x.simplesNacional===true?'Optante do Simples Nacional (informação da API)':x.simplesNacional===false?'Não optante pelo Simples; Real/Presumido não confirmado':'Regime não confirmado',
 registrations:Array.isArray(x.registrations)?x.registrations.filter(i=>i&&i.ie).map(i=>({ie:String(i.ie),uf:i.uf,status:i.situacao||i.situation||'',active:i.active})):[],
 source:short(x.source||'CNPJ API — base pública da RFB',130),seen:x.verifiedAt||null,kind:'provider',verified:true};
}
function brasilSource(x,doc){
 const regimes=Array.isArray(x.regime_tributario)?x.regime_tributario:[];
 const year=new Date().getFullYear();
 const currentRegimes=regimes.filter(r=>r&&Number(r.ano)===year && r.forma_de_tributacao);
 const simple=x.opcao_pelo_simples===true?'Optante do Simples Nacional (base pública intermediária)':x.opcao_pelo_simples===false?'Não optante pelo Simples; Real/Presumido não confirmado':'Regime não confirmado';
 return {cnpj:doc,name:short(x.razao_social||x.nome_fantasia,120),uf:validUf(x.uf)?x.uf:'',
 city:short(x.municipio,90),situation:short(x.descricao_situacao_cadastral,90),
 simple:currentRegimes.length?short(currentRegimes.map(r=>r.forma_de_tributacao).join(', '),140)+' — ano '+year:simple,
 registrations:[],source:'BrasilAPI / Minha Receita (fonte intermediária; IE não consultada)',seen:new Date().toISOString(),kind:'brasilapi',verified:false};
}
async function company(doc){
 const status=await registryStatus();
 if(status.cnpjAvailable){
  try{
   const r=await jsonFetch(CAD+'/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'cnpj',document:doc,includeIE:true})},10500);
   return registeredSource(r,doc);
  }catch(e){/* Falha do provedor pode permitir consulta por fonte aberta, sem simular IE. */}
 }
 try{
  const r=await jsonFetch('https://brasilapi.com.br/api/cnpj/v1/'+encodeURIComponent(doc),{},10000);
  if(normCnpj(r.cnpj)!==doc)throw Error('cnpj_incompativel');
  return brasilSource(r,doc);
 }catch(e){
  return {cnpj:doc,name:'Não encontrado automaticamente',uf:'',city:'',situation:'',simple:'Regime não confirmado',registrations:[],
   source:'Consulta cadastral indisponível',seen:null,kind:'unavailable',verified:false};
 }
}
function productHint(label){
 const api=window.FORTE_CLASSIFICACAO;
 return api&&api.suggest?api.suggest(label):null;
}
async function productInfo(label){
 const suggest=productHint(label);
 let code=suggest&&/^\d{8}$/.test(suggest.ncm||'')?suggest.ncm:'';
 let official=null,cests=[],issues=[],results=[];
 if(code){
  try{official=await jsonFetch(NCM+'/code?code='+encodeURIComponent(code),{},9000);
   if(!official?.entry||Number(official.entry.nivel)!==8)issues.push('Não foi possível validar o código NCM na tabela oficial.');
  }catch(e){issues.push('A conferência da tabela oficial NCM não respondeu.')}
  try{const c=await jsonFetch(NCM+'/cest-by-ncm?ncm='+encodeURIComponent(code),{},9000);cests=Array.isArray(c.items)?c.items:[]}
  catch(e){issues.push('A pesquisa de correspondências CEST não respondeu.')}
 }else{
  const norm=label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]+/g,' ').trim();
  const term=norm.split(/\s+/).find(w=>w.length>=4)||norm.slice(0,35);
  if(term.length>=3){
   try{const v=await jsonFetch(NCM+'/search?q='+encodeURIComponent(term),{},9500);
    results=(v.items||[]).filter(i=>i&&Number(i.nivel)===8).slice(0,8);
   }catch(e){issues.push('A busca por descrição na NCM oficial ficou indisponível.')}
  }
 }
 return {label,suggest,code,official,cests,issues,results};
}
function formatCompany(c){
 const uf=c.uf||'UF não confirmada';
 const city=c.city?', '+c.city:'';
 let ie=c.registrations.length?'IE(s) retornada(s): '+c.registrations.map(r=>r.ie+' ('+r.uf+')'+(r.active===true?' ativa':r.active===false?' inativa':' status desconhecido')).join('; '):'Inscrição estadual não confirmada';
 return '<strong>'+safe(c.name||c.cnpj)+'</strong><p>'+safe(c.cnpj)+' · '+safe(uf+city)+'</p><p>Situação cadastral: '+safe(c.situation||'Não confirmada')+'</p><p>'+safe(c.simple)+'</p><p>'+safe(ie)+'</p><small>Fonte: '+safe(c.source)+'</small>';
}
function fiscalStatus(nature,from,to,info){
 const key=nature;
 const route=from.uf&&to.uf?from.uf+' → '+to.uf:'UF de origem e/ou destino não confirmada';
 const pending=[];
 if(!from.uf||!to.uf)pending.push('A localização de um dos estabelecimentos não foi retornada pela consulta cadastral.');
 if(!info.code)pending.push('O produto precisa de NCM definido pela composição, marca/modelo, ficha técnica ou XML de origem.');
 if(info.code&&!info.official?.entry)pending.push('É necessário confirmar a vigência do NCM na tabela oficial.');
 if(key==='venda'||key==='compra')pending.push('A classificação da operação depende da finalidade do destinatário, origem da mercadoria, condição de contribuinte e eventual ST; esses dados não são dedutíveis apenas pelo CNPJ.');
 if(['devolucao','remessa','transferencia','retorno','consignacao','bonificacao','comodato','conserto','industrializacao','outro'].includes(key))pending.push('A natureza especial exige identificar o motivo e/ou o documento fiscal vinculado antes de definir o CFOP.');
 pending.push('As regras tributárias estaduais ainda não estão homologadas neste motor para atribuir com segurança ICMS, ST, DIFAL, FCP, PIS, COFINS, IPI e IBS/CBS.');
 return {route,pending,cfop:'Aguardando regra fiscal verificada',tax:'Ainda não calculado',date:new Date().toLocaleDateString('pt-BR')};
}
function resultHTML(input,from,to,info,fiscal){
 const s=info.suggest||{};
 const code=info.code?'<strong>'+safe(ncmFmt(info.code))+'</strong>':'<strong>Não identificado com segurança</strong>';
 const valid=info.official?.entry?'<span class="good">Código encontrado na tabela NCM</span>':'<span class="warn">Classificação não homologada para o produto</span>';
 let cest='<strong>Não identificado</strong>';
 if(s.cest && info.code) {
  const matching=info.cests.find(c=>digits(c.cest)===digits(s.cest));
  cest='<strong>'+safe(cestFmt(s.cest))+'</strong> <span class="warn">'+(matching?'Referência compatível com a compilação CEST':'Sugestão do catálogo, sem confirmação independente')+'</span>';
 }else if(info.cests.length){
  cest='<span class="warn">'+info.cests.length+' CEST(s) possíveis; necessário confrontar descrição e vigência</span>';
 }
 let classification='<p>Produto: <strong>'+safe(input.product)+'</strong></p><p>NCM: '+code+' '+valid+'</p><p>CEST: '+cest+'</p>';
 if(s.detail)classification+='<p class="muted">'+safe(s.detail)+'</p>';
 if(info.official?.entry?.descricao)classification+='<p class="muted">Descrição oficial do código: '+safe(info.official.entry.descricao)+'</p>';
 if(info.results.length)classification+='<p class="muted">Códigos encontrados na pesquisa por descrição (não representam enquadramento automático): '+info.results.map(x=>safe(ncmFmt(x.codigo))).join(' · ')+'</p>';
 if(info.issues.length)classification+='<p class="muted">'+info.issues.map(safe).join(' ')+'</p>';
 return '<div class="result-top"><h2>Consulta automática — ficha informativa</h2><span class="warn">Tributação ainda não homologada</span></div>'+
 '<p>Operação: <strong>'+safe(input.natureText)+'</strong> · '+safe(fiscal.route)+' · '+safe(fiscal.date)+'</p>'+
 '<div class="result-grid"><article><h3>CNPJ de origem</h3>'+formatCompany(from)+'</article><article><h3>CNPJ de destino</h3>'+formatCompany(to)+'</article></div>'+
 '<article><h3>Classificação do produto</h3>'+classification+'</article>'+
 '<article><h3>CFOP e impostos</h3><p>CFOP: <strong>'+safe(fiscal.cfop)+'</strong></p>'+
 '<p>ICMS / ICMS-ST / DIFAL / FCP / PIS / COFINS / IPI / IBS / CBS: <strong>'+safe(fiscal.tax)+'</strong></p>'+
 '<p class="muted">O cadastro das empresas e o nome do produto, isoladamente, não autorizam afirmar o CFOP nem calcular tributos.</p></article>'+
 '<details><summary>O que falta para concluir a classificação fiscal?</summary><ul>'+
 fiscal.pending.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ul>'+
 '<p>Se a documentação do produto ou da operação trouxer os dados pendentes, utilize a <a href="/consulta-nfe.html">consulta detalhada da pré-nota</a>.</p></details>'+
 '<p class="muted">Fontes: consulta cadastral pública de CNPJ; <a href="https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif" target="_blank" rel="noopener">Classif/RFB</a>; <a href="https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18" target="_blank" rel="noopener">Convênio ICMS 142/18/CONFAZ</a>. Códigos identificados não equivalem a enquadramento legal homologado.</p>';
}
function loadSaved(){
 try{const s=JSON.parse(localStorage.getItem(COMPANY_KEY)||'null');if(!s||!validCnpj(s.cnpj))return;
  $('registerCompany').checked=true;$('registerBox').hidden=false;
  $('registerRole').value=s.role==='destino'?'destino':'origem';
  $('registerName').value=short(s.name,120);
  $(s.role==='destino'?'toCnpj':'fromCnpj').value=s.cnpj;
  $('registerState').textContent='Empresa salva neste aparelho para facilitar as próximas consultas (cadastro autodeclarado).';
 }catch(e){}
}
function showError(message){$('message').textContent=message;$('message').hidden=false}
function clearError(){$('message').hidden=true;$('message').textContent=''}
async function maybeRegister(input){
 if(!$('registerCompany').checked)return;
 const cnpj=input[$('registerRole').value==='destino'?'to':'from'];
 if(!$('registerAccept').checked){$('registerState').textContent='Cadastro não realizado: aceite os termos para registrar sua empresa.';return}
 const name=$('registerName').value.trim();
 if(name&&name.length<2){$('registerState').textContent='Informe um nome com pelo menos 2 caracteres ou deixe vazio.';return}
 $('registerState').textContent='Registrando cadastro opcional...';
 try{
  const result=await jsonFetch(REGISTER,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cnpj,name:name||null,acceptTerms:true,analytics:false,version:TERMS})},9000);
  if(result.ok){
   try{localStorage.setItem(COMPANY_KEY,JSON.stringify({cnpj,role:$('registerRole').value,name}))}catch(e){}
   $('registerState').textContent='Cadastro opcional registrado. Isso não verifica a titularidade da empresa nem cria login ou senha.';
  }else throw Error('Sem confirmação');
 }catch(e){$('registerState').textContent='Não foi possível concluir o cadastro opcional. A consulta pública continua disponível sem cadastro.'}
}
async function onSubmit(event){
 event.preventDefault();clearError();
 const from=normCnpj($('fromCnpj').value),to=normCnpj($('toCnpj').value);
 const product=$('product').value.trim(),nature=$('nature').value;
 if(!nature){showError('Selecione a natureza da operação.');return}
 if(!validCnpj(from)){showError('Informe um CNPJ de origem válido.');return}
 if(!validCnpj(to)){showError('Informe um CNPJ de destino válido.');return}
 if(product.length<3){showError('Informe um produto com ao menos três caracteres.');return}
 const id=++runId,btn=$('submit');
 btn.disabled=true;btn.textContent='Pesquisando bases fiscais...';
 $('results').hidden=false;$('results').innerHTML='<div role="status">Consultando CNPJs, NCM e CEST... O resultado separa dados encontrados de informações pendentes.</div>';
 const input={from,to,product:short(product,90),nature,natureText:$('nature').selectedOptions[0].textContent};
 try{
  const parts=await Promise.allSettled([company(from),from===to?company(from):company(to),productInfo(product)]);
  if(id!==runId)return;
  const unavailable=doc=>({cnpj:doc,name:'Cadastro indisponível',uf:'',city:'',situation:'',simple:'Não confirmado',registrations:[],source:'Sem resposta',kind:'unavailable'});
  const a=parts[0].status==='fulfilled'?parts[0].value:unavailable(from);
  const b=parts[1].status==='fulfilled'?parts[1].value:unavailable(to);
  const info=parts[2].status==='fulfilled'?parts[2].value:{label:product,suggest:productHint(product),code:'',official:null,cests:[],issues:['Falha na pesquisa NCM.'],results:[]};
  const fiscal=fiscalStatus(nature,a,b,info);
  lastInput=input;
  $('results').innerHTML=resultHTML(input,a,b,info,fiscal);
  $('afterActions').hidden=false;
  maybeRegister(input);
 }catch(e){showError('A consulta não pôde ser concluída. Verifique a conexão e tente novamente.');$('results').hidden=true}
 finally{if(id===runId){btn.disabled=false;btn.textContent='Consultar automaticamente'}}
}
$('registerCompany').addEventListener('change',()=>{$('registerBox').hidden=!$('registerCompany').checked;clearError()});
$('consultation').addEventListener('submit',onSubmit);
$('clear').addEventListener('click',()=>{
 ++runId;$('consultation').reset();$('registerBox').hidden=true;$('results').hidden=true;$('afterActions').hidden=true;clearError();$('registerState').textContent='';
});
$('print').addEventListener('click',()=>window.print());
$('removeSaved').addEventListener('click',()=>{try{localStorage.removeItem(COMPANY_KEY)}catch(e){}$('registerState').textContent='Preferência local excluída; o registro já enviado ao servidor não é apagado por este botão.'});
loadSaved();
})();