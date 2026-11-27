import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyWorkflow} from '../supabase/functions/orders-workflow/domain.mjs';
const at='2026-11-27T21:00:00Z',p={perfil:'MASTER',user_id:'m',nome:'Responsavel',ativo:true,status_aprovacao:'APROVADO'};
const command={action:'PEDRO_CLOSE',requestId:'close1',cargaId:'c',conferidoImpresso:true,observacao:'Dossiê conferido'};
function fixture(){return {cargas:[{id:'c',numeroOS:'OS-1',numeroPedidoFornecedor:'1234',ordemMotoristaEnviada:true,destinoTipo:'VENDA DIRETA',modalidadeFrete:'CIF',nfPalletsAplica:false,regraPallets:'Sem pallets',vendaIds:['v'],itens:[{produtoId:'p',qtd:100}],status:'VERMELHO'}],vendas:[{id:'v',cargaId:'c',clienteId:'cli',produtoId:'p',qtd:100,formaPagamento:'PIX',status:'APROVADA'}],documentos:['XML NF','PDF NF','BOLETO FORNECEDOR','COMPROVANTE ENTREGA'].map(categoria=>({cargaId:'c',categoria,validationStatus:'VALIDADO'}))};}
test('confirmação manual fecha somente após validações e registra responsável, data e observação',()=>{
 const s=fixture();const out=applyWorkflow(s,command,p,{id:'event',at});const c=out.state.cargas[0];
 assert.equal(c.fase,'FINALIZADA');assert.equal(c.finalizadaEm,at);assert.equal(c.finalizadaPorId,'m');assert.equal(c.fechamentoPedro.conferidoImpresso,true);assert.equal(c.fechamentoPedro.observacao,'Dossiê conferido');assert.equal(s.cargas[0].finalizadaEm,undefined);
 assert.equal(applyWorkflow(out.state,command,p,{id:'retry',at}).replayed,true);
});
test('sem confirmação, sem permissão ou com documentos pendentes não fecha',()=>{
 const s=fixture();assert.throws(()=>applyWorkflow(s,{...command,conferidoImpresso:false},p,{id:'event',at}),/confirmação/);
 assert.throws(()=>applyWorkflow(s,command,{...p,perfil:'ADMINISTRADOR'},{id:'event',at}),/MASTER/);
 s.documentos=s.documentos.filter(d=>d.categoria!=='COMPROVANTE ENTREGA');
 assert.throws(()=>applyWorkflow(s,command,p,{id:'event',at}),/entrega pendente/i);assert.equal(s.cargas[0].finalizadaEm,undefined);
});
