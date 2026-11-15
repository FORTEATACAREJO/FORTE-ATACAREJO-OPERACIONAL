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
  const completeFiscalRules=Array.isArray(stateData?.verifiedRules)&&stateData.verifiedRules.length>0&&Number(stateData?.verifiedRuleCount)>0;
  const cfop=s(fiscal.cfop).trim();
  const cfopSingle=/^[1256]\.\d{3}$/.test(cfop);
  const buyerTaxProof=verifiedIE(to);
  const choiceBuyer=s(input.buyerTaxStatus);
  const status={
   "Cadastro/UF":route?'Conferido parcialmente':'Não confirmado',
   "NCM do produto":officialNCM?'Código existente; enquadramento pendente':'Pendente',
   "CEST do produto":cestFound?'Correspondência indicativa':'Não confirmado',
   "CFOP de saída/entrada":cfopSingle?'Hipótese única; revisar':'Condicional',
   "Regra estadual da operação":completeFiscalRules?'Regra registrada; revisar escopo':'Sem regra homologada aplicável',
   "Valores da nota":'Não informados'
  };
  if(!route)add("UF","Confirmar a UF efetiva do estabelecimento e o local da operação.");
  if(input.goodsOrigin==='desconhecida'||!input.goodsOrigin)add("ORIGEM","Confirmar aquisição de terceiros ou produção própria do remetente.");
  if(!officialNCM)add("NCM_CODIGO","Confirmar NCM vigente na base oficial.");
  add("NCM_PRODUTO","Conferir NCM e CEST no XML de compra, rótulo ou ficha técnica do produto da marca.");
  if(!cestFound&&cest)add("CEST","Conferir a correspondência do CEST ao produto e segmento.");
  if(!buyerTaxProof){
   add("IE","Inscrição estadual do destinatário não foi comprovada por consulta estadual: verificar IE ativa ou condição de não contribuinte.");
   if(choiceBuyer==="sim"||choiceBuyer==="nao")add("IE_DECLARADA","A condição de contribuinte foi informada pelo usuário, não verificada pelo órgão estadual.");
  }
  if(!cfopSingle)add("CFOP","Confirmar CFOP final: a classificação exibida ainda é uma hipótese ou contém alternativas.");
  if(!completeFiscalRules)add("UF_REGRA","Regra estadual específica da rota e do produto não homologada neste motor; verificar legislação e responsabilidade de ST/DIFAL.");
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
