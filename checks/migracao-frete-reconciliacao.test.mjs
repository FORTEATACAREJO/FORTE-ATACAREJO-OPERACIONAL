import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {gravarStaging,reconciliar} from '../tools/migracao-frete/reconciliar.mjs';

const uuid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const empresaId='49832961-0000-4000-8000-000000000001';
const gates={backupFonteValidado:true,backupDestinoValidado:true,restauracaoTestada:true,conciliacaoValidada:true,aprovacaoHumana:true};
function origem(ajuste=(copia)=>copia){
 const motoristas=Array.from({length:23},(_,indice)=>({id:uuid(indice+1),nome:`Motorista ${indice+1}`,cpf:'11122233344',telefone:'34999990000',cnh_registro:'12345678901',proprietario_nome:'Transportadora',chave_pix:'pix-teste',titular_pix:'Transportadora',atualizado_em:'2026-11-01T00:00:00Z'}));
 const veiculos=[1,2].map(indice=>({id:uuid(100+indice),motorista_id:uuid(indice),placa:indice===1?'ABC1D23':'DEF2G34',capacidade_efetiva_t:40,atualizado_em:'2026-11-01T00:00:00Z'}));
 const rotas=Array.from({length:5},(_,indice)=>({id:uuid(200+indice+1),origem:`Origem ${indice+1}`,destino:`Destino ${indice+1}`}));
 const documentos=[{id:uuid(301),motorista_id:uuid(1),tipo:'CNH',storage_bucket:'documentos',storage_path:'frete/cnh-1',atualizado_em:'2026-11-01T00:00:00Z'}];
 const usuarios=Array.from({length:4},(_,indice)=>({id:uuid(400+indice+1),perfil:'MOTORISTA',auth_user_id:uuid(500+indice+1),status_aprovacao:'APROVADO'}));
 return ajuste({motoristas,veiculos,rotas,documentos,usuarios});
}

test('ensaio preserva a base auditada e não devolve dado pessoal nem grava',async()=>{
 const plano=reconciliar(origem(),[],{empresaId});
 assert.equal(plano.dryRun,true);
 assert.equal(plano.escreve,false);
 assert.deepEqual(plano.bloqueios,[]);
 assert.deepEqual(plano.contagem,{motorista:23,veiculo:2,rota:5,documento:1,usuario:4});
 assert.equal(plano.chaves.length,35);
 assert.equal(new Set(plano.chaves).size,35);
 const texto=JSON.stringify(plano);
 assert.doesNotMatch(texto,/11122233344|pix-teste|Motorista 1/);
 const db={query(){throw new Error('dry-run não pode gravar');}};
 assert.deepEqual(await gravarStaging(db,'lote',plano),{gravados:0,ignorado:true});
});
test('falta de pessoa, conflito, auth ou documento bloqueiam a escrita mesmo com pedido de aplicar',()=>{
 const incompleta=reconciliar(origem(copia=>{copia.motoristas.pop();return copia;}),[],{empresaId,aplicar:true,gates});
 assert.equal(incompleta.escreve,false);
 assert.ok(incompleta.bloqueios.includes('base_incompleta'));
 const conflito=reconciliar(origem(),[{chave:`FORTE_FRETE:motorista:${uuid(1)}`,hash:'outro',atualizadoEm:'2026-11-08T00:00:00Z',apto:true}],{empresaId,aplicar:true,gates});
 assert.ok(conflito.bloqueios.includes('conflito'));
 const semAuth=reconciliar(origem(copia=>{delete copia.usuarios[0].auth_user_id;return copia;}),[],{empresaId,aplicar:true,gates});
 assert.ok(semAuth.bloqueios.includes('auth_sem_referencia'));
 const semArquivo=reconciliar(origem(copia=>{copia.documentos[0]={...copia.documentos[0],storage_path:'',conteudo_base64:'QUFB',senha:'segredo'};return copia;}),[],{empresaId,aplicar:true,gates});
 assert.ok(semArquivo.bloqueios.includes('storage_sem_referencia'));
 assert.equal(JSON.stringify(semArquivo).includes('segredo'),false);
 assert.equal(JSON.stringify(semArquivo).includes('QUFB'),false);
 const menor=reconciliar(origem(),[{chave:'FORTE_FRETE:motorista:10000000-0000-4000-8000-000000009999',hash:'x',atualizadoEm:'2026-11-01T00:00:00Z',apto:false}],{empresaId,aplicar:true,gates});
 assert.ok(menor.bloqueios.includes('origem_menor_que_staging'));
 assert.equal(reconciliar(origem(),[],{empresaId,aplicar:true,gates:{...gates,aprovacaoHumana:false}}).escreve,false);
});
test('aplicar no staging é idempotente, inativo e não cria auth nem apaga a base',async()=>{
 const sql=readFileSync(new URL('../tools/migracao-frete/revisao/001_staging_frete_operacional.sql',import.meta.url),'utf8');
 const primeira=reconciliar(origem(),[],{empresaId,aplicar:true,dryRun:false,gates});
 assert.equal(primeira.escreve,true);
 assert.equal(primeira.decisoes.every(item=>item.registro?.ativo!==true),true);
 const db=new PGlite();
 try{
  await db.exec(sql);
  const lote=await db.query(`insert into migracao_frete.lotes(observacao) values('ensaio') returning id`);
  const loteId=lote.rows[0].id;
  const gravado=await gravarStaging(db,loteId,primeira);
  assert.equal(gravado.gravados,35);
  const guardado=await db.query('select chave,conteudo_hash,origem_atualizado_em,apto,ativo from migracao_frete.itens');
  assert.equal(guardado.rows.length,35);
  assert.equal(guardado.rows.every(row=>row.ativo===false),true);
  const destino=guardado.rows.map(row=>({chave:row.chave,hash:row.conteudo_hash,atualizadoEm:row.origem_atualizado_em,apto:row.apto}));
  const repetida=reconciliar(origem(),destino,{empresaId,aplicar:true,dryRun:false,gates});
  assert.equal(repetida.resumo.contagem.preservar,35);
  assert.equal((await gravarStaging(db,loteId,repetida)).gravados,0);
  assert.equal((await db.query('select count(*)::int as total from migracao_frete.itens')).rows[0].total,35);
  await assert.rejects(gravarStaging(db,loteId,{escreve:true,decisoes:[{escreve:true,entidade:'usuario',chave:'FORTE_FRETE:usuario:'+uuid(9),apto:false,registro:{senha:'segredo'}}]}));
 }finally{await db.close();}
});
