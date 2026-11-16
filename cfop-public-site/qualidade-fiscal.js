/* FORTECOMPANNY+ IA
 * Auditoria independente da apresentação da ficha.
 * Uma referência de NCM/CEST ou uma hipótese de CFOP NUNCA é uma homologação de NF-e.
 * Não enviar dados fiscais para outro serviço; apenas dados já usados localmente.
 */
(function(root){
 "use strict";
 const s=v=>String(v??"");
 const has8=v=>/^\d{8}$/.test(s(v).replace(/\D/g,""));
 const validUf=v=>/^(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/.test(s(v));
 const verifiedIE=party=>Array.isArray(party?.registrations)&&party.registrations.some(x=>x?.active===true&&x.ie&&x.uf===party.uf);
 function assess({from={},to={},product={},fiscal={},stateData=null,input={}}={}){
  const issues=[];
  const add=(code,text)=>{if(!issues.some(x=>x.code===code))issues.push({code,text})};
  const route=validUf(from.uf)&&validUf(to.uf);
  const officialNCM=has8(product.code)&&Number(product.official?.entry?.nivel)===8;
  const cest=s(product.suggest?.cest).replace(/\D/g,"");
  const cestFound=Boolean(cest)&&Array.isArray(product.cests)&&product.cests.some(x=>s(x?.cest).replace(/\D/g,"")===cest);
  const scenario=input.triage||{};
  const scenarioReview=input.triageAssessment||{needsReview:true,issues:['Cenário tributário não analisado']};
  const scenarioIsGeneral=scenario.specialRegime==='nao'&&scenario.unusual==='nao'&&scenario.taxRegime&&scenario.taxRegime!=='nao_sei';
  const nature=s(input.nature);
  const purpose=/revenda/.test(nature)?'revenda':/consumo/.test(nature)?'uso_consumo':/ativo/.test(nature)?'ativo_imobilizado':/industrializacao/.test(nature)?'industrializacao':'';
  const now=new Date();
  const localDate=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const legal=root.FORTE_FUNDAMENTO_LEGAL?.assess(stateData||{},{
   fromUF:from.uf,toUF:to.uf,natureza:nature,finalidade:purpose,
   ncm:product.code,cest:product.suggest?.cest,date:scenario.operationDate||localDate,
   specialRegime:scenario.specialRegime
  })||{hasApplicableReviewedRule:false,legalReviewedCount:0,
   problems:['Módulo de revisão legal não carregado; não é possível homologar regras.'],xmlRequired:false};
  const completeFiscalRules=Boolean(scenarioIsGeneral)&&legal.hasApplicableReviewedRule===true;
  const cfop=s(fiscal.cfop).trim();
  const cfopSingle=/^[1256]\.\d{3}$/.test(cfop);
  const buyerTaxProof=verifiedIE(to);
  const choiceBuyer=s(input.buyerTaxStatus);
  const status={
   "Cadastro/UF":route?(input.simulation===true?'UF informada pelo usuário; identidade não verificada':'UF identificada; inscrição estadual a conferir'):'Não confirmado',
   "NCM do produto":officialNCM?'Código existente; enquadramento pendente':'Pendente',
   "CEST do produto":cestFound?'Correspondência indicativa':'Não identificado — pode não ser aplicável',
   "CFOP de saída/entrada":cfopSingle?'Hipótese única; revisar':'Condicional',
   "Regra estadual da operação":completeFiscalRules?'Regra com revisão legal registrada; conferir demais condições':'Fundamento legal ainda não homologado',
   "Base da homologação":'Legislação oficial, vigência, exceções e revisão — XML não exigido',
   "Regime da empresa consultante":scenario.taxRegime&&scenario.taxRegime!=='nao_sei'?'Informado pelo usuário':'Não confirmado',
   "Regime especial/benefício":scenario.specialRegime==='sim'?'Declarado — depende de ato e vigência':scenario.specialRegime==='nao'?'Não declarado':'Não confirmado',
   "Condições especiais da operação":scenario.unusual==='sim'?'Declaradas — rever norma':scenario.unusual==='nao'?'Não declaradas':'Não confirmadas',
   "Valores da nota":'Não informados'
  };
  if(!route)add("UF","Confirmar a UF efetiva do estabelecimento e o local da operação.");
  if(input.goodsOrigin==='desconhecida'||!input.goodsOrigin)add("ORIGEM","Confirmar aquisição de terceiros ou produção própria do remetente.");
  if(!officialNCM)add("NCM_CODIGO","Confirmar NCM vigente na base oficial.");
  add("NCM_PRODUTO","Determinar NCM pelas características do produto, regras gerais, notas legais, NESH e soluções oficiais da Receita no Classif. NCM em XML é apenas informação auxiliar.");
  if(!cestFound&&cest)add("CEST","Conferir CEST candidato contra a descrição legal, NCM e segmento; CEST não é obrigatório para todas as mercadorias.");
  if(!cest&&Array.isArray(product.cests)&&product.cests.length)add("CEST_CANDIDATO","Há CESTs possíveis relacionados ao NCM, mas nenhum foi confirmado pela descrição do produto. Isso não prova que exista ICMS-ST devido.");
  if(!buyerTaxProof){
   add("IE","Inscrição estadual do destinatário não foi comprovada por consulta estadual: verificar IE ativa ou condição de não contribuinte.");
   if(choiceBuyer==="sim"||choiceBuyer==="nao")add("IE_DECLARADA","A condição de contribuinte foi informada pelo usuário, não verificada pelo órgão estadual.");
  }
  if(!cfopSingle)add("CFOP","Confirmar CFOP final: a classificação exibida ainda é uma hipótese ou contém alternativas.");
  const journey=input.journey||{};
  const purchase=String(input.nature||'').startsWith('compra');
  if(purchase){
   if(input.simulation===true)add('DOCUMENTOS','Simulação por UF, sem CNPJ/CPF de uma ou ambas as partes. Identidade, inscrição e localização real não confirmadas.');
   if(!journey.sellerType||journey.sellerType==='nao_sei')add('TIPO_FORNECEDOR','Confirmar se o vendedor é empresa, pessoa física ou produtor rural.');
   if(['pessoa_fisica','produtor_rural'].includes(journey.sellerType))add('NOTA_ENTRADA','Confirmar documento exigível e quem deve emiti-lo. Não presumir NF-e de saída de pessoa física/produtor rural.');
   if(journey.invoiceStatus==='xml'||journey.invoiceStatus==='danfe')
    add('DOCUMENTO_AUXILIAR','Documento informado como referência facultativa. A homologação depende da legislação, e não dos códigos/valores usados na nota anterior.');
   if(input.nature==='compra_ativo'&&journey.assetUse!=='sim')add('ATIVO','Confirmar se a máquina/bem será mesmo imobilizado; finalidade influencia CFOP e eventual DIFAL.');
   if(input.nature==='compra_ativo'&&['simples','mei','excesso'].includes(scenario.taxRegime))
    add('CIAP_REGIME','Simples/MEI declarado: não atribuir automaticamente créditos de ICMS via CIAP; verificar regime e exceções.');
  }
  if(!completeFiscalRules)add("UF_REGRA","Ainda não há norma específica com vigência, escopo e revisão jurídica documentados para este cenário. Não usar XML de terceiros como prova de enquadramento.");
  for(const problem of (legal.problems||[]).slice(0,5))add("FUNDAMENTO_LEGAL_"+issues.length,problem);
  if(!scenario.taxRegime||!scenario.specialRegime||!scenario.unusual)add("TRIAGEM_PENDENTE","Preencher a triagem inicial: regime da empresa, regime especial e particularidades da operação.");
  if(scenario.specialRegime==='sim')add("REGIME_ESPECIAL","Regime especial declarado pelo usuário: não aplicar benefício, CFOP, CST ou cálculo até conferir ato, vigência e alcance na operação.");
  if(scenario.specialRegime==='nao_sei')add("REGIME_DESCONHECIDO","Verificar se o emitente possui regime especial ou benefício fiscal aplicável.");
  if(scenario.unusual==='sim')add("OPERACAO_ATIPICA","Tratamento tributário específico declarado; conferir a legislação e os reflexos nesta operação.");
  if(scenario.unusual==='nao_sei')add("CONDICAO_DESCONHECIDA","Verificar se existe tributação especial, antecipação ou regime monofásico.");
  if(scenario.taxRegime==='nao_sei')add("CRT_DESCONHECIDO","Confirmar o regime tributário e o CRT do emitente.");
  for(const issue of (Array.isArray(scenarioReview.issues)?scenarioReview.issues:[]))add("CENARIO_"+issues.length,issue);
  if(!input.invoiceTotal)add("VALORES","Informar valores de mercadoria, frete, despesas, descontos e benefícios para calcular bases e tributos.");
  add("TRIBUTOS","Conferir CST/CSOSN, ICMS, ST/DIFAL/FCP, PIS, COFINS e IBS/CBS exigíveis com regras vigentes antes da emissão.");
  return Object.freeze({
   stage:"nao_homologado",
   canIssue:false,
   title:"Ficha orientativa — não homologada para emissão",
   reason:completeFiscalRules?"Há elementos de regra verificada, mas a operação ainda exige conferências documentais e cálculos.":"Nenhuma regra tributária estadual aplicável foi homologada para esta consulta.",
   referenceOnly:true,
   status,
   issues,
   stateRuleCount:completeFiscalRules?stateData.verifiedRules.length:0
  });
 }
 root.FORTE_QUALIDADE_FISCAL=Object.freeze({assess});
})(window);
