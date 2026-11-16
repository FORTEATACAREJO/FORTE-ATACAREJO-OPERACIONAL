/* FORTECOMPANNY+ IA — triagem contextual do cenário fiscal (consulta orientativa).
 * Seleções são declarações do visitante, nunca comprovação de regime especial,
 * benefício, imunidade, ICMS-ST ou qualquer obrigação tributária.
 */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 const labels={
  simples:'Simples Nacional',mei:'MEI',normal:'Regime normal (lucro real/presumido)',
  excesso:'Simples Nacional — excesso de sublimite',rural:'Produtor rural / pessoa física',
  outro:'Outro enquadramento',nao_sei:'Não sei / confirmar com a contabilidade',
  icms:'ICMS / crédito, diferimento ou redução',
  st:'ICMS-ST / responsabilidade especial',
  pis_cofins:'PIS/COFINS',ipi:'IPI',ibs_cbs:'IBS/CBS',multiplos:'Vários tributos',
  outra:'Outro regime / benefício',zfm:'Zona Franca / área incentivada',
  importacao:'Importação',exportacao:'Exportação',
  monofasico:'Tributação monofásica / concentração em uma etapa',
  retencao:'ICMS-ST retido em operação anterior',
  antecipacao:'Antecipação tributária',isencao:'Isenção, imunidade ou redução',
  devolucao:'Devolução / retorno com tratamento específico',
  triangulacao:'Operação triangular ou entrega a terceiro',outras:'Outra condição'
 };
 const status=()=>({
  taxRegime:$('taxRegime').value,
  specialRegime:$('specialRegime').value,
  specialKind:$('specialRegime').value==='sim'?$('specialKind').value:'',
  specialScope:$('specialRegime').value==='sim'?$('specialScope').value:'',
  specialAct:$('specialRegime').value==='sim'?$('specialAct').value.trim().slice(0,90):'',
  specialValidity:$('specialRegime').value==='sim'?$('specialValidity').value:'',
  unusual:$('unusualOperation').value,
  unusualKind:$('unusualOperation').value==='sim'?$('unusualKind').value:'',
  operationDate:$('operationDate').value||''
 });
 const shape=()=>({
  ...status(),
  conditional:status().specialRegime==='sim'||status().unusual==='sim'
 });
 function validate(v){
  if(!v.taxRegime)return {ok:false,message:'Informe o regime tributário da sua empresa (ou selecione “Não sei”).'};
  if(!v.specialRegime)return {ok:false,message:'Informe se existe regime especial ou benefício fiscal (ou selecione “Não sei”).'};
  if(v.specialRegime==='sim'&&!v.specialKind)return {ok:false,message:'Selecione a área do regime especial, mesmo que seja “Não sei”.'};
  if(v.specialRegime==='sim'&&!v.specialScope)return {ok:false,message:'Confirme se o regime especial se aplica à mercadoria e operação, ou marque “Não sei”.'};
  if(v.specialRegime==='sim'&&!v.specialValidity)return {ok:false,message:'Informe se o regime especial está vigente, ou marque “Não sei”.'};
  if(!v.unusual)return {ok:false,message:'Informe se existe alguma condição tributária diferente nesta operação (ou “Não sei”).'};
  if(v.unusual==='sim'&&!v.unusualKind)return {ok:false,message:'Informe a condição especial da operação, mesmo que ainda não saiba a classificação.'};
  if(v.operationDate&&!/^\d{4}-\d{2}-\d{2}$/.test(v.operationDate))return {ok:false,message:'Confirme a data informada da operação.'};
  return {ok:true,message:''};
 }
 function assess(v){
  const pending=[];
  const add=x=>{if(!pending.includes(x))pending.push(x)};
  const needsSpecial=v.specialRegime==='sim';
  const needsUnusual=v.unusual==='sim';
  if(v.taxRegime==='nao_sei')add('Confirmar regime tributário da empresa consultante e CRT aplicável à operação.');
  if(v.taxRegime==='outro'||v.taxRegime==='rural')
   add('Confirmar enquadramento fiscal da empresa consultante, inscrição e documento adequado à operação.');
  if(v.taxRegime==='mei')add('Confirmar enquadramento MEI e regras aplicáveis ao produto/atividade e ao documento fiscal.');
  if(v.taxRegime==='excesso')add('Confirmar tratamento do excesso do sublimite para o ICMS e parametrização tributária vigente.');
  if(v.specialRegime==='nao_sei')add('Verificar se existe regime especial, incentivo ou benefício fiscal para o estabelecimento e operação.');
  if(needsSpecial){
   if(v.specialKind==='nao_sei')add('Identificar os tributos e obrigações alterados pelo regime especial.');
   if(v.specialScope!=='sim')add('Comprovar que o regime especial alcança esta mercadoria, estabelecimento e operação.');
   if(v.specialValidity!=='sim')add('Confirmar vigência e validade do ato concessivo na data da operação.');
   if(!v.specialAct)add('Obter referência do ato concessivo do regime especial para conferência documental.');
   add('Conferir exigências, limites e condições do ato concessivo antes de usar a parametrização comum.');
  }
  if(v.unusual==='nao_sei')add('Confirmar se a operação possui condição tributária específica (ST, antecipação, regime monofásico, benefício etc.).');
  if(needsUnusual){
   if(v.unusualKind==='nao_sei')add('Identificar o tratamento especial da operação e sua base legal.');
   else add('Verificar o tratamento de '+(labels[v.unusualKind]||'operação especial')+' na origem, no destino e na data da operação.');
  }
  if(v.operationDate&&!Number.isNaN(Date.parse(v.operationDate))&&v.operationDate>new Date().toISOString().slice(0,10))
   add('A data futura exige conferência da norma vigente na data prevista, pois a legislação poderá mudar.');
  return {
   needsReview:pending.length>0,
   specialDeclared:needsSpecial,
   specialUnverified:needsSpecial&&(v.specialScope!=='sim'||v.specialValidity!=='sim'||!v.specialAct),
   taxRegimeLabel:labels[v.taxRegime]||'Não informado',
   issues:pending,
   label:needsSpecial?'Há regime especial declarado':needsUnusual?'Operação com particularidade tributária declarada':
    v.specialRegime==='nao'&&v.unusual==='nao'?'Cenário comum declarado (a confirmar)':'Cenário pendente de confirmação',
   noAutomaticSpecialBenefits:true
  };
 }
 function render(){
  $('specialFields').hidden=$('specialRegime').value!=='sim';
  $('unusualFields').hidden=$('unusualOperation').value!=='sim';
  const v=status(),a=assess(v);
  $('triageStatus').textContent=v.specialRegime==='sim'?
    'Regime especial declarado: a aplicação à operação deverá ser comprovada pelo ato e vigência.':
    v.specialRegime==='nao_sei'?'Regime especial não confirmado: o resultado indicará essa pendência.':
    v.unusual==='sim'?'Operação com particularidade: a regra específica precisa ser conferida.':
    'Informe as respostas da triagem para orientar a consulta sem presumir benefícios fiscais.';
 }
 for(const id of ['taxRegime','specialRegime','specialKind','specialScope','specialValidity','specialAct','unusualOperation','unusualKind','operationDate']){
  $(id).addEventListener('change',render);
  if(id==='specialAct')$(id).addEventListener('input',render);
 }
 render();
 root.FORTE_TRIAGEM_FISCAL=Object.freeze({read:status,validate,assess,refresh:render});
})(window);