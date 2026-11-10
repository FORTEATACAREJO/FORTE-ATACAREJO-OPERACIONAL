import {test} from 'node:test';import assert from 'node:assert/strict';
import {analisarMotoristaLegado,resumoAnalise,permitirCorte} from '../tools/migracao-frete/normalizar-legado.mjs';
const base={id:'uuid-legado',nome:'Motorista Exemplo',cpf:'111.222.333-44',telefone:'(34) 99999-0000',cnh_registro:'12345678901',proprietario_nome:'Transportadora',chave_pix:'pix-key',titular_pix:'Transportadora'};
const veiculo={capacidade_efetiva_t:48.5};
test('conversao controlada de registro sem presumir aprovacao e sem mudar ID do legado',()=>{
 const r=analisarMotoristaLegado(base,veiculo,'empresa-id');
 assert.equal(r.apto,true);
 assert.equal(r.origemId,'uuid-legado');
 assert.equal(r.registro.ativo,false);
 assert.equal(r.registro.capacidade_operacional_kg,48500);
 assert.equal(r.registro.cpf,'11122233344');
});
test('campos obrigatorios incompletos bloqueiam importacao sem valores inventados',()=>{
 const r=analisarMotoristaLegado({...base,cpf:'',cnh_registro:'',chave_pix:''},null,'empresa-id');
 assert.equal(r.apto,false);assert.equal(r.registro,null);
 assert.deepEqual(new Set(r.camposPendentes),new Set(['cpf_valido','cnh','chave_pix','capacidade_t']));
});
test('resumo informa somente contagem e motivos, nunca dados pessoais',()=>{
 const rows=[analisarMotoristaLegado(base,veiculo,'empresa-id'),analisarMotoristaLegado({...base,telefone:''},veiculo,'empresa-id')];
 const report=JSON.stringify(resumoAnalise(rows));
 assert.equal(JSON.parse(report).aptos,1);
 assert.doesNotMatch(report,/11122233344|Motorista Exemplo/);
});
test('corte exige backup, restauracao, conciliacao e aprovacao',()=>{
 assert.equal(permitirCorte({backupFonteValidado:true,backupDestinoValidado:true,conciliacaoValidada:true,aprovacaoHumana:true}),false);
 assert.equal(permitirCorte({backupFonteValidado:true,backupDestinoValidado:true,restauracaoTestada:true,conciliacaoValidada:true,aprovacaoHumana:true}),true);
});
