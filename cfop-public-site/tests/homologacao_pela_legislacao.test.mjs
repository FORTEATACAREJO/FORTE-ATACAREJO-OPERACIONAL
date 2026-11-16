import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const lawSource=readFileSync(new URL('../fundamentacao-legal.js',import.meta.url),'utf8');
const qualitySource=readFileSync(new URL('../qualidade-fiscal.js',import.meta.url),'utf8');
function tools(){
 const window={};vm.runInNewContext(lawSource,{window},{timeout:1000});
 vm.runInNewContext(qualitySource,{window},{timeout:1000});
 return window;
}
const OP={fromUF:'MG',toUF:'GO',natureza:'compra_ativo',finalidade:'ativo_imobilizado',
 ncm:'84798999',cest:'',date:'2026-11-16',specialRegime:'nao'};
function exampleRule(){
 // Apenas um EXEMPLO SINTÉTICO para testar exigências; não é uma norma real.
 return{
  situacao:'homologada',homologado_em:'2026-11-16',uf_origem:'MG',uf_destino:'GO',
  ncm:'84798999',natureza:'compra_ativo',finalidade:'ativo_imobilizado',
  fonte_url:'https://goias.gov.br/economia/exemplo-sintetico',ato_normativo:'Ato fictício de teste',
  artigo:'art. 1º (simulação)',vigencia_inicio:'2026-01-01',
  revisao_legal:{aprovada:true,revisor:'REVISOR FICTÍCIO',data:'2026-11-16',
   produto_enquadrado:true,excecoes_analisadas:true,ato_especial_verificado:false}
 };
}
test('fonte oficial válida não pode ser imitada por domínio externo',()=>{
 const {FORTE_FUNDAMENTO_LEGAL:law}=tools();
 assert.equal(law.officialSource('https://www.fazenda.mg.gov.br/legislacao'),true);
 assert.equal(law.officialSource('https://www.gov.br/receitafederal'),true);
 assert.equal(law.officialSource('https://www.fazenda.mg.gov.br.evil.com/lei'),false);
 assert.equal(law.officialSource('http://goias.gov.br/lei'),false);
});
test('sem qualquer XML, documentação jurídica sintética completa passa no gate documental',()=>{
 const {FORTE_FUNDAMENTO_LEGAL:law}=tools();
 const r=law.reviewRule(exampleRule(),OP);
 assert.equal(r.ready,true);
 assert.equal(r.xmlRequired,false);
 assert.equal(r.canIssue,false);
});
test('enviar XML não substitui ato oficial e revisão humana',()=>{
 const {FORTE_FUNDAMENTO_LEGAL:law}=tools();
 const r=law.reviewRule({xml_validado:true,cfop:'2.551',ncm:'84798999'},OP);
 assert.equal(r.ready,false);
 assert.ok(r.problems.some(t=>/fundamento legal/i.test(t)));
});
test('vigência e escopo do estado devem corresponder à operação',()=>{
 const {FORTE_FUNDAMENTO_LEGAL:law}=tools();
 const expired={...exampleRule(),vigencia_fim:'2026-05-31'};
 const bad=law.reviewRule(expired,{...OP,fromUF:'SP'});
 assert.equal(bad.ready,false);
 assert.ok(bad.problems.some(t=>/fim de vigência/.test(t)));
 assert.ok(bad.problems.some(t=>/rota de origem/.test(t)));
});
test('revisão de produto e exceções não pode ser inferida do NCM',()=>{
 const {FORTE_FUNDAMENTO_LEGAL:law}=tools();
 const rule=exampleRule();
 rule.revisao_legal.produto_enquadrado=false;
 assert.equal(law.reviewRule(rule,OP).ready,false);
 rule.revisao_legal.produto_enquadrado=true;
 rule.revisao_legal.excecoes_analisadas=false;
 assert.equal(law.reviewRule(rule,OP).ready,false);
});
test('regime especial exige verificação específica do ato concessivo',()=>{
 const {FORTE_FUNDAMENTO_LEGAL:law}=tools();
 assert.equal(law.reviewRule(exampleRule(),{...OP,specialRegime:'sim'}).ready,false);
 const r=exampleRule();r.revisao_legal.ato_especial_verificado=true;
 assert.equal(law.reviewRule(r,{...OP,specialRegime:'sim'}).ready,true);
});
test('documento não disponível não bloqueia consulta orientativa; sem norma revisada permanece não homologado',()=>{
 const w=tools();
 const r=w.FORTE_QUALIDADE_FISCAL.assess({
  from:{uf:'MG',registrations:[]},to:{uf:'GO',registrations:[]},
  product:{code:'84798999',official:{entry:{nivel:8}},suggest:{},cests:[]},
  fiscal:{cfop:'2.551 ou 2.406'},
  stateData:{verifiedRuleCount:0,verifiedRules:[]},
  input:{
   nature:'compra_ativo',goodsOrigin:'desconhecida',buyerTaxStatus:'unknown',
   simulation:true,journey:{mode:'compra',purpose:'ativo',sellerType:'empresa',assetUse:'sim',invoiceStatus:'nao_emitida'},
   triage:{taxRegime:'normal',specialRegime:'nao',unusual:'nao',operationDate:'2026-11-16'},
   triageAssessment:{issues:[]}
  }
 });
 assert.equal(r.canIssue,false);
 assert.equal(r.stage,'nao_homologado');
 assert.ok(r.issues.some(x=>x.code==='UF_REGRA'));
 assert.ok(!r.issues.some(x=>x.code==='DOCUMENTO_PENDENTE'||x.code==='XML'));
 assert.match(r.status['Base da homologação'],/XML não exigido/);
});
test('contagem remota de regras sozinha não cria homologação legal',()=>{
 const w=tools();
 const evidence=w.FORTE_FUNDAMENTO_LEGAL.assess({verifiedRuleCount:1,verifiedRules:[{cfop:'2.551',xml_validado:true}]},OP);
 assert.equal(evidence.hasApplicableReviewedRule,false);
 assert.equal(evidence.legalReviewedCount,0);
});
