import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const examples=JSON.parse(readFileSync(new URL('./fixtures/nfe_historicas_anonimas.json',import.meta.url),'utf8'));
const catalogSource=readFileSync(new URL('../classificacao.js',import.meta.url),'utf8');
const mgSource=readFileSync(new URL('../st-mg-evidencias.js',import.meta.url),'utf8');
const w={};vm.runInNewContext(catalogSource,{window:w},{timeout:1000});vm.runInNewContext(mgSource,{window:w},{timeout:1000});
const classify=w.FORTE_CLASSIFICACAO.suggest,evaluate=w.FORTE_ST_MG_EVIDENCIAS.evaluate;
test('amostras XML retêm somente classificação e impostos observados, sem identificadores',()=>{
 assert.equal(examples.cases.length,4);
 const raw=JSON.stringify(examples);
 assert.doesNotMatch(raw,/\b\d{44}\b/);
 assert.doesNotMatch(raw,/\b\d{14}\b/);
 assert.doesNotMatch(raw,/razao_social|nProt|chave_acesso|endere[cç]o/);
 assert.ok(examples.cases.every(x=>x.authorization_status==='100'&&x.model==='55'));
});
test('XMLs históricos cimento MG→GO mostram 6.401/CST10 com ST, sem comprovar outras rotas',()=>{
 const list=examples.cases.filter(x=>x.group==='cimento');
 assert.equal(list.length,3);
 for(const x of list){
  assert.equal(x.origin_uf,'MG');assert.equal(x.destination_uf,'GO');
  assert.equal(x.ncm,'25232910');assert.equal(x.cest,'0500100');
  assert.equal(x.cfop,'6401');assert.equal(x.icms_cst,'10');
  assert.equal(x.st_amount_positive,true);
  assert.equal(evaluate({from:x.origin_uf,to:x.destination_uf,ncm:x.ncm,cest:x.cest}).status,'destino_nao_coberto');
 }
});
test('XML histórico com CEST de argamassa não prova automaticamente ST',()=>{
 const x=examples.cases.find(x=>x.group==='argamassa');
 assert.equal(x.origin_uf,'GO');assert.equal(x.destination_uf,'GO');
 assert.equal(x.ncm,'32149000');assert.equal(x.cest,'1000300');
 assert.equal(x.cfop,'5102');assert.equal(x.icms_cst,'00');
 assert.equal(x.st_amount_positive,false);
});
test('tipo CP-II e CP-V não devem atribuir 25232990 automaticamente',()=>{
 for(const type of ['Cimento CP II F 32','Cimento CP V ARI']){
  const r=classify(type);
  assert.equal(r.ncm,'');
  assert.ok(r.options.some(x=>x.ncm==='25232910'));
  assert.ok(r.options.some(x=>x.ncm==='25232990'));
  const selected=classify(type,'25232910');
  assert.equal(selected.ncm,'25232910');
 }
});
test('caminho inverso GO→MG não pode copiar automaticamente o CFOP 6.401 de MG→GO',()=>{
 const r=evaluate({from:'GO',to:'MG',ncm:'25232910',cest:'0500100'});
 assert.equal(r.status,'st_ambito_interestadual_por_acordo');
 assert.equal(r.validation,'evidencia_legal_para_revisao_nao_homologada');
 assert.equal(r.base.mvaNaoHomologadaParaCalculo,true);
});
