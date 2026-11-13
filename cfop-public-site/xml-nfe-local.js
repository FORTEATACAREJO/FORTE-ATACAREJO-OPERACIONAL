/* FORTE TECH — extração de dados de NF-e diretamente no navegador.
 * Arquivo nunca é enviado à rede; nenhuma informação é armazenada no backend.
 * Dados do XML são declaratórios e não têm assinatura/autenticidade verificadas.
 */
(function(root) {
"use strict";
const MAX_BYTES=6*1024*1024;
function direct(node,name){
 if(!node||!node.children)return null;
 for(const el of node.children)if(el.localName===name)return el;
 return null;
}
function text(node,name,max=180){
 const el=direct(node,name);
 return el?String(el.textContent||"").trim().slice(0,max):"";
}
function firstChild(node){return node?.firstElementChild||null}
function taxGroup(imposto,name){
 const container=direct(imposto,name),variant=firstChild(container);
 return {name:variant?.localName||"",code:text(variant,"CST")||text(variant,"CSOSN"),
  origin:text(variant,"orig"),base:text(variant,"vBC"),rate:text(variant,"pICMS")||text(variant,"pPIS")||text(variant,"pCOFINS")||text(variant,"pIPI"),
  amount:text(variant,"vICMS")||text(variant,"vPIS")||text(variant,"vCOFINS")||text(variant,"vIPI"),
  baseST:text(variant,"vBCST"),rateST:text(variant,"pICMSST"),valueST:text(variant,"vICMSST"),
  redBC:text(variant,"pRedBC"),ipiEnq:text(container,"cEnq")
 };
}
function parseXml(xml){
 if(typeof xml!=="string" || !xml.trim() || xml.length>MAX_BYTES)throw Error("Arquivo XML vazio ou acima de 6 MB.");
 if(/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml))throw Error("XML com entidade ou DTD não é aceito por segurança.");
 if(typeof DOMParser==="undefined")throw Error("Leitura XML indisponível neste navegador.");
 const d=new DOMParser().parseFromString(xml,"application/xml");
 if(d.getElementsByTagName("parsererror").length || d.getElementsByTagNameNS("*","parsererror").length)throw Error("O XML não está bem formado.");
 const nfe=d.getElementsByTagNameNS("*","NFe")[0] || (d.documentElement?.localName==="NFe"?d.documentElement:null);
 const inf=nfe?direct(nfe,"infNFe"):null;
 if(!inf)throw Error("O arquivo não contém uma NF-e com grupo infNFe.");
 const items=[];
 const elements=[...inf.children].filter(el=>el.localName==="det");
 if(elements.length===0)throw Error("Esta NF-e não contém itens de produto.");
 for(const det of elements.slice(0,990)){
  const p=direct(det,"prod"),imposto=direct(det,"imposto");
  if(!p)continue;
  const taxIcms=taxGroup(imposto,"ICMS");
  const taxIpi=taxGroup(imposto,"IPI");
  const taxPis=taxGroup(imposto,"PIS");
  const taxCofins=taxGroup(imposto,"COFINS");
  const taxIBS=direct(imposto,"IBSCBS"), taxIBSCore=direct(taxIBS,"gIBSCBS");
  items.push({
    item:det.getAttribute("nItem")||String(items.length+1),
    description:text(p,"xProd",180),
    productCode:text(p,"cProd",50),
    ncm:text(p,"NCM",12).replace(/\D/g,""),
    cest:text(p,"CEST",12).replace(/\D/g,""),
    cfop:text(p,"CFOP",8),
    cbenef:text(p,"cBenef",25),
    gtin:text(p,"cEAN",30),
    gtinTrib:text(p,"cEANTrib",30),
    exTipi:text(p,"EXTIPI",12),
    unit:text(p,"uCom",12),
    icms:taxIcms,ipi:taxIpi,pis:taxPis,cofins:taxCofins,
    ibscbs:{code:text(taxIBS,"CST"),cClassTrib:text(taxIBS,"cClassTrib"),
     valueCBS:text(direct(taxIBSCore,"gCBS"),"vCBS"),valueIBS:text(taxIBSCore,"vIBS")}
  });
 }
 if(!items.length)throw Error("Nenhum item com dados de produto foi localizado.");
 const ide=direct(inf,"ide"),prot=d.getElementsByTagNameNS("*","protNFe")[0];
 return {
   itemCount:items.length,items:items,
   nfNumber:text(ide,"nNF",20),series:text(ide,"serie",12),
   issueDate:text(ide,"dhEmi",35)||text(ide,"dEmi",35),
   emissionType:text(ide,"tpEmis",3),
   protocolStatus:text(direct(prot,"infProt"),"cStat",8),
   caution:"A leitura é local. A existência do XML e dos campos não comprova autorização, assinatura ou autenticidade fiscal."
 };
}
async function parseFile(file){
 if(!file||file.size===0||file.size>MAX_BYTES)throw Error("Selecione um XML de até 6 MB.");
 if(!/\.xml$/i.test(file.name||""))throw Error("Selecione um arquivo com extensão .xml.");
 const data=await file.text();
 return parseXml(data);
}
root.FORTE_XML_NFE={parseFile,parseXml};
})(typeof window!=="undefined"?window:globalThis);
