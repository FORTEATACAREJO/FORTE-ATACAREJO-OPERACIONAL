/* FORTE TECH — classificação preliminar de produtos e operações.
 * Fontes:
 * https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif
 * https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18
 * https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Tabelas/CFOP.htm
 * Catálogo CURADO, não cobre todos os produtos e não calcula imposto.
 */
(function(root) {
"use strict";
var SOURCES={
 ncm:"https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/classif",
 cest:"https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18",
 cfop:"https://www.sefaz.pe.gov.br/Legislacao/Tributaria/Documents/Legislacao/Tabelas/CFOP.htm"
};
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function ncmFmt(n){return String(n||"").replace(/\D/g,"").replace(/^(\d{4})(\d{2})(\d{2})$/,"$1.$2.$3")}
function cestFmt(c){return String(c||"").replace(/\D/g,"").replace(/^(\d{2})(\d{3})(\d{2})$/,"$1.$2.$3")}
var entries=[
 {id:"cimento-cpii",name:"Cimento Portland CP-II (composto)",keywords:/\b(?:cimento\s+.*cp\s*(?:ii|2)|cp\s*(?:ii|2)\s*(?:e|f|z)?\b)/,ncm:"25232990",cest:"0500100",detail:"CP-II; conferir tipo indicado no saco ou XML do fabricante",precision:"referência específica"},
 {id:"cimento-cpv",name:"Cimento CP-V ARI / outros Portland",keywords:/\b(?:cimento\s+.*(?:cp\s*(?:v|5)|ari)|cp\s*(?:v|5)\s*ari)\b/,ncm:"25232990",cest:"0500100",detail:"Cimento Portland não comum; confirme composição e classificação no XML",precision:"referência específica"},
 {id:"cimento-cpi",name:"Cimento Portland comum CP-I",keywords:/\b(?:cimento\s+.*cp\s*(?:i|1)\b|cp\s*(?:i|1)\s*portland)/,ncm:"25232910",cest:"0500100",detail:"Cimento Portland comum CP-I; diferenciar de CP-II",precision:"referência específica"},
 {id:"cimento-gen",name:"Cimento Portland (tipo não identificado)",keywords:/\bcimento\b/,ncm:"",ncmGroup:"2523",cest:"0500100",detail:"CEST do cimento é conhecido, mas o NCM de 8 dígitos depende do tipo exato",precision:"grupo NCM"},
 {id:"cal-hidratada",name:"Cal hidratada / apagada",keywords:/\bcal\s+(?:hidratada|apagada)\b/,ncm:"25222000",cest:"1000100",detail:"Cal apagada; não extrapolar para cal agrícola ou composto químico puro",precision:"referência específica"},
 {id:"cal-virgem",name:"Cal viva / virgem",keywords:/\bcal\s+(?:viva|virgem)\b/,ncm:"25221000",cest:"1000100",detail:"Cal viva; confirmar especificação na NCM",precision:"referência específica"},
 {id:"cal-gen",name:"Cal (tipo não identificado)",keywords:/\bcal\b/,ncm:"",ncmGroup:"2522",cest:"1000100",detail:"Confirme se é cal viva, apagada, hidráulica ou outro produto",precision:"grupo NCM"},
 {id:"argamassa",name:"Argamassa",keywords:/\bargamassa\b|\b(?:ac1|ac2|ac3)\b/,ncm:"",options:[{ncm:"38245000",cest:"1000200",name:"Argamassa classificada na posição 3824.50.00"},{ncm:"32149000",cest:"1000300",name:"Outras argamassas classificadas em 3214.90.00"}],detail:"Argamassas admitem NCM e CEST distintos conforme a composição e a descrição oficial. Consulte rótulo/XML.",precision:"múltiplas possibilidades"}
];
function classifyProduct(name,providedNcm){
 var s=norm(name);if(s.length<3)return null;
 var match=entries.find(function(x){return x.keywords.test(s)});
 if(!match)return {id:"desconhecido",name:"Produto sem correspondência específica no catálogo",ncm:"",cest:"",ncmGroup:"",precision:"não identificado",detail:"Pesquise a NCM vigente no Classif da Receita Federal e compare a descrição do produto com o Convênio ICMS 142/2018.",options:[]};
 var out={id:match.id,name:match.name,ncm:match.ncm||"",ncmGroup:match.ncmGroup||"",cest:match.cest||"",precision:match.precision,detail:match.detail,options:match.options||[]};
 var ncm=String(providedNcm||"").replace(/\D/g,"");
 if(ncm && out.options.length){
  var selected=out.options.find(function(o){return o.ncm===ncm});
  if(selected){out.ncm=selected.ncm;out.cest=selected.cest;out.precision="NCM declarado compatível com opção do catálogo"}
 }
 if(ncm && out.ncm && out.ncm!==ncm){out.detail+=" • Atenção: o NCM informado difere da sugestão do catálogo; conferir classificação.";out.precision="divergência com NCM informado"}
 return out
}
function cfopSuggest(o){
 var same=o.originUf===o.destUf,op=o.operation,purpose=o.purpose;
 var st=o.stEvidence||"unknown",seller=o.sellerSource||"unknown";
 var unknown={code:"",status:"pendente",explanation:"Dados ainda insuficientes para indicar CFOP.",assumptions:[]};
 if(!o.originUf||!o.destUf)return unknown;
 if(!["entrada","saida"].includes(op))return unknown;
 if(o.consultantKind==="person")
  return {code:"",status:"pendente",explanation:"CPF comum sem IE não representa automaticamente estabelecimento emissor/escriturador de NF-e. É necessário definir o sujeito tributário antes de atribuir CFOP.",assumptions:[]};
 if(op==="saida" && o.otherKind==="person" && o.buyerIsContributor==="yes")
  return {code:"",status:"pendente",explanation:"Destinatário selecionado como pessoa física sem IE, porém marcado como contribuinte do ICMS. Corrija o tipo do comprador ou confirme a situação estadual.",assumptions:[]};
 if(op==="saida" && o.otherKind==="rural" && o.buyerIsContributor==="no")
  return {code:"",status:"pendente",explanation:"Produtor rural com IE foi informado como não contribuinte. Confirme na SEFAZ antes de sugerir CFOP.",assumptions:[]};

 if(op==="entrada" && o.consultantKind==="person")return {code:"",status:"pendente",explanation:"Pessoa física sem inscrição estadual não deve receber CFOP de escrituração de compra como se fosse estabelecimento contribuinte. A operação exige análise específica.",assumptions:[]};
 if(op==="entrada"){
  if(purpose==="revenda"){
   if(st==="no_st")return {code:same?"1.102":"2.102",status:"hipótese",explanation:"Compra para comercialização sem ST, conforme condição declarada.",assumptions:["Revenda de mercadorias","Operação normal sem antecipação ou ST","Conferir a NF-e original e exceções legais"]};
   if(st==="prior_st")return {code:same?"1.403":"2.403",status:"hipótese",explanation:"Compra para comercialização de mercadoria sujeita ao regime de ST, caso efetivamente comprovado.",assumptions:["Mercadoria recebida com enquadramento de ST","Conferir a NF-e, retenção e regra da UF"]};
  }
  if(purpose==="ativo" || purpose==="consumo"){
    const fixed=purpose==="ativo";
    if(st==="no_st")return {
      code:fixed?(same?"1.551":"2.551"):(same?"1.556":"2.556"),
      status:"hipótese",
      explanation:fixed?"Compra de bem destinado ao ativo imobilizado, com hipótese de operação regular sem enquadramento ST.":"Compra de material destinado ao uso ou consumo do estabelecimento, com hipótese de operação regular sem ST.",
      assumptions:["Destinação comprovada ao "+(fixed?"ativo imobilizado":"uso ou consumo"),"Não se trata de transferência, bonificação, devolução ou operação especial","Verificar NCM/CEST, regime fiscal e documentação da operação"]
    };
    if(st==="prior_st")return {
      code:fixed?(same?"1.406":"2.406"):(same?"1.407":"2.407"),
      status:"hipótese",
      explanation:fixed?"Compra de bem para ativo imobilizado cuja mercadoria efetivamente se enquadre em ST, segundo documentação e legislação vigente.":"Compra de material para uso ou consumo cuja mercadoria efetivamente se enquadre em ST, segundo documentação e legislação vigente.",
      assumptions:["Regime de substituição tributária comprovado para produto e UF","Confirmar legislação, retenção, contribuinte e natureza da operação","Não usar sem documento e fundamento estadual"]
    };
  }
  if(purpose==="industrializacao"&&st==="no_st")return {code:same?"1.101":"2.101",status:"hipótese",explanation:"Compra para industrialização ou produção rural quando destinada ao processo produtivo e sem ST, conforme as condições declaradas.",assumptions:["A mercadoria é insumo de produção","Conferir regra de entrada e UF"]};
  return unknown;
 }
 if(op==="saida"){
  if(st!=="no_st")return {code:"",status:"pendente",explanation:"Vendas com ICMS-ST exigem identificar se o vendedor é substituto, substituído, ou se há retenção para o destino.",assumptions:["Não usar 5.102/6.102 sem confirmar a regra ST"]};
  if(seller==="third_party"){
    if(!same && o.buyerIsContributor==="no")return {code:"6.108",status:"hipótese",explanation:"Venda interestadual de mercadoria adquirida de terceiros destinada a não contribuinte, sem ST — situação declarada.",assumptions:["Destinatário não contribuinte confirmado","Venda comum, sem ST, benefícios ou regimes específicos"]};
    if(!same && o.buyerIsContributor!=="yes")return {code:"",status:"pendente",explanation:"Na venda interestadual, confirme se o comprador é contribuinte do ICMS antes de selecionar o CFOP.",assumptions:[]};
    return {code:same?"5.102":"6.102",status:"hipótese",explanation:"Venda de mercadoria adquirida de terceiros, sem industrialização própria e sem ST, sob condições declaradas.",assumptions:["Mercadoria de terceiros","Sem ST e sem outra natureza especial da operação"]};
  }
  if(seller==="own_production"){
    if(!same && o.buyerIsContributor==="no")return {code:"6.107",status:"hipótese",explanation:"Venda interestadual de produção própria para não contribuinte, sob condições declaradas.",assumptions:["Produção própria","Não contribuinte confirmado","Sem ST e regimes específicos"]};
    if(!same&&o.buyerIsContributor!=="yes")return unknown;
    return {code:same?"5.101":"6.101",status:"hipótese",explanation:"Venda de produção do estabelecimento, sem ST e outras especificidades.",assumptions:["Produção própria","Sem ST e sem operação excepcional"]};
  }
  return {code:"",status:"pendente",explanation:"Informe se a mercadoria é produção própria ou comprada para revenda antes de sugerir o CFOP.",assumptions:[]};
 }
 return unknown
}
root.FORTE_CLASSIFICACAO={suggest:classifyProduct,cfop:cfopSuggest,sources:SOURCES,ncmFmt:ncmFmt,cestFmt:cestFmt};
})(typeof window!=="undefined"?window:globalThis);
