import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../qualidade-fiscal.js',import.meta.url),'utf8');
const fakeWindow={};
vm.runInNewContext(source,{window:fakeWindow},{timeout:1000});
const {assess}=fakeWindow.FORTE_QUALIDADE_FISCAL;
const base={
 from:{uf:'GO',registrations:[]},
 to:{uf:'MG',registrations:[]},
 product:{code:'25232990',official:{entry:{nivel:8}},suggest:{cest:'0500100'},cests:[{cest:'0500100'}]},
 fiscal:{cfop:'6.403 (hipótese ST)'},
 stateData:{verifiedRuleCount:0,verifiedRules:[]},
 input:{goodsOrigin:'terceiros',buyerTaxStatus:'unknown'}
};
const evalCase=(overrides={})=>assess({...base,...overrides});
const hasCode=(report,code)=>report.issues.some(x=>x.code===code);

test('sem regras homologadas, nunca permite tratar a NF-e como autorizada',()=>{
 const r=evalCase();
 assert.equal(r.canIssue,false);
 assert.equal(r.stage,'nao_homologado');
 assert.ok(hasCode(r,'UF_REGRA'));
});
test('NCM encontrado nao e classificacao do produto',()=>{
 const r=evalCase();
 assert.ok(hasCode(r,'NCM_PRODUTO'));
 assert.equal(r.status['NCM do produto'],'Código existente; enquadramento pendente');
});
test('NCM ausente e um bloqueio concreto',()=>{
 const r=evalCase({product:{code:'',official:null,suggest:{},cests:[]}});
 assert.ok(hasCode(r,'NCM_CODIGO'));
});
test('CEST sem correspondencia deve ser conferido',()=>{
 const r=evalCase({product:{code:'25232990',official:{entry:{nivel:8}},suggest:{cest:'0500100'},cests:[]}});
 assert.ok(hasCode(r,'CEST'));
});
test('opcao declarada de contribuinte nao comprova IE',()=>{
 const r=evalCase({input:{goodsOrigin:'terceiros',buyerTaxStatus:'sim'}});
 assert.ok(hasCode(r,'IE_DECLARADA'));
});
test('IE de API cadastral com ativa=verdadeiro retira a pendencia de consulta',()=>{
 const r=evalCase({to:{uf:'MG',registrations:[{uf:'MG',ie:'12345',active:true}]}});
 assert.equal(hasCode(r,'IE'),false);
});
test('UF destino desconhecida impede fechamento da rota',()=>{
 const r=evalCase({to:{uf:'',registrations:[]}});
 assert.ok(hasCode(r,'UF'));
});
test('origem da mercadoria nao informada exige resposta',()=>{
 const r=evalCase({input:{goodsOrigin:'desconhecida',buyerTaxStatus:'unknown'}});
 assert.ok(hasCode(r,'ORIGEM'));
});
test('um CFOP unico permanece sujeito a revisao de regra tributaria',()=>{
 const r=evalCase({fiscal:{cfop:'6.102'}});
 assert.equal(r.status['CFOP de saída/entrada'],'Hipótese única; revisar');
 assert.equal(r.canIssue,false);
});
test('mesmo com regra hipoteticamente aprovada, faltam documentos e valores',()=>{
 const r=evalCase({
  fiscal:{cfop:'6.102'},
  stateData:{verifiedRules:[{id:10}],verifiedRuleCount:1},
  input:{goodsOrigin:'terceiros',buyerTaxStatus:'sim',triage:{taxRegime:'normal',specialRegime:'nao',unusual:'nao'},triageAssessment:{issues:[]}}
 });
 assert.equal(hasCode(r,'UF_REGRA'),false);
 assert.ok(hasCode(r,'VALORES'));
 assert.equal(r.canIssue,false);
});
test('origem nao revela CST de PIS/COFINS ou IBS/CBS',()=>{
 const r=evalCase();
 assert.ok(hasCode(r,'TRIBUTOS'));
});
