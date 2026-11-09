import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {analisarMotoristaLegado} from '../tools/migracao-frete/normalizar-legado.mjs';
import {aplicarDecisao,planejarDocumento,planejarMotorista,planejarRota,planejarUsuario,planejarVeiculo,resumoPlano} from '../tools/migracao-frete/planejar-importacao.mjs';

const motorista={id:'11111111-1111-4111-8111-111111111111',nome:'Motorista Exemplo',cpf:'111.222.333-44',telefone:'(34) 99999-0000',cnh_registro:'12345678901',proprietario_nome:'Transportadora',chave_pix:'pix-key',titular_pix:'Transportadora',atualizado_em:'2026-11-01T00:00:00Z'};
const veiculo={id:'22222222-2222-4222-8222-222222222222',motorista_id:motorista.id,placa:'abc1d23',capacidade_efetiva_t:48.5,atualizado_em:'2026-11-01T00:00:00Z'};

test('plano de motorista reutiliza a validação existente e mantém inativo',()=>{
 const plano=planejarMotorista(motorista,{capacidade_efetiva_t:48.5},'empresa-id');
 assert.equal(plano.apto,true);
 assert.equal(plano.registro.ativo,false);
 assert.equal(plano.chave,`FORTE_FRETE:motorista:${motorista.id}`);
 assert.equal(planejarMotorista({...motorista,cpf:''},null,'empresa-id').apto,false);
});
test('veículo, rota, documento e usuário não copiam segredo nem anexo',()=>{
 const veiculoPlano=planejarVeiculo(veiculo);
 assert.equal(veiculoPlano.apto,true);
 assert.equal(veiculoPlano.registro.placa,'ABC1D23');
 assert.equal(veiculoPlano.registro.ativo,false);
 const rota=planejarRota({id:'33333333-3333-4333-8333-333333333333',origem:'Araguari/MG',destino:'Uberlândia/MG'});
 assert.equal(rota.apto,true);
 const documento=planejarDocumento({id:'44444444-4444-4444-8444-444444444444',motorista_id:motorista.id,tipo:'CNH',storage_bucket:'documentos',storage_path:'frete/cnh',conteudo_base64:'QUFB',senha:'nao-copiar'});
 assert.equal(documento.apto,false);
 assert.equal(JSON.stringify(documento).includes('nao-copiar'),false);
 assert.equal(JSON.stringify(documento).includes('QUFB'),false);
 const usuario=planejarUsuario({id:'55555555-5555-4555-8555-555555555555',perfil:'MOTORISTA',senha:'segredo',token:'abc'});
 assert.equal(usuario.apto,false);
 assert.equal(JSON.stringify(usuario).includes('segredo'),false);
 assert.equal(planejarUsuario({id:'55555555-5555-4555-8555-555555555555',perfil:'MOTORISTA'}).registro.ativo,false);
});
test('reexecução é idempotente e não cobre cadastro mais novo nem completo com dado pior',()=>{
 const entrada=planejarMotorista(motorista,{capacidade_efetiva_t:48.5},'empresa-id');
 const primeira=aplicarDecisao(null,entrada);
 const repetida=aplicarDecisao({hash:entrada.hash,atualizadoEm:entrada.atualizadoEm,apto:true},entrada);
 const antiga=aplicarDecisao({hash:'outro',atualizadoEm:'2026-11-08T00:00:00Z',apto:true},{...entrada,atualizadoEm:'2026-11-01T00:00:00Z',hash:'novo'});
 const incompleta=planejarMotorista({...motorista,cpf:'',atualizado_em:'2026-11-09T00:00:00Z'},null,'empresa-id');
 const conflito=aplicarDecisao({hash:entrada.hash,atualizadoEm:entrada.atualizadoEm,apto:true},incompleta);
 assert.equal(primeira.acao,'inserir');
 assert.equal(repetida.acao,'preservar');
 assert.equal(antiga.acao,'conflito');
 assert.equal(conflito.acao,'conflito');
 const resumo=JSON.stringify(resumoPlano([primeira,repetida,antiga,conflito]));
 assert.equal(JSON.parse(resumo).contagem.inserir,1);
 assert.equal(JSON.parse(resumo).contagem.preservar,1);
 assert.equal(JSON.parse(resumo).contagem.conflito,2);
 assert.doesNotMatch(resumo,/11122233344|Motorista Exemplo|pix-key/);
 assert.equal(analisarMotoristaLegado(motorista,{capacidade_efetiva_t:48.5},'empresa-id').registro.ativo,false);
});
test('SQL de revisão fica fora das migrations e só cria staging inativo',async()=>{
 const sql=readFileSync(new URL('../tools/migracao-frete/revisao/001_staging_frete_operacional.sql',import.meta.url),'utf8');
 const executavel=sql.replace(/--.*$/gm,'');
 assert.doesNotMatch(executavel,/drop\s+table\s+public|delete\s+from\s+public|truncate\s+public|auth\.users|service_role/i);
 assert.match(sql,/check \(ativo=false\)/);
 assert.match(sql,/revoke all on schema migracao_frete from public, anon, authenticated/i);
 const db=new PGlite();
 try{
  await db.exec(sql);
  const lote=await db.query(`insert into migracao_frete.lotes(observacao) values('ensaio local') returning id`);
  const loteId=lote.rows[0].id;
  const chave='FORTE_FRETE:motorista:11111111-1111-4111-8111-111111111111';
  const registro={nome:'Motorista Exemplo',ativo:false};
  const primeira=await db.query('select migracao_frete.registrar_item($1,$2,$3,$4,$5,$6,$7,$8) as acao',[loteId,'motorista',chave,true,[], '2026-11-01T00:00:00Z','hash-1',registro]);
  const repetida=await db.query('select migracao_frete.registrar_item($1,$2,$3,$4,$5,$6,$7,$8) as acao',[loteId,'motorista',chave,true,[], '2026-11-02T00:00:00Z','hash-1',registro]);
  const antiga=await db.query('select migracao_frete.registrar_item($1,$2,$3,$4,$5,$6,$7,$8) as acao',[loteId,'motorista',chave,true,[], '2026-10-01T00:00:00Z','hash-2',registro]);
  const nova=await db.query('select migracao_frete.registrar_item($1,$2,$3,$4,$5,$6,$7,$8) as acao',[loteId,'motorista',chave,true,[], '2026-11-03T00:00:00Z','hash-3',{nome:'Motorista Exemplo',ativo:false}]);
  const segredo=await db.query('select migracao_frete.registrar_item($1,$2,$3,$4,$5,$6,$7,$8) as acao',[loteId,'usuario','FORTE_FRETE:usuario:55555555-5555-4555-8555-555555555555',false,[],null,'hash-4',{senha:'segredo'}]);
  assert.deepEqual([primeira,repetida,antiga,nova,segredo].map(r=>r.rows[0].acao),['inserir','preservar','conflito','atualizar','bloquear']);
  const guardado=await db.query('select ativo,conteudo_hash from migracao_frete.itens where chave=$1',[chave]);
  assert.equal(guardado.rows[0].ativo,false);
  assert.equal(guardado.rows[0].conteudo_hash,'hash-3');
  await assert.rejects(db.query(`update migracao_frete.itens set ativo=true where chave=$1`,[chave]));
 }finally{await db.close();}
});
