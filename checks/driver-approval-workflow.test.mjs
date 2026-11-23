import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyWorkflow,validDriver} from '../supabase/functions/orders-workflow/domain.mjs';

const state=()=>({settings:{},motoristas:[{id:'drv-1',nome:'Motorista Teste',cpf:'',cnhNumero:'',cnhCategoria:'',cnhValidade:'',telefone:'',ativo:false,statusCadastro:'LEGADO',documentosConferidos:false,preAprovadoCadastro:true}],auditoria:[],workflowEvents:[]});
const admin={user_id:'admin-test',nome:'Administrador',perfil:'MASTER',ativo:true,status_aprovacao:'APROVADO',trocar_senha:false};
const approved={
 action:'DRIVER_REVIEW',motoristaId:'drv-1',requestId:'review-1',
 cpf:'52998224725',cnhNumero:'12345678901',cnhCategoria:'D',cnhValidade:'2030-05-12',
 telefone:'34999999999',aprovar:true,documentosConferidos:true,confirmacaoResponsavel:true,
 referenciaConferencia:'CNH original e categoria conferidas presencialmente'
};
const at='2026-11-23T18:00:00.000Z';
const perform=(payload,profile=admin)=>applyWorkflow(state(),payload,profile,{id:'audit-1',at});

test('motorista inativo abre revisão sem liberar; rascunho fica pendente',()=>{
 const out=perform({...approved,aprovar:false,documentosConferidos:false,confirmacaoResponsavel:false});
 const m=out.state.motoristas[0];
 assert.equal(m.ativo,false);
 assert.equal(m.statusCadastro,'PENDENTE_DOCUMENTOS');
 assert.equal(m.documentosConferidos,false);
 assert.equal(m.cnhNumero,'12345678901');
 assert.match(out.result.warning,/pendente/);
});
test('não permite aprovação sem confirmação documental real',()=>{
 assert.throws(()=>perform({...approved,documentosConferidos:false}),/Confirme expressamente/);
 assert.throws(()=>perform({...approved,confirmacaoResponsavel:false}),/Confirme expressamente/);
 assert.throws(()=>perform({...approved,referenciaConferencia:''}),/Registre a referência/);
});
test('não permite CPF inválido, CNH ausente ou vencida',()=>{
 assert.throws(()=>perform({...approved,cpf:'11111111111'}),/CPF inválido/);
 assert.throws(()=>perform({...approved,cnhNumero:''}),/Para habilitar/);
 assert.throws(()=>perform({...approved,cnhValidade:'2020-01-01'}),/CNH vencida/);
});
test('motorista só é habilitado por administrador',()=>{
 assert.throws(()=>perform(approved,{...admin,perfil:'VENDEDOR_INTERNO'}),/Somente Master ou Administrador/);
});
test('conferência completa habilita pessoa, sem criar vínculo fictício de veículo',()=>{
 const out=perform(approved);
 const m=out.state.motoristas[0];
 assert.equal(m.ativo,true);
 assert.equal(m.documentosConferidos,true);
 assert.equal(m.statusCadastro,'APROVADO');
 assert.equal(m.aprovacaoOperacional.responsavel,'admin-test');
 assert.equal(m.placa1,undefined);
 assert.equal(out.state.motoristas.length,1);
 assert.throws(()=>validDriver(out.state,'drv-1',1000,true),/veículo vinculado/);
 const linked={motoristaId:'drv-1',placa:'ABC1D23',capacidade_kg:25000,id:'vehicle-1',vinculoId:'link-1'};
 assert.equal(validDriver(out.state,'drv-1',1000,false,linked).placa1,'ABC1D23');
});

test('sincronizar Forte Frete não remove aprovação manual do gestor',()=>{
 const existing=state();
 existing.motoristas[0].origemCadastro='FORTE FRETE';
 const approvedState=applyWorkflow(existing,approved,admin,{id:'approve-event',at}).state;
 const sync=applyWorkflow(approvedState,{
  action:'DRIVERS_IMPORTED',requestId:'sync-1',
  internalDrivers:[{id:'drv-1',nome:'Motorista Teste',origemCadastro:'FORTE FRETE',statusCadastro:'LEGADO',ativo:false}]
 },admin,{id:'sync-event',at:'2026-11-23T19:00:00.000Z'});
 const m=sync.state.motoristas.find(m=>m.id==='drv-1');
 assert.equal(sync.state.motoristas.length,1);
 assert.equal(m.ativo,true);
 assert.equal(m.documentosConferidos,true);
 assert.equal(m.statusCadastro,'APROVADO');
});
