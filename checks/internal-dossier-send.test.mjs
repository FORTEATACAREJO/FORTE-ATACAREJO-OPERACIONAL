import {test} from 'node:test';
import assert from 'node:assert/strict';
import {internalRecipient,internalSnapshot} from '../supabase/functions/order-communications/internal-dossier.mjs';
test('destinatário fixo por papel, sem aceitar telefone informado no pedido',()=>{
 const env=k=>({PEDIDOS_FT_PEDRO_WHATSAPP:'5500000000001',PEDIDOS_FT_JULIANA_WHATSAPP:'5500000000002'})[k];
 assert.equal(internalRecipient(env,'PEDRO'),'5500000000001');
 assert.equal(internalRecipient(env,'JULIANA'),'5500000000002');
 assert.throws(()=>internalRecipient(env,'CLIENTE'),/inválido/);
 assert.throws(()=>internalRecipient(()=>'', 'PEDRO'),/não configurado/);
});
test('seleciona documentos da OS e da venda ativa, não mistura clientes',()=>{
 const s={cargas:[{id:'c',numeroOS:'OS-1',compraFornecedorId:'o',vendaIds:['v']}],comprasFornecedor:[{id:'o'}],vendas:[{id:'v',cargaId:'c',clienteId:'a'},{id:'z',cargaId:'c',clienteId:'b',status:'CANCELADA'}],documentos:[{id:'nf',cargaId:'c',categoria:'PDF NF'},{id:'boleto',cargaId:'c',vendaId:'v',clienteId:'a',categoria:'BOLETO CLIENTE'},{id:'errado',cargaId:'c',vendaId:'v',clienteId:'b',categoria:'BOLETO CLIENTE'},{id:'outro',cargaId:'x',categoria:'PDF NF'},{id:'solto',cargaId:'c',categoria:'BOLETO CLIENTE'},{id:'cancelado',cargaId:'c',vendaId:'z',categoria:'BOLETO CLIENTE'}]};
 assert.deepEqual(internalSnapshot(s,'c','JULIANA').docs.map(d=>d.id),['nf','boleto']);
 assert.deepEqual(internalSnapshot(s,'c','PEDRO').docs.map(d=>d.id),['nf','boleto']);
});

test('recibo a receber e comprovante da venda entram no dossiê; documentos sem venda não entram',()=>{
 const state={cargas:[{id:'c',numeroOS:'OS-1',vendaIds:['v']}],vendas:[{id:'v',cargaId:'c',clienteId:'a'}],documentos:['RECIBO A RECEBER','COMPROVANTE PAGAMENTO CLIENTE','NF VENDA PDF'].flatMap((categoria,i)=>[{id:'ok'+i,cargaId:'c',vendaId:'v',clienteId:'a',categoria},{id:'bad'+i,cargaId:'c',categoria}])};
 for(const role of ['PEDRO','JULIANA'])assert.deepEqual(internalSnapshot(state,'c',role).docs.map(d=>d.id),['ok0','ok1','ok2']);
});
