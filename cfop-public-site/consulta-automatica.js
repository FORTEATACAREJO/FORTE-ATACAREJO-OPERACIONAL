(function(){
'use strict';
const $=id=>document.getElementById(id);
const CAD='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-cadastros';
const NCM='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-ncm';
const REGISTER='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/consulta-cfop/api/access';
const COMPANY_KEY='fortecompanny-optional-company-v1';
const PERSONAL_KEY='fortecompanny-my-document-v1';
const NAME_SEARCH='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-busca-empresas';

const STATE_RULES='https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-regras-nacionais';
async function stateRules(from,to,info,nature){
 const finalidade=/revenda/.test(nature)?'revenda':/consumo/.test(nature)?'uso_consumo':/ativo/.test(nature)?'ativo_imobilizado':/industrializacao/.test(nature)?'industrializacao':'';
 if(!ufList.has(from.uf)||!ufList.has(to.uf))return null;
 const url=STATE_RULES+'/route?from='+encodeURIComponent(from.uf)+'&to='+encodeURIComponent(to.uf)+
  (info.code?'&ncm='+encodeURIComponent(info.code):'')+
  (info.suggest?.cest?'&cest='+encodeURIComponent(info.suggest.cest):'')+
  '&natureza='+encodeURIComponent(nature||'')+
  (finalidade?'&finalidade='+encodeURIComponent(finalidade):'');
 try{return await jsonFetch(url,{},9000)}catch(_){return null}
}
function taxpayerStatus(company,declared){
 if(declared==='sim')return 'sim';
 if(declared==='nao')return 'nao';
 if(Array.isArray(company.registrations)&&company.registrations.some(i=>i.active===true))return 'sim';
 return 'unknown';
}


const TERMS='cfop-privacy-2026-11-12-v1';
const ufList=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
let providerReady=null,runId=0,lastInput=null,confirmedNcm='';
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

const profiles={
 revenda:{label:'Revenda',origin:'terceiros',help:'Revenda normalmente vende mercadoria adquirida de fornecedores. Confirme o XML e se houve ST na entrada.'},
 industria:{label:'Indústria',origin:'propria',help:'Se você fabricou a mercadoria, marque fabricação própria. A indústria também pode vender itens comprados de terceiros: altere a origem quando for o caso.'},
 consumidor:{label:'Consumidor final',origin:'desconhecida',help:'Consumidor final informa o uso da mercadoria. A fabricação própria ou aquisição de terceiros se refere ao REMETENTE, não ao comprador.'}
};
function selectedProfile(){
 if($('profileRevenda').checked)return 'revenda';
 if($('profileIndustria').checked)return 'industria';
 if($('profileConsumidor').checked)return 'consumidor';
 return '';
}
function refreshProfileDetails(role,applyDefault){
 const data=profiles[role];
 if(!data){$('priorStContainer').hidden=true;return}
 $('profileHelp').textContent=data.help;
 if(applyDefault){
  $('goodsOrigin').value=data.origin;
  // Consumidor final normalmente recebe NF-e de saída emitida pelo fornecedor.
  // Não altera a natureza já escolhida manualmente.
  if(role==='consumidor'&&!$('nature').value)$('nature').value='venda_consumo';
  if(role==='consumidor'&&validPartyDoc($('myDoc').value)){
   $('myRole').value='destino';
   populateOwnDocument();
   persistOwnIdentity();
  }
 }
 const thirdParty=$('goodsOrigin').value==='terceiros';
 const canAskRetention=role==='revenda'&&thirdParty;
 $('priorStContainer').hidden=!canAskRetention;
 if(!canAskRetention)$('priorSt').value='unknown';
 $('goodsOriginHelp').textContent=thirdParty?
  'O fornecedor pode ser indústria, importador ou distribuidor; confirme origem fiscal e ICMS-ST no XML.':
  $('goodsOrigin').value==='propria'?
   'Fabricação própria se refere ao estabelecimento remetente da NF-e.':
   'Se você é o destinatário, confirme se o remetente fabricou ou adquiriu a mercadoria.';
}

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
function productHint(label,selectedNcm){
 const api=window.FORTE_CLASSIFICACAO;
 return api&&api.suggest?api.suggest(label,selectedNcm):null;
}
async function productInfo(label,selectedNcm){
 const suggest=productHint(label,selectedNcm);
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
function fiscalStatus(nature,from,to,info,ownership,buyerDeclaration,stateData,profile,priorSt){
 const route=from.uf&&to.uf?from.uf+' → '+to.uf:'UF ainda não confirmada';
 const meta=natureInfo(nature),different=!!from.uf&&!!to.uf&&from.uf!==to.uf;
 const isSale=meta.kind==='venda',isPurchase=meta.kind==='compra';
 const buyer=taxpayerStatus(to,buyerDeclaration);
 const today=new Date().toLocaleDateString('pt-BR');
 const sources=[
  {label:'Tabela CFOP (Fazenda MG)',url:'https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/decretos/d42145_2001.html'},
  {label:'Lei Kandir / LC 190/2022 (DIFAL)',url:'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp87.htm'},
  {label:'CONFAZ — Convênio ICMS 142/2018 (ST)',url:'https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18'}
 ];
 const states=Array.isArray(stateData?.ufs)?stateData.ufs:[];
 for(const item of states){
  const url=String(item.portal_tributario||'');
  if(/^https:\/\/[A-Za-z0-9.-]+(?:\/|$)/.test(url))sources.push({label:'Legislação estadual — '+item.uf,url});
 }
 const r={
  route,cfop:'Não determinado',confidence:'Não definido',note:'',st:'Exige verificação por NCM/CEST, UF e responsabilidade tributária',
  difal:'Não definido',costWarning:'',tax:'Sem cálculo de valores',sources,pending:[],
  buyerStatus:buyer,purpose:meta.purpose,production:ownership,date:today,
  stateStatus:stateData?.sourceStatus||'fonte estadual não consultada',
  certified:Number(stateData?.verifiedRuleCount||0)
 };
 if(!from.uf||!to.uf)r.pending.push('Confirmar UF de origem/destino e local de entrega.');
 if(ownership==='desconhecida')r.pending.push('Confirmar se a mercadoria foi adquirida de terceiros ou fabricada pelo remetente.');
 if(profile==='revenda'&&ownership==='terceiros'&&priorSt==='sim'){
  r.pending.push('Conferir XML anterior: retenção de ST na aquisição foi declarada, mas pode não dispensar ST/DIFAL na operação atual ou no destino.');
 }
 if(profile==='revenda'&&ownership==='terceiros'&&priorSt==='nao'){
  r.pending.push('Sem retenção de ST informada na compra anterior; verificar se havia obrigação de recolhimento antes da saída atual.');
 }
 if(profile==='consumidor'&&meta.kind==='venda'){
  r.pending.push('Você indicou perfil consumidor final e operação de venda. Confirme quem é o emitente e a finalidade.');
 }
 if(!info.code||!info.official?.entry)r.pending.push('Confirmar NCM do produto conforme XML/ficha técnica; pesquisar código não certifica classificação.');
 if(info.code&&info.suggest?.cest)r.pending.push('Confirmar CEST aplicável à descrição legal e vigência do produto.');
 if(isSale&&ownership!=='desconhecida'&&from.uf&&to.uf){
  const root=ownership==='propria'?'101':'102';
  if(!different){
   r.cfop='5.'+root;
   r.confidence='Hipótese de venda comum';
  }else if(buyer==='unknown'){
   r.cfop=ownership==='propria'?'6.101 ou 6.107':'6.102 ou 6.108';
   r.confidence='Alternativas — confirmar contribuinte';
   r.pending.push('Confirme se o destinatário é contribuinte do ICMS: sem IE ativa verificada não se pode decidir entre venda interestadual comum e venda a não contribuinte.');
  }else if(buyer==='nao'){
   r.cfop=ownership==='propria'?'6.107':'6.108';
   r.confidence='Hipótese para não contribuinte';
  }else{
   r.cfop='6.'+root;
   r.confidence='Hipótese para contribuinte';
  }
  r.note='CFOP sugerido para venda normal conforme origem da mercadoria. Se houver ICMS-ST com remetente substituto/substituído, remessa especial ou regime diferenciado, o CFOP pode ser outro.';
  r.pending.push('Confirmar se vendedor é substituto/substituído de ICMS-ST ou possui regime especial.');
 }else if(isPurchase&&profile==='consumidor'){
  r.cfop='Não se aplica à compra comum';
  r.confidence='Nota emitida pelo fornecedor';
  r.note='Como consumidor final, na compra comum você recebe a NF-e emitida pelo vendedor. Para orientar essa nota, escolha “Venda destinada a uso ou consumo”, com o vendedor como origem.';
  r.pending.push('Confirme a natureza: se é nota de compra emitida pelo fornecedor, consulte a saída/venda dele.');
 }else if(isPurchase&&from.uf&&to.uf){
  const head=different?'2.':'1.';
  const kind=nature.replace(/^compra_?/,'');
  if(kind==='revenda')r.cfop=head+'102 ou '+head+'403';
  else if(kind==='consumo')r.cfop=head+'556 ou '+head+'407';
  else if(kind==='ativo')r.cfop=head+'551 ou '+head+'406';
  else if(kind==='industrializacao')r.cfop=head+'101 ou '+head+'401';
  else r.cfop='Conferir finalidade';
  r.confidence='Alternativas conforme ST';
  r.note='CFOP de entrada no destinatário: confirmar XML recebido e se há substituição tributária. A origem própria/de terceiros do fornecedor não define sozinha o CFOP da entrada.';
  r.pending.push('Conferir XML e existência de ST na entrada para selecionar entre as alternativas de CFOP.');
 }else{
  r.note='Operação especial ou finalidade desconhecida: documento original e natureza específica podem mudar o CFOP.';
  r.pending.push('Informar motivo/documento fiscal vinculado para determinar CFOP desta operação.');
 }
 const finalConsumer=/consumo|ativo/.test(nature)||nature==='venda_consumo';
 if(different&&finalConsumer&&(isSale||isPurchase)){
  const liable=buyer==='sim'?'destinatário contribuinte':buyer==='nao'?'remetente na venda para não contribuinte':'a confirmar conforme o enquadramento do destinatário';
  r.difal='Possível DIFAL devido à UF '+to.uf+'; responsável: '+liable+'. Verificar alíquotas, benefícios, regime e eventual tratamento por ST.';
  r.costWarning='ATENÇÃO: o DIFAL pode gerar imposto adicional a recolher ao estado de destino ('+to.uf+'). Quem paga: '+liable+'. Valor ainda não calculado.';
  r.pending.push('Para confirmar DIFAL, validar uso como consumidor final, condição de contribuinte e alíquotas efetivas de origem/destino.');
 }else if(different&&isSale){
  r.difal=nature==='venda_revenda'?'Não é operação declarada de consumidor final; verificar ICMS-ST e finalidade real.':'DIFAL somente se operação for destinada a consumidor final, conforme condições legais.';
 }
  const mgEvidence=window.FORTE_ST_MG_EVIDENCIAS?.evaluate({
  from:from.uf,to:to.uf,ncm:info.code,cest:info.suggest?.cest
 })||null;
 const mgAgreement=mgEvidence?.status==='st_ambito_interestadual_por_acordo';
 const mgInternal=mgEvidence?.status==='st_ambito_interno'&&['0500100','1000200','1000300'].includes(mgEvidence?.base?.cest);
 if(mgInternal&&(isSale||isPurchase)){
  r.mgLegalEvidence=mgEvidence;
  r.st='MG: a mercadoria está relacionada na ST interna (Anexo VII). Confirmar o regime e a responsabilidade no caso específico.';
  for(const src of mgEvidence.sources)sources.push({label:src.title,url:src.url});
  r.pending.push('Conferir a NF-e de aquisição: retenção de ST para MG, condição de substituído ou substituto e eventuais exceções.');
  if(isSale){
   r.cfop=ownership==='terceiros'&&profile==='revenda'&&priorSt==='sim'?
    '5.405 (hipótese, ST anterior em MG a comprovar)':'CFOP de ST interna a confirmar';
   r.confidence='Orientação condicional à ST interna de MG';
   r.note='Cimento/argamassa com ST interna pode exigir CFOP diferente de 5.102. O código depende de retenção anterior para MG e de quem é o responsável.';
  }
 }
 const mgCimento=different&&mgEvidence?.base?.cest==='0500100';
 const mgArgamassa=different&&['1000200','1000300'].includes(mgEvidence?.base?.cest);
 if(mgCimento||mgArgamassa){
  r.mgLegalEvidence=mgEvidence;
  r.st=mgAgreement?
   'MG: produto relacionado no Anexo VII, com UF de origem listada no âmbito interestadual deste grupo. Verificar a responsabilidade do remetente conforme arts. 13/14, regime e exceções.':
   'MG: produto relacionado na ST interna, mas UF de origem não listada no âmbito interestadual do grupo. O destinatário mineiro contribuinte poderá recolher ST na entrada, conforme art. 15, se o remetente não for responsável.';
  for(const src of mgEvidence.sources)sources.push({label:src.title,url:src.url});
  r.pending.push('Confirmar o NCM/CEST pelo produto real, IE do destinatário, regimes especiais e exceções legais de ST.');
  r.pending.push('Verificar se o comprovante de ST anterior se refere à UF de destino; recolhimento na origem não prova quitação em MG.');
  if(buyer==='sim'){
   r.costWarning=mgAgreement?
    'MG: há previsão de ST interestadual para esse grupo; o remetente pode ter ICMS-ST adicional a recolher para MG. Conferir responsável, base, guia e prazo.':
    'MG: pode haver ICMS-ST adicional no momento da entrada, a cargo do destinatário contribuinte, quando a responsabilidade não couber ao remetente. Conferir guia e base.';
   if(mgArgamassa&&mgAgreement&&isSale){
    r.cfop=ownership==='propria'?'6.401 ou 6.101 (conforme ST)':'6.403 ou 6.102 (conforme ST)';
    r.confidence='Alternativas — conferir responsabilidade do remetente pela ST';
    r.note='Para argamassa com UF de origem incluída no acordo, confirmar se o remetente atua como substituto. O CFOP muda conforme a responsabilidade por ST.';
   }
   if(mgCimento&&isSale){
    if(mgAgreement){
     r.cfop=ownership==='propria'?'6.401 (hipótese ST)':ownership==='terceiros'?'6.403 (hipótese ST)':'CFOP depende da origem/ST';
     r.confidence='CFOP condicionado à responsabilidade por ST';
     r.note='O CFOP 6.401/6.403 pressupõe remetente substituto tributário. Confirme a operação e eventual exceção antes de parametrizar.';
    }else{
     r.cfop='CFOP a confirmar conforme retenção';
     r.confidence='ST na entrada pode ser devida pelo destinatário';
     r.note='Sem acordo interestadual listado para a origem, não presumir CFOP de remetente substituto. Conferir CFOP da saída e ST na entrada.';
    }
   }
  }else if(buyer==='unknown'){
   r.pending.push('Confirmar IE ativa ou não contribuinte do destinatário em MG; isso altera ST/DIFAL e CFOP.');
   r.costWarning='MG: a operação pode gerar ST ou DIFAL a recolher no destino. Confirme a condição de contribuinte antes de atribuir quem paga.';
   if(mgCimento&&isSale){r.cfop='Confirmar IE do destinatário';r.confidence='CFOP indefinido — ST ou DIFAL';}
  }else if(buyer==='nao'&&isSale){
   r.st='Operação destinada a não contribuinte: não presumir ST de operações subsequentes; avaliar DIFAL e condições legais.';
   r.difal='Possível DIFAL ao estado de destino em operação interestadual para consumidor final não contribuinte.';
   r.costWarning='MG: avaliar eventual DIFAL ao destino. Não afirmar ST de operações subsequentes sem confirmar a natureza da operação.';
   if(mgCimento){
    r.cfop=ownership==='propria'?'6.107 (hipótese)':'6.108 (hipótese)';
    r.confidence='Hipótese de venda interestadual a não contribuinte';
   }
  }
 }else if(different&&nature==='venda_revenda'&&!r.costWarning){
  r.pending.push('Verificar eventual ICMS-ST por NCM/CEST e acordos do estado de destino.');
  r.costWarning='Se houver responsabilidade por ST no estado de destino, poderá haver recolhimento adicional. Ainda não verificado nesta consulta.';
 }

 // Para destino sem norma aprovada, não usar CFOP simples como resposta isolada
 // quando o cimento pode ter ST: XMLs autorizados MG→GO exibem tanto NCM/CEST
 // quanto CFOP 6.401 e ST, sem comprovar a regra vigente de todas as rotas.
 const otherDestCement=different&&to.uf!=='MG'&&buyer==='sim'&&isSale&&r.certified===0&&
   /^2523\d{4}$/.test(info.code||'')&&String(info.suggest?.cest||'').replace(/\D/g,'')==='0500100';
 if(otherDestCement){
  r.cfop=ownership==='propria'?'6.101 ou 6.401 (conforme ST do destino)':
    ownership==='terceiros'?'6.102 ou 6.403 (conforme ST do destino)':'CFOP pendente de origem/ST';
  r.confidence='Alternativas — ST do destino não homologada';
  r.note='Acordos, responsabilidade e exceções do estado de destino não estão homologados nesta rota. A orientação exige conferência documental antes de parametrizar.';
  r.pending.push('Conferir o RICMS e os acordos aplicáveis na UF de destino para definir CFOP e responsável pela ST.');
 }
 if(profile==='revenda'&&ownership==='terceiros'&&priorSt==='sim'){
  if(!mgCimento&&!mgArgamassa)r.note=(r.note?r.note+' ':'')+'ST anterior informada pelo usuário; verificar retenção no XML e se produz efeitos nesta operação e no destino.';
 }
 if(!info.code&&Array.isArray(info.suggest?.options)&&info.suggest.options.length){
  r.cfop='Confirmar NCM do XML';
  r.confidence='Produto com múltiplas classificações possíveis';
  r.note='O produto admite mais de um NCM conforme a descrição e composição. Confirme o código na nota do fabricante e a classificação fiscal antes de avaliar ST e CFOP.';
  r.pending.push('Selecionar NCM do XML do fabricante no quadro abaixo e refazer a análise.');
 }
 if(r.certified===0)r.pending.push('Regra estadual específica ainda não homologada nesta consulta. Fontes das UFs estão disponíveis para conferência; não emitir apenas com base na sugestão.');
 r.pending.push('Para quantificar ST/DIFAL são necessários valor da operação, frete, alíquotas e eventuais reduções e regimes especiais.');
 return r;
}
function resultHTML(input,from,to,info,fiscal,audit){
 const s=info.suggest||{};
 const ncm=info.code?ncmFmt(info.code):'Não identificado';
 const cest=s.cest&&info.code?cestFmt(s.cest):info.cests.length?info.cests.length+' possibilidades':'Não identificado';
 const partyLine=p=>'<strong>'+safe(short(p.name||'Não identificado',65))+'</strong> · '+safe(p.cnpj)+' · '+safe(p.uf||'UF não confirmada');
 const details=[];
 if(s.detail)details.push('<p>'+safe(s.detail)+'</p>');
 if(info.official?.entry?.descricao)details.push('<p>Descrição da tabela NCM: '+safe(info.official.entry.descricao)+'</p>');
 if(info.results.length)details.push('<p>Códigos NCM pesquisados, sujeitos à classificação: '+info.results.map(x=>safe(ncmFmt(x.codigo))).join(', ')+'</p>');
 for(const issue of info.issues)details.push('<p>'+safe(issue)+'</p>');
 const cites=fiscal.sources.map(x=>'<a target="_blank" rel="noopener noreferrer" href="'+safe(x.url)+'">'+safe(x.label)+'</a>').join(' · ');
 const originText=input.goodsOrigin==='terceiros'?'Mercadoria de terceiros':input.goodsOrigin==='propria'?'Fabricação própria':'Origem da mercadoria não confirmada';
 const ncmQuestion=!info.code&&Array.isArray(s.options)&&s.options.length?
  '<div class="ncm-choices"><strong>Qual NCM consta no XML do fabricante?</strong><p>O nome do cimento não permite escolher o NCM com segurança. Selecione somente após conferir o documento.</p><div class="ncm-buttons">'+
  s.options.filter(o=>/^\d{8}$/.test(o.ncm)).map(o=>
   '<button type="button" data-confirm-ncm="'+safe(o.ncm)+'">'+safe(o.name)+'</button>').join('')+
  '</div></div>':'';

 const profileText=profiles[input.profile]?.label||'Não informado';
 const review=audit||{title:'Ficha orientativa — não homologada para emissão',reason:'Consulta fiscal ainda não homologada',issues:[]};
 const auditBox='<section class="fiscal-audit" aria-label="Status da parametrização">'+
   '<strong>'+safe(review.title)+'</strong><p>'+safe(review.reason)+'</p>'+
   '<details><summary>Verificar antes de usar na NF-e ('+review.issues.length+')</summary><ul>'+
   review.issues.map(x=>'<li>'+safe(x.text)+'</li>').join('')+
   '</ul></details></section>';
 return '<h2>Resultado da consulta</h2>'+auditBox+
  '<p class="muted">Perfil: '+safe(profileText)+' · '+safe(input.natureText)+' · '+safe(fiscal.route)+' · '+safe(originText)+'</p>'+
  (fiscal.buyerStatus==='unknown'&&/^(venda|compra)/.test(input.nature)?
   '<div class="taxpayer-question" role="group" aria-label="Confirmar condição de contribuinte do destinatário"><strong>O destinatário é contribuinte do ICMS?</strong><p>Confira a IE do destinatário na <a target="_blank" rel="noopener noreferrer" href="'+(to.uf==='MG'?'https://www.mg.gov.br/servico/realizar-consulta-publica-ao-cadastro-de-contribuintes-do-icms-sintegra':'https://www.sintegra.gov.br/links.html')+'">consulta pública do SINTEGRA</a>. CNPJ e Simples não comprovam IE.</p><div class="taxpayer-answers"><button type="button" data-tax-status="sim">Sim, IE ativa conferida</button><button type="button" data-tax-status="nao">Não contribuinte</button></div></div>':'')+
  '<div class="result-main"><small>CFOP — '+safe(fiscal.confidence)+'</small><div class="result-value">'+safe(fiscal.cfop)+'</div>'+
  (fiscal.note?'<p>'+safe(fiscal.note)+'</p>':'')+
  '</div>'+
  ncmQuestion+
  '<div class="result-compact">'+
   '<div><small>Produto</small><strong>'+safe(short(input.product,55))+'</strong></div>'+
   '<div><small>NCM sugerido</small><strong>'+safe(ncm)+'</strong></div>'+
   '<div><small>CEST sugerido</small><strong>'+safe(cest)+'</strong></div>'+
  '</div>'+
  '<div class="participants"><p><b>Origem:</b> '+partyLine(from)+'</p><p><b>Destino:</b> '+partyLine(to)+'</p></div>'+
  (fiscal.costWarning?'<p class="tax-alert"><strong>Custo tributário adicional possível:</strong> '+safe(fiscal.costWarning)+'</p>':'')+
  '<article class="tax-situation"><h3>Tributação</h3><p><b>ICMS-ST:</b> '+safe(fiscal.st)+'</p>'+
  (input.profile==='revenda'&&input.goodsOrigin==='terceiros'?
   '<p><b>ST na compra anterior:</b> '+safe(input.priorSt==='sim'?'Retenção declarada; confirmar no XML':input.priorSt==='nao'?'Sem retenção declarada':'Não informado')+'</p>':'')+
  (fiscal.difal!=='Não definido'?'<p><b>DIFAL:</b> '+safe(fiscal.difal)+'</p>':'')+
  '<p><b>Valores:</b> '+safe(fiscal.tax)+'. Sem valores da operação e regras confirmadas não há valor em R$.</p></article>'+
  '<details><summary>Detalhes técnicos da análise</summary><ul>'+fiscal.pending.map(p=>'<li>'+safe(p)+'</li>').join('')+'</ul></details>'+
  '<details><summary>Dados das empresas</summary><div class="result-grid"><article><h3>Origem</h3>'+formatCompany(from)+'</article><article><h3>Destino</h3>'+formatCompany(to)+'</article></div></details>'+
  '<details><summary>Classificação e legislação</summary><p>Base nacional cobre 27 UFs; fontes estaduais indexadas não equivalem a 27 conjuntos de regras homologadas. Nesta rota: '+safe(fiscal.certified)+' regra(s) estadual(is) homologada(s) identificada(s).</p>'+
  (fiscal.mgLegalEvidence?'<p><b>Âmbito da norma MG (em revisão):</b> '+safe(fiscal.mgLegalEvidence.legalScope)+' — '+safe(fiscal.mgLegalEvidence.product)+'. Não comprova pagamento devido.</p>':'')+
   '<p>NCM: '+(info.official?.entry?'código existente na tabela':'não verificado')+'. CEST sugerido não comprova ICMS-ST.</p>'+
   details.join('')+'<p>'+cites+'</p></details>';
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
 window.FORTE_FICHA_EXPORTACAO?.clearSnapshot();
 const profile=selectedProfile();
 if(!profile){showError('Selecione seu perfil: revenda, indústria ou consumidor final.');return}
 const from=normDoc($('fromCnpj').value),to=normDoc($('toCnpj').value);
 const product=$('product').value.trim(),nature=$('nature').value,goodsOrigin=$('goodsOrigin').value,priorSt=$('priorSt').value;
 if(!goodsOrigin){showError('Selecione se a mercadoria foi adquirida de terceiros ou é de fabricação própria.');return}
 if(!nature){showError('Selecione a natureza da operação.');return}
 if(!validPartyDoc(from)){showError('Informe um CNPJ ou CPF de origem válido.');return}
 if(!validPartyDoc(to)){showError('Informe um CNPJ ou CPF de destino válido.');return}
 if(product.length<3){showError('Informe um produto com ao menos três caracteres.');return}
 const id=++runId,btn=$('submit');
 btn.disabled=true;btn.textContent='Pesquisando bases fiscais...';
 $('results').hidden=false;$('results').innerHTML='<div role="status">Consultando CNPJs, NCM e CEST... O resultado separa dados encontrados de informações pendentes.</div>';
 const input={from,to,product:short(product,90),nature,goodsOrigin,priorSt,profile,buyerTaxStatus:$('buyerTaxStatus').value,natureText:$('nature').selectedOptions[0].textContent};
 try{
  const parts=await Promise.allSettled([party(from),party(to),productInfo(product,confirmedNcm)]);
  if(id!==runId)return;
  const unavailable=doc=>({cnpj:doc,name:'Cadastro indisponível',uf:'',city:'',situation:'',simple:'Não confirmado',registrations:[],source:'Sem resposta',kind:'unavailable'});
  const a=parts[0].status==='fulfilled'?parts[0].value:unavailable(from);
  const b=parts[1].status==='fulfilled'?parts[1].value:unavailable(to);
  const info=parts[2].status==='fulfilled'?parts[2].value:{label:product,suggest:productHint(product),code:'',official:null,cests:[],issues:['Falha na pesquisa NCM.'],results:[]};
  const rules=await stateRules(a,b,info,nature);
  if(id!==runId)return;
  const fiscal=fiscalStatus(nature,a,b,info,goodsOrigin,input.buyerTaxStatus,rules,profile,priorSt);
  const audit=window.FORTE_QUALIDADE_FISCAL?.assess({from:a,to:b,product:info,fiscal,stateData:rules,input})||null;
  lastInput=input;
  $('results').innerHTML=resultHTML(input,a,b,info,fiscal,audit);
  $('afterActions').hidden=false;
  if(audit)window.FORTE_FICHA_EXPORTACAO?.setSnapshot({input,from:a,to:b,info,fiscal,audit,rules});
  if(registerIfAsked)maybeRegister(input);
 }catch(e){showError('A consulta não pôde ser concluída. Verifique a conexão e tente novamente.');$('results').hidden=true}
 finally{if(id===runId){btn.disabled=false;btn.textContent='Consultar'}}
}

function clearPreviousAnalysis(){
 window.FORTE_FICHA_EXPORTACAO?.clearSnapshot();
 ++runId;lastInput=null;
 $('results').hidden=true;$('results').innerHTML='';$('afterActions').hidden=true;
 $('submit').disabled=false;$('submit').textContent='Consultar';
 clearError();
}
['goodsOrigin','priorSt','nature','buyerTaxStatus','fromCnpj','toCnpj','product'].forEach(id=>{
 $(id).addEventListener('input',clearPreviousAnalysis);
});
$('nature').addEventListener('change',clearPreviousAnalysis);
$('product').addEventListener('input',()=>{confirmedNcm='';});
['profileRevenda','profileIndustria','profileConsumidor'].forEach(id=>{
 $(id).addEventListener('change',()=>{
  refreshProfileDetails(selectedProfile(),true);
  clearPreviousAnalysis();
 });
});
$('goodsOrigin').addEventListener('change',()=>refreshProfileDetails(selectedProfile(),false));
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
 if(validPartyDoc($('fromCnpj').value)&&validPartyDoc($('toCnpj').value)&&selectedProfile()&&$('goodsOrigin').value&&$('nature').value&&$('product').value.trim().length>=3){
  $('swapStatus').textContent+=' Atualizando...';
  onSubmit({preventDefault(){}},false);
 }
});
$('myDoc').addEventListener('change',()=>{populateOwnDocument();persistOwnIdentity()});
$('myRole').addEventListener('change',()=>{populateOwnDocument();persistOwnIdentity()});
$('rememberMe').addEventListener('change',persistOwnIdentity);
$('searchCompanies').addEventListener('click',searchCompanyByName);
$('registerCompany').addEventListener('change',()=>{$('registerBox').hidden=!$('registerCompany').checked;clearError()});
$('results').addEventListener('click',event=>{
 const ncmChoice=event.target.closest?.('[data-confirm-ncm]');
 if(ncmChoice&&$('results').contains(ncmChoice)){
  const ncm=ncmChoice.dataset.confirmNcm;
  const options=productHint($('product').value)?.options||[];
  if(!options.some(o=>o.ncm===ncm))return;
  confirmedNcm=ncm;
  clearPreviousAnalysis();
  onSubmit({preventDefault(){}},false);
  return;
 }
 const choice=event.target.closest?.('[data-tax-status]');
 if(!choice||!$('results').contains(choice))return;
 if(choice.dataset.taxStatus!=='sim'&&choice.dataset.taxStatus!=='nao')return;
 $('buyerTaxStatus').value=choice.dataset.taxStatus;
 clearPreviousAnalysis();
 onSubmit({preventDefault(){}},false);
});
$('consultation').addEventListener('submit',onSubmit);
$('clear').addEventListener('click',()=>{
 window.FORTE_FICHA_EXPORTACAO?.clearSnapshot();
 confirmedNcm='';
 ++runId;$('consultation').reset();$('registerBox').hidden=true;$('results').hidden=true;$('afterActions').hidden=true;clearError();$('registerState').textContent='';
 $('companySearchResults').replaceChildren();recoverOwnIdentity();refreshProfileDetails(selectedProfile(),false);
});
$('print').addEventListener('click',()=>window.print());
$('removeSaved').addEventListener('click',()=>{try{localStorage.removeItem(COMPANY_KEY)}catch(e){}$('registerState').textContent='Preferência local excluída; o registro já enviado ao servidor não é apagado por este botão.'});
loadSaved();
recoverOwnIdentity();
})();