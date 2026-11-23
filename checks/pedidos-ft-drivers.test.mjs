import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isDriverSelectable,driverOptionsFrom} from '../apps/web/src/pedidos-ft-drivers.mjs';

test('somente motoristas ativos e aprovados entram no seletor',()=>{
 const rows=[
  {id:'ativo',nome:'Motorista de teste',ativo:true,statusCadastro:'APROVADO',placa1:'AAA1B23',capacidadeMaximaKg:40000},
  {id:'legado',nome:'Legado',ativo:false,statusCadastro:'LEGADO'},
  {id:'inativo-aprovado',nome:'Aprovado mas inativo',ativo:false,statusCadastro:'APROVADO'},
  {id:'pendente',nome:'Pendência',ativo:true,status_ia:'PENDENTE_CONFERENCIA_DOCUMENTAL'},
  {id:'analise',nome:'Análise',ativo:true,statusCadastro:'EM_ANALISE'},
  {id:'sem-ativacao',nome:'Sem validação',statusCadastro:'APROVADO'},
  {id:'recusado',nome:'Recusado',ativo:true,statusCadastro:'RECUSADO'}
 ];
 assert.deepEqual(rows.filter(isDriverSelectable).map(m=>m.id),['ativo']);
 const options=driverOptionsFrom(rows);
 assert.deepEqual(options.map(m=>m.value),['ativo']);
 assert.match(options[0].label,/limite 40.000 kg/);
 assert.equal(isDriverSelectable(rows[2]),false,'aprovado, mas inativo, não pode ser selecionado');
});
test('modal não deve aceitar motorista do cadastro inativo nem ignorar aprovação',()=>{
 assert.deepEqual(driverOptionsFrom([{id:'x',ativo:false,statusCadastro:'APROVADO'}]),[]);
 assert.equal(isDriverSelectable({id:'teste',ativo:true,statusCadastro:'LEGADO'}),false);
 assert.equal(isDriverSelectable(null),false);
});

test('pré-aprovação cadastral pelo gestor não substitui a habilitação operacional',()=>{
 const preApproved={id:'pre',nome:'Motorista pré-aprovado',ativo:false,statusCadastro:'LEGADO',preAprovadoCadastro:true,documentosConferidos:false};
 assert.equal(isDriverSelectable(preApproved),false);
 assert.equal(driverOptionsFrom([preApproved]).length,0,'o motorista deve continuar bloqueado para expedição');
});
