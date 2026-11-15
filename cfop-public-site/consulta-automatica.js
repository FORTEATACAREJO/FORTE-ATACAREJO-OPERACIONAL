(function(){
'use strict';
const $=id=>document.getElementById(id);
const CAD='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-cadastros';
const NCM='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-ncm';
const REGISTER='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/consulta-cfop/api/access';
const COMPANY_KEY='fortecompanny-optional-company-v1';
const PERSONAL_KEY='fortecompanny-my-document-v1';
const NAME_SEARCH='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-busca-empresas';

const TERMS='cfop-privacy-2026-11-12-v1';
const ufList=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
let providerReady=null,runId=0,lastInput=null;
// A natureza descreve tanto o sentido documental quanto a finalidade declarada
// do destinatário. Inverter CNPJs NÃO presume mudança de finalidade.
const natureMetadata=Object.freeze({
 compra_revenda:{kind:'compra',purpose:'Revenda pelo destinatário',known:true},
 compra_consumo:{kind:'compra',purpose:'Uso ou consumo do destinatário',known:true},
 compra_ativo:{kind:'compra',purpose:'Ativo imobilizado do destinatário',known:true},
 compra_industrializacao:{kind:'compra',purpose:'Industrialização pelo destinatário',known:true},
 compra:{kind:'compra',purpose:'Ainda não identificada',known:false},
 venda_revenda:{kind:'venda',purpose:'Revenda pelo destinatário',known:true},
 venda_consumo:{kind:'venda',purpose:'Uso ou consumo do destinatário',known:true},
 venda:{kind:'venda',purpose:'Ainda não identificada',known:false}
});
function natureInfo(value){
 return natureMetadata[value]||{kind:'especial',purpose:'Conforme natureza especial e documentos vinculados',known:false};
}

function normCnpj(value){return String(value||'').toUpperCase().replace(/[^0-9A-Z]/g,'')}
function validCnpj(v){
 const c=normCnpj(v);
 if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(c)||c.slice(0,12)===c[0].repeat(12))return false;
 const weights1=[5,4,3,2,9,8,7,6,5,4,3,2],weights2=[6,5,4,3,2,9,8,7,6,5,4,3,2];
 function digit(str,weights){let sum=0;for(let i=0;i<weights.length;i++)sum+=(str.charCodeAt(i)-48)*weights[i];const rem=sum%11;return rem<2?0:11-rem}
 const a=digit(c.slice(0,12),weights1);return c.slice(12)===String(a)+String(digit(c.slice(0,12)+a,weights2));
}

function normDoc(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function validCpf(v){
 const c=String(v||'').replace(/\D/g,'');
 if(!/^\d{11}$/.test(c)||c.split('').every(x=>x===c[0]))return false;
 for(let n=9;n<=10;n++){
  let sum=0;for(let i=0;i<n;i++)sum+=Number(c[i])*(n+1-i);
  let digit=sum*10%11;if(digit===10)digit=0;
  if(digit!==Number(c[n]))return false;
 }
 return true;
}
function validPartyDoc(doc){return validCnpj(doc)||validCpf(doc)}
function party(doc){
 if(validCpf(doc)){
  return Promise.resolve({cnpj:doc,name:'Pessoa física informada pelo usuário',uf:'',city:'',situation:'Não consultado',
   simple:'CPF não comprova condição de contribuinte',registrations:[],source:'Declaração local — não verificada em base pública',kind:'person',verified:false});
 }
 return company(doc);
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
 const metadata=natureInfo(key);
 if((metadata.kind==='venda'||metadata.kind==='compra')&&!metadata.known){
  pending.push('A finalidade da compra/venda ainda não foi definida na natureza da operação. Escolha revenda, uso/consumo ou outra finalidade para completar essa informação.');
 }
 if(metadata.kind==='venda'||metadata.kind==='compra'){
  pending.push('Conferir origem da mercadoria, condição de contribuinte do ICMS e responsabilidade por eventual ICMS-ST: o CNPJ e a finalidade declarada não comprovam esses enquadramentos.');
 }
 if(['devolucao','remessa','transferencia','retorno','consignacao','bonificacao','comodato','conserto','industrializacao','outro'].includes(key))pending.push('A natureza especial exige identificar o motivo e/ou o documento fiscal vinculado antes de definir o CFOP.');
 pending.push('As regras tributárias estaduais ainda não estão homologadas neste motor para atribuir com segurança ICMS, ST, DIFAL, FCP, PIS, COFINS, IPI e IBS/CBS.');
 return {route,pending,purpose:natureInfo(key).purpose,cfop:'Aguardando regra fiscal verificada',tax:'Ainda não calculado',date:new Date().toLocaleDateString('pt-BR')};
}
function resultHTML(input,from,to,info,fiscal){
 const s=info.suggest||{};
 const ncm=info.code?ncmFmt(info.code):'Não identificado';
 const cest=s.cest&&info.code?cestFmt(s.cest):info.cests.length?info.cests.length+' possibilidades':'Não identificado';
 const partyLine=(p)=>'<strong>'+safe(short(p.name||'Não identificado',65))+'</strong> · '+safe(p.cnpj)+' · '+safe(p.uf||'UF não confirmada');
 const details=[];
 if(s.detail)details.push('<p>'+safe(s.detail)+'</p>');
 if(info.official?.entry?.descricao)details.push('<p>Descrição NCM: '+safe(info.official.entry.descricao)+'</p>');
 if(info.results.length)details.push('<p>Códigos encontrados (não classificados): '+info.results.map(x=>safe(ncmFmt(x.codigo))).join(', ')+'</p>');
 for(const issue of info.issues)details.push('<p>'+safe(issue)+'</p>');
 return '<h2>Resultado</h2>'+
  '<p class="muted">'+safe(input.natureText)+' · '+safe(fiscal.route)+'</p>'+
  '<div class="result-main"><small>CFOP</small><div class="result-value">Pendente</div><p class="muted">Tributos não calculados: regras fiscais ainda não homologadas para esta operação.</p></div>'+
  '<div class="result-compact">'+
   '<div><small>Produto</small><strong>'+safe(short(input.product,55))+'</strong></div>'+
   '<div><small>NCM sugerido</small><strong>'+safe(ncm)+'</strong></div>'+
   '<div><small>CEST sugerido</small><strong>'+safe(cest)+'</strong></div>'+
  '</div>'+
  '<div class="participants"><p><b>Origem:</b> '+partyLine(from)+'</p><p><b>Destino:</b> '+partyLine(to)+'</p></div>'+
  '<details><summary>O que falta validar?</summary><ul>'+fiscal.pending.map(p=>'<li>'+safe(p)+'</li>').join('')+'</ul></details>'+
  '<details><summary>Dados das empresas</summary><div class="result-grid"><article><h3>Origem</h3>'+formatCompany(from)+'</article><article><h3>Destino</h3>'+formatCompany(to)+'</article></div></details>'+
  '<details><summary>Classificação e fontes</summary>'+
   '<p>NCM: '+(info.official?.entry?'código encontrado na tabela oficial':'não verificado')+'. CEST: referência indicativa, não comprova ICMS-ST.</p>'+
   details.join('')+
   '<p><a target="_blank" rel="noopener" href="https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif">Receita — Classif</a> · <a target="_blank" rel="noopener" href="https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18">CONFAZ — CEST/ST</a></p>'+
  '</details>';
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

let ownPlacement=null;
function clearSearchList(){
 $('companySearchResults').replaceChildren();
}
function populateOwnDocument(){
 const value=normDoc($('myDoc').value);
 if(!value){$('myDocStatus').textContent='Informe seu CPF/CNPJ se desejar o preenchimento automático. O cadastro é opcional.';return}
 if(!validPartyDoc(value)){$('myDocStatus').textContent='Confira o CPF/CNPJ: dígitos verificadores inválidos ou documento incompleto.';return}
 const where=$('myRole').value==='destino'?'toCnpj':'fromCnpj';
 const other=where==='toCnpj'?'fromCnpj':'toCnpj';
 if($(other).value && normDoc($(other).value)===value){
  const temp=$(where).value;
  $(where).value=value;
  $(other).value=normDoc(temp)===value?'':temp;
 }else{
  const displaced=$(where).value;
  $(where).value=value;
  if(displaced&&displaced!==value&&!$(other).value)$(other).value=displaced;
 }
 ownPlacement=where;
 $('companyTarget').value=where==='fromCnpj'?'destino':'origem';
 $('myDocStatus').textContent='Preenchido em '+(where==='fromCnpj'?'origem':'destino')+'.';
 clearPreviousAnalysis();
}
function persistOwnIdentity(){
 const val=normDoc($('myDoc').value);
 if(!$('rememberMe').checked){try{localStorage.removeItem(PERSONAL_KEY)}catch(_){ }return}
 if(!validPartyDoc(val)){
  $('rememberMe').checked=false;
  $('myDocStatus').textContent='Documento inválido: não foi guardado neste aparelho.';
  return;
 }
 try{localStorage.setItem(PERSONAL_KEY,JSON.stringify({document:val,role:$('myRole').value}))}
 catch(_){$('myDocStatus').textContent='O navegador não permitiu guardar o documento neste aparelho.'}
}
function recoverOwnIdentity(){
 let data=null;
 try{data=JSON.parse(localStorage.getItem(PERSONAL_KEY)||'null')}catch(_){}
 if(data&&validPartyDoc(data.document)&&['origem','destino'].includes(data.role)){
  $('myDoc').value=data.document;$('myRole').value=data.role;$('rememberMe').checked=true;
  populateOwnDocument();
 }else{
  // Compatibilidade com cadastro anterior; não marca a nova opção de memória sem autorização.
  try{
   const previous=JSON.parse(localStorage.getItem(COMPANY_KEY)||'null');
   if(previous&&validCnpj(previous.cnpj)){
    $('myDoc').value=previous.cnpj;$('myRole').value=previous.role==='destino'?'destino':'origem';
    populateOwnDocument();
   }
  }catch(_){}
 }
}
async function searchCompanyByName(){
 const q=$('companyNameSearch').value.trim(),uf=$('companyUfSearch').value;
 clearSearchList();
 if(q.length<3){$('companySearchStatus').textContent='Informe pelo menos 3 caracteres da razão social ou nome fantasia.';return}
 const btn=$('searchCompanies');btn.disabled=true;
 $('companySearchStatus').textContent='Procurando empresas na base pública de pesquisa por nome...';
 try{
  const url=NAME_SEARCH+'/search?q='+encodeURIComponent(q)+(uf?'&uf='+encodeURIComponent(uf):'');
  const response=await jsonFetch(url,{},9500);
  const items=Array.isArray(response.items)?response.items.filter(x=>x&&validCnpj(x.cnpj)).slice(0,15):[];
  if(!items.length){
   $('companySearchStatus').textContent='Nenhuma empresa encontrada nessa busca. Tente outro nome ou informe o CNPJ diretamente. Não será escolhido nenhum CNPJ sem confirmação.';
   return;
  }
  $('companySearchStatus').textContent=items.length+' resultado(s) — '+(response.source||'Dados públicos em intermediário')+'. Escolha o estabelecimento correto. A validação cadastral será feita após a escolha.';
  for(const candidate of items){
   const btnSelect=document.createElement('button');
   btnSelect.type='button';
   const label=document.createElement('span');
   label.textContent=String(candidate.name||candidate.tradeName||'Empresa')+' — '+candidate.cnpj;
   const detail=document.createElement('small');
   detail.textContent=[candidate.tradeName,candidate.city,candidate.uf].filter(Boolean).join(' · ');
   btnSelect.append(label,detail);
   btnSelect.addEventListener('click',async()=>{
    const chosen=$('companyTarget').value==='origem'?'fromCnpj':'toCnpj';
    $(chosen).value=candidate.cnpj;
    clearPreviousAnalysis();
    $('companySearchStatus').textContent='CNPJ escolhido e preenchido: '+candidate.cnpj+'. Conferindo os dados cadastrais...';
    try{
     const found=await company(candidate.cnpj);
     $('companySearchStatus').textContent='CNPJ selecionado: '+candidate.cnpj+' — '+(found.name||candidate.name)+' / '+(found.uf||candidate.uf||'UF não confirmada')+'. Fonte cadastral: '+found.source+'. Clique em Pesquisar e montar ficha fiscal para análise da operação.';
    }catch(_){
     $('companySearchStatus').textContent='CNPJ selecionado: '+candidate.cnpj+'. A confirmação cadastral está indisponível; a ficha fiscal indicará as pendências.';
    }
   });
   $('companySearchResults').appendChild(btnSelect);
  }
 }catch(e){
  $('companySearchStatus').textContent='A fonte pública de pesquisa por nome está indisponível ou atingiu seu limite gratuito. Informe o CNPJ diretamente; nenhuma empresa foi selecionada automaticamente.';
 }finally{btn.disabled=false}
}

function showError(message){$('message').textContent=message;$('message').hidden=false}
function clearError(){$('message').hidden=true;$('message').textContent=''}
async function maybeRegister(input){
 if(!$('registerCompany').checked)return;
 const cnpj=input[$('registerRole').value==='destino'?'to':'from'];
 if(!validCnpj(cnpj)){$('registerState').textContent='O cadastro empresarial exige CNPJ. Um CPF pode ser lembrado apenas no próprio aparelho.';return}
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
async function onSubmit(event,registerIfAsked=true){
 event.preventDefault();clearError();
 const from=normDoc($('fromCnpj').value),to=normDoc($('toCnpj').value);
 const product=$('product').value.trim(),nature=$('nature').value;
 if(!nature){showError('Selecione a natureza da operação.');return}
 if(!validPartyDoc(from)){showError('Informe um CNPJ ou CPF de origem válido.');return}
 if(!validPartyDoc(to)){showError('Informe um CNPJ ou CPF de destino válido.');return}
 if(product.length<3){showError('Informe um produto com ao menos três caracteres.');return}
 const id=++runId,btn=$('submit');
 btn.disabled=true;btn.textContent='Pesquisando bases fiscais...';
 $('results').hidden=false;$('results').innerHTML='<div role="status">Consultando CNPJs, NCM e CEST... O resultado separa dados encontrados de informações pendentes.</div>';
 const input={from,to,product:short(product,90),nature,natureText:$('nature').selectedOptions[0].textContent};
 try{
  const parts=await Promise.allSettled([party(from),party(to),productInfo(product)]);
  if(id!==runId)return;
  const unavailable=doc=>({cnpj:doc,name:'Cadastro indisponível',uf:'',city:'',situation:'',simple:'Não confirmado',registrations:[],source:'Sem resposta',kind:'unavailable'});
  const a=parts[0].status==='fulfilled'?parts[0].value:unavailable(from);
  const b=parts[1].status==='fulfilled'?parts[1].value:unavailable(to);
  const info=parts[2].status==='fulfilled'?parts[2].value:{label:product,suggest:productHint(product),code:'',official:null,cests:[],issues:['Falha na pesquisa NCM.'],results:[]};
  const fiscal=fiscalStatus(nature,a,b,info);
  lastInput=input;
  $('results').innerHTML=resultHTML(input,a,b,info,fiscal);
  $('afterActions').hidden=false;
  if(registerIfAsked)maybeRegister(input);
 }catch(e){showError('A consulta não pôde ser concluída. Verifique a conexão e tente novamente.');$('results').hidden=true}
 finally{if(id===runId){btn.disabled=false;btn.textContent='Consultar'}}
}

function clearPreviousAnalysis(){
 ++runId;lastInput=null;
 $('results').hidden=true;$('results').innerHTML='';$('afterActions').hidden=true;
 $('submit').disabled=false;$('submit').textContent='Consultar';
 clearError();
}
['nature','fromCnpj','toCnpj','product'].forEach(id=>{
 $(id).addEventListener('input',clearPreviousAnalysis);
});
$('nature').addEventListener('change',clearPreviousAnalysis);
$('swapCnpj').addEventListener('click',()=>{
 const from=$('fromCnpj').value,to=$('toCnpj').value;
 $('fromCnpj').value=to;$('toCnpj').value=from;
 if($('registerCompany').checked){
  $('registerRole').value=$('registerRole').value==='origem'?'destino':'origem';
 }
 if(validPartyDoc($('myDoc').value)){
  $('myRole').value=$('myRole').value==='origem'?'destino':'origem';
  persistOwnIdentity();
 }
 clearPreviousAnalysis();
 $('swapStatus').textContent='Origem/destino invertidos. Confira a natureza.';
 if(validPartyDoc($('fromCnpj').value)&&validPartyDoc($('toCnpj').value)&&$('nature').value&&$('product').value.trim().length>=3){
  $('swapStatus').textContent+=' Atualizando...';
  onSubmit({preventDefault(){}},false);
 }
});
$('myDoc').addEventListener('change',()=>{populateOwnDocument();persistOwnIdentity()});
$('myRole').addEventListener('change',()=>{populateOwnDocument();persistOwnIdentity()});
$('rememberMe').addEventListener('change',persistOwnIdentity);
$('searchCompanies').addEventListener('click',searchCompanyByName);
$('registerCompany').addEventListener('change',()=>{$('registerBox').hidden=!$('registerCompany').checked;clearError()});
$('consultation').addEventListener('submit',onSubmit);
$('clear').addEventListener('click',()=>{
 ++runId;$('consultation').reset();$('registerBox').hidden=true;$('results').hidden=true;$('afterActions').hidden=true;clearError();$('registerState').textContent='';
 $('companySearchResults').replaceChildren();recoverOwnIdentity();
});
$('print').addEventListener('click',()=>window.print());
$('removeSaved').addEventListener('click',()=>{try{localStorage.removeItem(COMPANY_KEY)}catch(e){}$('registerState').textContent='Preferência local excluída; o registro já enviado ao servidor não é apagado por este botão.'});
loadSaved();
recoverOwnIdentity();
})();