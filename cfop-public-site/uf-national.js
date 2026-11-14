/* FORTECOMPANNY — referência nacional IBGE / MOC NF-e.
 * 26 estados + Distrito Federal; classificação fiscal estadual requer prova e vigência.
 * Fonte: https://hom.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?AspxAutoDetectCookieSupport=1&conteudo=BSUCYHAKYUk%3D
 */
(function(root){
"use strict";
const list=Object.freeze([{"uf":"RO","cuf":"11","name":"Rondônia","region":"Norte"},{"uf":"AC","cuf":"12","name":"Acre","region":"Norte"},{"uf":"AM","cuf":"13","name":"Amazonas","region":"Norte"},{"uf":"RR","cuf":"14","name":"Roraima","region":"Norte"},{"uf":"PA","cuf":"15","name":"Pará","region":"Norte"},{"uf":"AP","cuf":"16","name":"Amapá","region":"Norte"},{"uf":"TO","cuf":"17","name":"Tocantins","region":"Norte"},{"uf":"MA","cuf":"21","name":"Maranhão","region":"Nordeste"},{"uf":"PI","cuf":"22","name":"Piauí","region":"Nordeste"},{"uf":"CE","cuf":"23","name":"Ceará","region":"Nordeste"},{"uf":"RN","cuf":"24","name":"Rio Grande do Norte","region":"Nordeste"},{"uf":"PB","cuf":"25","name":"Paraíba","region":"Nordeste"},{"uf":"PE","cuf":"26","name":"Pernambuco","region":"Nordeste"},{"uf":"AL","cuf":"27","name":"Alagoas","region":"Nordeste"},{"uf":"SE","cuf":"28","name":"Sergipe","region":"Nordeste"},{"uf":"BA","cuf":"29","name":"Bahia","region":"Nordeste"},{"uf":"MG","cuf":"31","name":"Minas Gerais","region":"Sudeste"},{"uf":"ES","cuf":"32","name":"Espírito Santo","region":"Sudeste"},{"uf":"RJ","cuf":"33","name":"Rio de Janeiro","region":"Sudeste"},{"uf":"SP","cuf":"35","name":"São Paulo","region":"Sudeste"},{"uf":"PR","cuf":"41","name":"Paraná","region":"Sul"},{"uf":"SC","cuf":"42","name":"Santa Catarina","region":"Sul"},{"uf":"RS","cuf":"43","name":"Rio Grande do Sul","region":"Sul"},{"uf":"MS","cuf":"50","name":"Mato Grosso do Sul","region":"Centro-Oeste"},{"uf":"MT","cuf":"51","name":"Mato Grosso","region":"Centro-Oeste"},{"uf":"GO","cuf":"52","name":"Goiás","region":"Centro-Oeste"},{"uf":"DF","cuf":"53","name":"Distrito Federal","region":"Centro-Oeste"}]);
const lookup=Object.freeze(Object.fromEntries(list.map(x=>[x.uf,x])));
const sameState=(a,b)=>a===b&&Boolean(lookup[a]);
const recognized=uf=>typeof uf==="string"&&Boolean(lookup[uf]);
const route=(origin,destination)=>{
 if(!recognized(origin)||!recognized(destination))return {valid:false,type:"invalid",cfopPrefix:"",warning:"UF não encontrada na tabela de 27 UFs."};
 return {valid:true,origin,destination,originCode:lookup[origin].cuf,destinationCode:lookup[destination].cuf,
   sameState:sameState(origin,destination),type:sameState(origin,destination)?"interna":"interestadual",
   nfeCodeOrigin:lookup[origin].cuf,
   cfopPrefix:sameState(origin,destination)?"1/5":"2/6",
   regulationStatus:"pendente_homologacao",warning:"A categoria nacional de CFOP pode ser sugerida sob hipóteses. ICMS, ST, DIFAL, FCP, benefícios e CST dependem de legislação estadual vigente e análise documental."};
};
root.FORTE_UFS=Object.freeze({list,lookup,recognized,route,counts:{ufs:27,originDestinationRoutes:27*27}});
})(typeof window!=="undefined"?window:globalThis);
