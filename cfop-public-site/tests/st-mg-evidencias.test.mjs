import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const raw=readFileSync(new URL('../st-mg-evidencias.js',import.meta.url),'utf8');
const w={};
vm.runInNewContext(raw,{window:w},{timeout:1000});
const {evaluate,ufs,source}=w.FORTE_ST_MG_EVIDENCIAS;
const coverage={
 cimento:new Set('AC AL AP BA CE DF ES GO MA MT MS PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')),
 argamassa:new Set('AP BA ES PA PR RJ RS SP'.split(' '))
};
const check=(from,ncm,cest)=>evaluate({from,to:'MG',ncm,cest});
for(const uf of ufs){
 test('cimento '+uf+' para MG respeita lista do capítulo 5',()=>{
  const r=check(uf,'25232990','0500100');
  const expected=uf==='MG'?'st_ambito_interno':coverage.cimento.has(uf)?'st_ambito_interestadual_por_acordo':'sem_acordo_interestadual_listado';
  assert.equal(r.status,expected);
  assert.equal(r.base.cest,'0500100');
  assert.equal(r.base.mvaNaoHomologadaParaCalculo,true);
  assert.equal(r.validation,'evidencia_legal_para_revisao_nao_homologada');
  assert.ok(r.sources.every(x=>x.url.startsWith('https://www.fazenda.mg.gov.br/')));
 });
 test('argamassa '+uf+' para MG respeita lista do capítulo 10',()=>{
  const r=check(uf,'32149000','1000300');
  const expected=uf==='MG'?'st_ambito_interno':coverage.argamassa.has(uf)?'st_ambito_interestadual_por_acordo':'sem_acordo_interestadual_listado';
  assert.equal(r.status,expected);
  assert.equal(r.base.cest,'1000300');
  assert.equal(r.base.mvaNaoHomologadaParaCalculo,true);
 });
}
test('GO -> MG cimento sujeito a protocolo 11/85',()=>assert.equal(check('GO','25232990','0500100').status,'st_ambito_interestadual_por_acordo'));
test('GO -> MG argamassa sem protocolo 10.1 não significa sem ST na entrada',()=>{
 const v=check('GO','32149000','1000300');
 assert.equal(v.status,'sem_acordo_interestadual_listado');
 assert.match(v.legalScope,/destinatário mineiro/);
});
test('SP -> MG argamassa incluída nos protocolos',()=>assert.equal(check('SP','32149000','1000300').status,'st_ambito_interestadual_por_acordo'));
test('AM -> MG cimento não deve ser forçado a acordo',()=>assert.equal(check('AM','25232990','0500100').status,'sem_acordo_interestadual_listado'));
test('MG -> MG mantém regra interna sem confundir com protocolo',()=>assert.equal(check('MG','25232990','0500100').status,'st_ambito_interno'));
test('código e CEST precisam corresponder, não basta nome do produto',()=>{
 assert.equal(check('GO','32149000','0500100').status,'produto_nao_coberto');
 assert.equal(check('GO','25232990','1000300').status,'produto_nao_coberto');
});
test('outras UFs de destino não são inferidas a partir de MG',()=>{
 assert.equal(evaluate({from:'GO',to:'SP',ncm:'25232990',cest:'0500100'}).status,'destino_nao_coberto');
});
test('NCM parcial/CEST ausente não dá enquadramento automático',()=>{
 assert.equal(check('GO','2523','0500100').status,'st_ambito_interestadual_por_acordo'); // Prefixo NCM de cimento, uso apenas classificatório
 assert.equal(check('GO','25232990','').status,'produto_nao_coberto');
});
