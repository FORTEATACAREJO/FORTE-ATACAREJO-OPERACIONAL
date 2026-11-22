import test from 'node:test';
import assert from 'node:assert/strict';
import {financialSummary} from '../apps/web/src/pedidos-ft-finance.mjs';
import {buildPedidosFTDossier} from '../apps/web/src/pedidos-ft-model.mjs';

const cip=()=>({
 order:{id:'compra1',custoTotal:23365,itens:[{produtoId:'cp2',qtd:760,custoUnitario:29},{produtoId:'forte',qtd:50,custoUnitario:26.50}]},
 sales:[
  {id:'s1',cargaId:'c1',produtoId:'cp2',qtd:400,precoUnitario:32,totalVenda:12800},
  {id:'s2',cargaId:'c1',produtoId:'cp2',qtd:200,precoUnitario:31,totalVenda:6200},
  {id:'s3',cargaId:'c1',produtoId:'cp2',qtd:120,precoUnitario:33,totalVenda:3960},
  {id:'s4',cargaId:'c1',produtoId:'cp2',qtd:40,precoUnitario:34,totalVenda:1360},
  {id:'s5',cargaId:'c1',produtoId:'forte',qtd:50,precoUnitario:30,totalVenda:1500}
 ]
});

test('CIPLAN CIF: sem abatimento adicional de frete já incluído no preço',()=>{
 const {order,sales}=cip();
 const f=financialSummary({carga:{modalidadeFrete:'CIF',freteValor:2000},order,sales});
 assert.deepEqual([f.receitaVendas,f.custoFornecedor,f.diferencaAntesFrete,f.freteDescontado,f.resultadoAposFrete],[25820,23365,2455,0,2455]);
 assert.equal(f.statusFrete,'INCLUSO_NO_PRECO');
});

test('CIPLAN FOB: frete registrado é abatido uma única vez',()=>{
 const {order,sales}=cip();
 const f=financialSummary({carga:{modalidadeFrete:'FOB',freteValor:1800,freteRegistradoEm:'2026-11-23T11:00:00Z'},order,sales});
 assert.equal(f.diferencaAntesFrete,2455);
 assert.equal(f.freteDescontado,1800);
 assert.equal(f.resultadoAposFrete,655);
 assert.equal(f.statusFrete,'REGISTRADO');
});

test('FOB sem valor registrado não inventa lucro nem frete zero',()=>{
 const {order,sales}=cip();
 for(const carga of [{modalidadeFrete:'FOB'},{modalidadeFrete:'FOB',freteValor:0},{modalidadeFrete:'FOB',freteValor:-5}]){
  const f=financialSummary({carga,order,sales});
  assert.equal(f.resultadoAposFrete,null);
  assert.equal(f.freteDescontado,null);
  assert.equal(f.statusFrete,'FRETE_PENDENTE');
 }
 const zero=financialSummary({carga:{modalidadeFrete:'FOB',freteValor:0,freteRegistradoEm:'2026-11-23T11:00:00Z'},order,sales});
 assert.equal(zero.resultadoAposFrete,2455);
});

test('vendas sem valor, modalidade desconhecida e carga sem vendas permanecem pendentes',()=>{
 const {order,sales}=cip();
 assert.equal(financialSummary({carga:{modalidadeFrete:'FOB',freteValor:1000},order,sales:[{qtd:1}]}).resultadoAposFrete,null);
 assert.equal(financialSummary({carga:{modalidadeFrete:'A DEFINIR'},order,sales}).resultadoAposFrete,null);
 assert.equal(financialSummary({carga:{modalidadeFrete:'CIF'},order,sales:[]}).resultadoAposFrete,null);
});

test('dossiês do mesmo fornecedor não misturam fretes ou resultados financeiros',()=>{
 const {order,sales}=cip();
 const data={
  cargas:[{id:'c1',compraFornecedorId:'compra1',modalidadeFrete:'FOB',freteValor:1500,freteRegistradoEm:'2026-11-23'},
          {id:'c2',compraFornecedorId:'compra2',modalidadeFrete:'CIF'}],
  comprasFornecedor:[order,{id:'compra2',custoTotal:1000,itens:[{produtoId:'cp2',qtd:10,custoUnitario:100}]}],
  vendas:[...sales,{id:'s6',cargaId:'c2',produtoId:'cp2',qtd:10,precoUnitario:115,totalVenda:1150}]
 };
 const one=buildPedidosFTDossier(data,'c1'),two=buildPedidosFTDossier(data,'c2');
 assert.equal(one.finance.resultadoAposFrete,955);
 assert.equal(two.finance.resultadoAposFrete,150);
 assert.equal(one.finance.freteDescontado,1500);
 assert.equal(two.finance.freteDescontado,0);
});
