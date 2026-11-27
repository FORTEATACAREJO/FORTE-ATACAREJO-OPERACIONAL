import {test} from 'node:test';
import assert from 'node:assert/strict';
import {purchaseReport,loadReport} from '../apps/web/src/orders-reports.js';
const order={id:'o',numeroPedidoFornecedor:'OFICIAL-987',codigoFornecedor:'CLIENTE-PRIVADO',numero:'COMP-000001',fornecedor:'CSN',unidade:'Forte',origem:'Arcos',destino:'Obra',motorista:'João',motoristaSnapshot:{cpf:'123',cnhNumero:'CNH123',rntrc:'RNTRC1',proprietario:'Transportadora'},placas:['ABC1D23'],modalidadeCompra:'CSN_DIRETO',pagamento:'14 DIAS',modalidadeFrete:'FOB',regraPallets:'Com pallets',palletQuantidade:20,pesoKg:40000,fretePorTon:140,freteValor:5600,itens:[{produto:'Cimento CSN',qtd:800,pesoKg:40000,custoUnitario:22,total:17600}]};
const details={allowDriverPayment:true,payment:{favorecido:'PAGADOR_TESTE',chavePix:'PIX_PRIVADO_TESTE'}};
test('PDF do fornecedor nunca mostra frete contratado nem Pix mesmo com dados privados disponíveis',()=>{const out=purchaseReport(order,false,details).output();assert(!out.includes('PIX_PRIVADO_TESTE'));assert(!out.includes('PAGADOR_TESTE'));assert(!out.includes('Total do frete'));assert(out.includes('RNTRC1'));assert(out.includes('CSN_DIRETO'));});
test('ordem do motorista preserva pedido oficial e nunca inclui dados financeiros, mesmo gerada pelo Master',()=>{for(const allowDriverPayment of [true,false]){const out=purchaseReport(order,true,{...details,allowDriverPayment}).output();for(const secret of ['PIX_PRIVADO_TESTE','PAGADOR_TESTE','Total do frete','Total da compra','CLIENTE-PRIVADO','14 DIAS'])assert(!out.includes(secret),secret);assert(out.includes('OFICIAL-987'));assert(out.includes('ABC1D23'));}assert(purchaseReport(order,false).output().includes('CLIENTE-PRIVADO'));});
test('ordem bloqueia emissão sem pedido devolvido pelo fornecedor',()=>assert.throws(()=>purchaseReport({...order,numeroPedidoFornecedor:''},true),/número oficial/));

test('dossiê interno detalha preços históricos, exclui vendas canceladas e não inventa preços',()=>{
 const carga={id:'c',compraFornecedorId:'o',numeroOS:'OS-TESTE',fornecedor:'CIPLAN',modalidadeFrete:'CIF',vendaIds:['s','missing','cancel','other'],itens:[],placas:[]};
 const data={cargas:[carga],comprasFornecedor:[{id:'o',numero:'OS-TESTE',itens:[{produtoId:'p',produto:'ITEM-COMPRA',qtd:10,custoUnitario:12.3456,total:123.46},{produtoId:'m',produto:'ITEM-SEM-CUSTO',qtd:1}]}],vendas:[{id:'s',cargaId:'c',produtoId:'p',produto:'ITEM-VENDA',cliente:'CLIENTE-TESTE',qtd:10,precoUnitario:25.67,totalVenda:256.70,condicaoPagamento:'14 dias'},{id:'missing',cargaId:'c',produtoId:'m',produto:'ITEM-SEM-PRECO',qtd:1},{id:'cancel',cargaId:'c',status:'CANCELADA',produto:'CANCELADO-TESTE',qtd:1,precoUnitario:1},{id:'other',cargaId:'outra',produto:'OUTRA-CARGA-TESTE',qtd:1,precoUnitario:1}]};
 const out=loadReport(data,carga).output();
 for(const expected of ['ITEM-COMPRA','12,3456','123,46','CLIENTE-TESTE','ITEM-VENDA','25,67','256,70','ITEM-SEM-CUSTO','ITEM-SEM-PRECO','Pendente','14 dias'])assert(out.includes(expected),expected);
 for(const excluded of ['CANCELADO-TESTE','OUTRA-CARGA-TESTE'])assert(!out.includes(excluded),excluded);
});
