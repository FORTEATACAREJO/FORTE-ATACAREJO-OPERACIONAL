import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {anexarReferenciaCarga,caminhoAnexoFrete,decidirCargaMotorista} from '../apps/web/src/frete-motorista-operacao.mjs';

const carga={id:'c1',codigo:'HML-001',origem:'Arcos',destino:'Caldas Novas',produto:'Cimento',pesoKg:30000,status:'OFERECIDA',sandbox:true};
const hash='a'.repeat(64);
const userId='00000000-0000-4000-8000-000000000002';

test('aceite de homologação não ativa cadastro e repetir não duplica',()=>{
 const aceite=decidirCargaMotorista(carga,{decisao:'ACEITA'});
 assert.equal(aceite.ok,true);
 assert.equal(aceite.carga.status,'ACEITA');
 assert.equal(aceite.carga.ativo,undefined);
 assert.match(aceite.mensagem,/continua inativo/);
 const deNovo=decidirCargaMotorista(aceite.carga,{decisao:'ACEITA'});
 assert.equal(deNovo.idempotente,true);
 assert.equal(deNovo.carga,aceite.carga);
 assert.equal(decidirCargaMotorista({...carga,sandbox:false},{decisao:'ACEITA'}).ok,false);
});

test('recusa exige motivo e o anexo só entra depois do aceite, sem sobrescrever hash',()=>{
 assert.equal(decidirCargaMotorista(carga,{decisao:'RECUSADA',motivo:'n'}).ok,false);
 const recusa=decidirCargaMotorista(carga,{decisao:'RECUSADA',motivo:'Rota de teste'});
 assert.equal(recusa.carga.status,'RECUSADA');
 assert.equal(anexarReferenciaCarga(carga,{bucket:'fc-frete-sandbox',path:caminhoAnexoFrete(userId,carga.id),sha256:hash,userId}).ok,false);
 const aceita=decidirCargaMotorista(carga,{decisao:'ACEITA'}).carga;
 const anexo=anexarReferenciaCarga(aceita,{bucket:'fc-frete-sandbox',path:caminhoAnexoFrete(userId,carga.id),sha256:hash,userId});
 assert.equal(anexo.ok,true);
 assert.equal(anexo.carga.anexoPath,`${userId}/c1/comprovante`);
 assert.equal(anexarReferenciaCarga(anexo.carga,{bucket:'fc-frete-sandbox',path:caminhoAnexoFrete(userId,carga.id),sha256:hash,userId}).idempotente,true);
 assert.equal(anexarReferenciaCarga(anexo.carga,{bucket:'fc-frete-sandbox',path:caminhoAnexoFrete(userId,carga.id),sha256:'b'.repeat(64),userId}).ok,false);
 assert.equal(anexarReferenciaCarga(aceita,{bucket:'motorista-documentos',path:caminhoAnexoFrete(userId,carga.id),sha256:hash,userId}).ok,false);
 assert.equal(anexarReferenciaCarga(aceita,{bucket:'fc-frete-sandbox',path:`${userId}/c1/senha`,sha256:hash,userId}).ok,false);
});

test('a migração não apaga o legado nem grava carga fora da homologação',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261110011800_frete_perfil_motorista.sql','utf8');
 assert.match(sql,/p_app not in \('vendas','financeiro','venda-externa','carga-direta','patio','site','frete'\)/);
 assert.match(sql,/check\(sandbox\)/);
 assert.doesNotMatch(sql,/delete from|drop table|fc_motoristas/i);
 assert.match(sql,/fc-frete-sandbox/);
});
