/* FORTECOMPANNY — núcleo de pré-nota para CONSULTA FISCAL, não emissor NF-e.
 * Sem impostos calculados sem base legal vigente. Não usa API paga.
 * Reaproveita o catálogo curado e as hipóteses condicionadas de CFOP.
 */
(function(root){
"use strict";
const DESTINATIONS={
 revenda:"Revenda / comercialização",ativo:"Ativo imobilizado",consumo:"Uso e consumo",
 obra:"Aplicação em obra",industrializacao:"Industrialização",particular:"Consumidor final",
 rural:"Produção rural",prestacao:"Aplicação na prestação de serviço",outro:"Outra finalidade"
};
const NATURES={
 venda:"Venda de mercadoria",compra:"Compra de mercadoria",devolucao:"Devolução",
 transferencia:"Transferência",remessa:"Remessa",bonificacao:"Bonificação",
 consignacao:"Consignação",conserto:"Remessa para conserto",comodato:"Comodato",
 industrializacao:"Remessa para industrialização",retorno:"Retorno de mercadoria",outro:"Outra operação"
};
function docRaw(value){return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function num(value){const v=Number(String(value||"").replace(",", "."));return Number.isFinite(v)?v:0}
function validateParty(p){
 let errors=[];
 if(!p)return ["Participante não informado."];
 if(!["company","rural","person"].includes(p.kind))errors.push("Tipo do participante não definido.");
 const document=docRaw(p.document);
 if(p.kind==="company" && document && !/^[A-Z0-9]{12}[0-9]{2}$/.test(document))errors.push("CNPJ em formato inválido.");
 if(p.kind!=="company" && document && !/^\d{11}$/.test(document))errors.push("CPF deve ter 11 dígitos.");
 if(p.kind==="rural" && !String(p.ie||"").trim())errors.push("Produtor rural sem IE informada.");
 if(p.kind==="person"&&String(p.ie||"").trim())errors.push("CPF sem IE foi escolhido, mas existe IE preenchida.");
 if(!/^[A-Z]{2}$/.test(String(p.uf||"")))errors.push("UF inválida.");
 return errors;
}
function field(value,status,reason,source){
 return {value:value==null||value===""?"Não determinado":String(value),status:status||"pendente",reason:reason||"",source:source||""}
}
function fiscalItem(params,item,api){
 const sender=params.sender||{},recipient=params.recipient||{},mode=params.mode||"saida",nature=params.nature||"venda";
 const purpose=String(item.purpose||"outro"),product=String(item.description||"").trim();
 const ncm=String(item.ncm||"").replace(/\D/g,""),cest=String(item.cest||"").replace(/\D/g,"");
 const curated=api&&product?api.suggest(product,ncm):null;
 const errors=[];
 if(!product)errors.push("Descrição do produto ausente");
 if(ncm&&ncm.length!==8)errors.push("NCM deve ter 8 dígitos");
 if(cest&&cest.length!==7)errors.push("CEST deve ter 7 dígitos");
 if(num(item.quantity)<=0)errors.push("Quantidade precisa ser positiva");
 if(num(item.unitPrice)<0)errors.push("Valor unitário negativo");
 const origin=String(sender.uf||""),destination=String(recipient.uf||"");
 const sellerKind=sender.kind||"unknown",buyerKind=recipient.kind||"unknown";
 let buyerContributor=params.buyerContributor||"unknown";
 if(buyerKind==="person" && !recipient.ie)buyerContributor="no";
 const normal=(mode==="saida"&&nature==="venda")||(mode==="entrada"&&nature==="compra");
 const sellerSource=params.sellerSource||"unknown",stEvidence=params.stEvidence||"unknown";
 let candidate={code:"",status:"pendente",explanation:"A natureza da operação selecionada exige CFOP específico e regras próprias.",assumptions:[]};
 if(!errors.length && normal && api?.cfop){
   candidate=api.cfop({operation:mode,originUf:origin,destUf:destination,
    purpose,sellerSource,stEvidence,buyerIsContributor:buyerContributor,
    consultantKind:mode==="entrada"?buyerKind:sellerKind,
    otherKind:mode==="entrada"?sellerKind:buyerKind});
 }
 if(!["MG","GO"].includes(origin)||!["MG","GO"].includes(destination)){
   candidate={code:"",status:"pendente",explanation:"Regras estaduais ainda não homologadas para operações fora de MG e GO.",assumptions:[]};
 }
 if(sender.kind==="person"&&!sender.ie && mode==="saida")candidate={code:"",status:"pendente",explanation:"Remetente pessoa física sem IE: verificar obrigação de emissão e documento fiscal aplicável.",assumptions:[]};
 if(purpose==="rural"||purpose==="prestacao"||purpose==="outro")candidate={code:"",status:"pendente",explanation:"Finalidade especial requer CFOP e tratamento fiscal específicos.",assumptions:[]};
 const ncmOrigin=item.source==="xml"?"Declarado no XML selecionado (assinatura e autorização não verificadas)":item.source==="curated"?"Catálogo ilustrativo FORTECOMPANNY":"Informado pelo usuário";
 const ncmExplanation=ncm?"Existência e descrição do código devem ser verificadas na tabela oficial da Receita; classificação depende da composição/uso real.":"Confira a composição, XML ou ficha técnica e identifique NCM de 8 dígitos.";
 const cestExplanation=cest?"CEST informado não comprova retenção de ICMS-ST. Conferir descrição do Convênio 142/18, vigência, MG/GO e protocolo.":"NCM/SH pode ter vários CEST; confira descrição e incidência por UF.";
 const entries={
   ncm:field(ncm?api?.ncmFmt?.(ncm)||ncm:null,ncm?"declarado":"pendente",ncmExplanation,ncmOrigin),
   cest:field(cest?api?.cestFmt?.(cest)||cest:null,cest?"declarado":"pendente",cestExplanation,item.source==="xml"?"XML original":"Informado pelo usuário"),
   cfop:field(candidate.code||null,candidate.code?"hipotese":"pendente",candidate.explanation,"Tabela CFOP — hipótese condicionada"),
   icmsst:field(stEvidence==="unknown"?null:stEvidence,stEvidence==="unknown"?"pendente":"declarado","A marcação de ST é declaração do visitante, não verificação da legislação estadual.","Entrada do usuário"),
   cst:field(null,"pendente","CST ICMS exige regime, origem da mercadoria e modalidade de tributação."),
   csosn:field(null,"pendente","CSOSN somente se emissor for optante do Simples e exigências aplicáveis."),
   icms:field(null,"pendente","Apuração de alíquota, base, crédito, redução e benefícios requer legislação e valores verificados."),
   stCalc:field(null,"pendente","MVA, PMPF, pauta, convênios/protocolos e responsável pela retenção ainda não parametrizados."),
   difal:field(null,"pendente","Depende do contribuinte, consumidor final e operação interestadual."),
   ipi:field(null,"pendente","Depende da TIPI, estabelecimento e fato gerador."),
   pisCofins:field(null,"pendente","Depende do regime, CST e incidência do produto."),
   ibsCbs:field(null,"pendente","CST, cClassTrib e regras da reforma tributária conforme vigência e operação."),
   cbenef:field(null,"pendente","Exige benefício legal vigente, quando houver.")
 };
 const qty=num(item.quantity),unitPrice=num(item.unitPrice);
 return {
   product,sku:String(item.sku||""),purpose,quantity:qty,unit:String(item.unit||"UN"),
   unitPrice,total:Math.round(qty*unitPrice*100)/100,curatedSuggestion:curated?.ncm?{
     ncm:curated.ncm,cest:curated.cest||"",name:curated.name,warning:"Sugestão; confronte ficha técnica e XML."
   }:null,
   cfopCandidate:candidate,fields:entries,errors,
   pending:["ICMS/CST/CSOSN","ICMS-ST/MVA/PMPF","PIS/COFINS","IPI","IBS/CBS/cClassTrib"]
 };
}
function analyze(params,api){
 const sender=params.sender||{},recipient=params.recipient||{};
 const items=(Array.isArray(params.items)?params.items:[]).slice(0,30);
 const errors=[];
 const partyA=validateParty(sender),partyB=validateParty(recipient);
 errors.push(...partyA.map(e=>"Remetente: "+e),...partyB.map(e=>"Destinatário: "+e));
 if(!["saida","entrada"].includes(params.mode))errors.push("Selecione consulta de entrada ou saída.");
 if(!NATURES[params.nature])errors.push("Natureza da operação inválida.");
 if(!items.length)errors.push("Inclua pelo menos um produto.");
 if(!params.date||! /^\d{4}-\d{2}-\d{2}$/.test(params.date))errors.push("Informe a data da operação.");
 if(params.sender?.uf && params.recipient?.uf && params.sender.uf===params.recipient.uf &&
 params.mode==="saida"&&params.nature==="transferencia")errors.push("Transferência exige verificar estabelecimentos e natureza da operação; sem CFOP automático.");
 const resultItems=items.map((x)=>fiscalItem(params,x,api));
 const amount=Math.round(resultItems.reduce((sum,x)=>sum+x.total,0)*100)/100;
 return {version:"consulta-pre-nfe-v1",createdAt:new Date().toISOString(),date:params.date,
  mode:params.mode,nature:params.nature,description:NATURES[params.nature],
  sender:{...sender},recipient:{...recipient},
  items:resultItems,amount,errors,
  classification:"CONSULTA SIMULADA NÃO HOMOLOGADA — NÃO É NF-e, DANFE OU XML DE AUTORIZAÇÃO",
  note:"Os campos de tributos não preenchidos dependem da legislação específica, documentos e homologação. Não transmitir ao Fisco.",
  sources:{
   ncm:"https://portalunico.siscomex.gov.br/classif/",
   cest:"https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18",
   nfe:"https://www.nfe.fazenda.gov.br/portal/"
  }
 };
}
root.FORTE_PRE_NOTA={analyze,DESTINATIONS,NATURES,validateParty};
})(typeof window!=="undefined"?window:globalThis);
