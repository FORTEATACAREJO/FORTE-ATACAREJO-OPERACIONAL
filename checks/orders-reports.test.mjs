import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadReport,purchaseReport} from '../apps/web/src/orders-reports.js';
const order={id:'o',numeroPedidoFornecedor:'OFICIAL-987',codigoFornecedor:'CLIENTE-PRIVADO',numero:'COMP-000001',fornecedor:'CSN',unidade:'Forte',origem:'Arcos',destino:'Obra',motorista:'João',motoristaSnapshot:{cpf:'123',cnhNumero:'CNH123',rntrc:'RNTRC1',proprietario:'Transportadora'},placas:['ABC1D23'],modalidadeCompra:'CSN_DIRETO',pagamento:'14 DIAS',modalidadeFrete:'FOB',regraPallets:'Com pallets',palletQuantidade:20,pesoKg:40000,fretePorTon:140,freteValor:5600,itens:[{produto:'Cimento CSN',qtd:800,pesoKg:40000,custoUnitario:22,total:17600}]};
const details={allowDriverPayment:true,payment:{favorecido:'PAGADOR_TESTE',chavePix:'PIX_PRIVADO_TESTE'}};
test('PDF do fornecedor nunca mostra frete contratado nem Pix mesmo com dados privados disponíveis',()=>{const out=purchaseReport(order,false,details).output();assert(!out.includes('PIX_PRIVADO_TESTE'));assert(!out.includes('PAGADOR_TESTE'));assert(!out.includes('Total do frete'));assert(out.includes('RNTRC1'));assert(out.includes('CSN_DIRETO'));});
test('ordem do motorista preserva pedido oficial e nunca inclui dados financeiros, mesmo gerada pelo Master',()=>{for(const allowDriverPayment of [true,false]){const out=purchaseReport(order,true,{...details,allowDriverPayment}).output();for(const secret of ['PIX_PRIVADO_TESTE','PAGADOR_TESTE','Total do frete','Total da compra','CLIENTE-PRIVADO','14 DIAS'])assert(!out.includes(secret),secret);assert(out.includes('OFICIAL-987'));assert(out.includes('ABC1D23'));}assert(purchaseReport(order,false).output().includes('CLIENTE-PRIVADO'));});
test('ordem bloqueia emissão sem pedido devolvido pelo fornecedor',()=>assert.throws(()=>purchaseReport({...order,numeroPedidoFornecedor:''},true),/número oficial/));

test('dossiê imprime pedido oficial, produtos separados e apenas dados vinculados à carga',()=>{
 const carga={id:'c',codigo:'FC-000001',compraFornecedorId:'o',modalidadeFrete:'CIF',vendaIds:['v1','v2','v3']};
 const data={
  cargas:[carga],
  comprasFornecedor:[{...order,cargaId:'c'}],
  clientes:[{id:'cliente',nome:'Cliente teste'}],
  vendas:[
   {id:'v1',cargaId:'c',clienteId:'cliente',produtoId:'p1',produto:'Cimento de teste',qtd:1},
   {id:'v2',cargaId:'c',clienteId:'cliente',produtoId:'p2',produto:'Argamassa de teste',qtd:2},
   {id:'v3',cargaId:'outra',clienteId:'cliente',produtoId:'p3',produto:'VENDA DE OUTRA CARGA',qtd:1}
  ],
  documentos:[
   {cargaId:'c',compraFornecedorId:'o',categoria:'PDF NF',filename:'incluir.pdf'},
   {cargaId:'c',compraFornecedorId:'outro',categoria:'PDF NF',filename:'nao-incluir.pdf'}
  ]
 };
 const output=loadReport(data,carga).output();
 assert.match(output,/PEDIDO OFICIAL DO FORNECEDOR/);
 assert.match(output,/OFICIAL-987/);
 assert.match(output,/Cimento de teste/);
 assert.match(output,/Argamassa de teste/);
 assert.match(output,/incluir\.pdf/);
 assert.doesNotMatch(output,/nao-incluir\.pdf|VENDA DE OUTRA CARGA/);
});
