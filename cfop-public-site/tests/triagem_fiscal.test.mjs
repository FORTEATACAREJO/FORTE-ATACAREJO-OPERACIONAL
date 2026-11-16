import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../triagem-fiscal.js',import.meta.url),'utf8');
const quality=readFileSync(new URL('../qualidade-fiscal.js',import.meta.url),'utf8');
const ids='taxRegime specialRegime specialKind specialScope specialValidity specialAct unusualOperation unusualKind operationDate specialFields unusualFields triageStatus'.split(' ');

function scenario(init={}){
 const mk=()=>({value:'',hidden:false,textContent:'',events:{},addEventListener(name,cb){this.events[name]=cb}});
 const e=Object.fromEntries(ids.map(id=>[id,mk()]));
 const document={getElementById(id){if(!e[id])throw Error('missing:'+id);return e[id]}};
 Object.assign(e.taxRegime,{value:init.regime||''});
 e.specialRegime.value=init.special||'';
 e.specialKind.value=init.kind||'';
 e.specialScope.value=init.scope||'';
 e.specialValidity.value=init.validity||'';
 e.specialAct.value=init.act||'';
 e.unusualOperation.value=init.unusual||'';
 e.unusualKind.value=init.unusualKind||'';
 e.operationDate.value=init.date||'';
 const w={};vm.runInNewContext(script,{window:w,document},{timeout:1000});
 const a=w.FORTE_TRIAGEM_FISCAL;a.refresh();
 return {e,a,v:a.read(),check:a.validate(a.read()),assessment:a.assess(a.read())};
}
test('sem triagem inicial não permite seguir para uma hipótese de CFOP',()=>{
 const x=scenario();
 assert.equal(x.check.ok,false);
 assert.match(x.check.message,/regime tributário/);
});
test('cenário geral declarado esconde perguntas irrelevantes',()=>{
 const x=scenario({regime:'normal',special:'nao',unusual:'nao'});
 assert.equal(x.check.ok,true);
 assert.equal(x.e.specialFields.hidden,true);
 assert.equal(x.e.unusualFields.hidden,true);
 assert.equal(x.assessment.needsReview,false);
});
test('não sei é permitido, mas exige confirmação documental',()=>{
 const x=scenario({regime:'nao_sei',special:'nao_sei',unusual:'nao_sei'});
 assert.equal(x.check.ok,true);
 assert.equal(x.assessment.needsReview,true);
 assert.ok(x.assessment.issues.length>=3);
});
test('regime especial ativo exige declarar tributo, abrangência e vigência',()=>{
 const x=scenario({regime:'normal',special:'sim',unusual:'nao'});
 assert.equal(x.e.specialFields.hidden,false);
 assert.equal(x.check.ok,false);
 assert.match(x.check.message,/área do regime/);
});
test('ato informado não é prova de validade e não homologa cálculo',()=>{
 const x=scenario({regime:'normal',special:'sim',kind:'st',scope:'sim',validity:'sim',act:'Portaria fictícia 123/2026',unusual:'nao'});
 assert.equal(x.check.ok,true);
 assert.equal(x.assessment.specialDeclared,true);
 assert.equal(x.assessment.needsReview,true);
 assert.equal(x.assessment.noAutomaticSpecialBenefits,true);
});
test('regime possivelmente vencido é sinalizado como pendente',()=>{
 const x=scenario({regime:'normal',special:'sim',kind:'icms',scope:'nao_sei',validity:'nao',unusual:'nao'});
 assert.equal(x.check.ok,true);
 assert.equal(x.assessment.specialUnverified,true);
 assert.ok(x.assessment.issues.some(i=>i.includes('vigência')));
});
test('operação com tributação monofásica pede classificação e lei própria',()=>{
 const x=scenario({regime:'simples',special:'nao',unusual:'sim',unusualKind:'monofasico'});
 assert.equal(x.check.ok,true);
 assert.equal(x.e.unusualFields.hidden,false);
 assert.equal(x.assessment.needsReview,true);
 assert.ok(x.assessment.issues.some(i=>i.includes('monofásica')));
});
test('particularidade marcada sem subtipo precisa de resposta',()=>{
 const x=scenario({regime:'normal',special:'nao',unusual:'sim'});
 assert.equal(x.check.ok,false);
});
test('regime especial jamais transforma regra do banco em NF-e pronta',()=>{
 const x=scenario({regime:'normal',special:'sim',kind:'st',scope:'sim',validity:'sim',act:'Ato 123',unusual:'nao'});
 const w={};vm.runInNewContext(quality,{window:w},{timeout:1000});
 const r=w.FORTE_QUALIDADE_FISCAL.assess({
  from:{uf:'GO'},to:{uf:'MG'},
  product:{code:'25232910',official:{entry:{nivel:8}},suggest:{cest:'0500100'},cests:[{cest:'0500100'}]},
  fiscal:{cfop:'6.403'},
  stateData:{verifiedRules:[{id:1}],verifiedRuleCount:1},
  input:{goodsOrigin:'terceiros',buyerTaxStatus:'sim',triage:x.v,triageAssessment:x.assessment}
 });
 assert.equal(r.canIssue,false);
 assert.equal(r.stage,'nao_homologado');
 assert.ok(r.issues.some(item=>item.code==='REGIME_ESPECIAL'));
 assert.ok(r.issues.some(item=>item.code==='UF_REGRA'));
});
