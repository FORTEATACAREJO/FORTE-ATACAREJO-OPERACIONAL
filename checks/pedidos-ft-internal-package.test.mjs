import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {internalCover,internalPackageSelection,assembleInternalPDF} from '../apps/web/src/pedidos-ft-internal-package.mjs';
const doc=(id,categoria,extra={})=>({id,categoria,filename:id+'.pdf',storagePath:'tenant/'+id,storageBucket:'private',cargaId:'c',validationStatus:'RECEBIDO',...extra});
const fixture=()=>({carga:{id:'c',numeroOS:'OS-TESTE',fornecedor:'FORNECEDOR-TESTE'},reconciliation:{status:'CONCILIADA'},clients:[{id:'a',nome:'CLIENTE-TESTE',items:[{id:'s'}],salesGroups:[{id:'g',numero:'VEN-1'}]}],sales:[{id:'s',grupoPedidoId:'g',clienteId:'a',produto:'ITEM-VENDA',qtd:2,precoUnitario:28.75,totalVenda:57.5}],items:[{produto:'ITEM-CUSTO',qtd:2,custoUnitario:13.4567,total:26.91}],finance:{custoFornecedor:26.91,receitaVendas:57.5,freteDescontado:0,resultadoAposFrete:30.59},documents:[doc('nf','PDF NF'),doc('xml','XML NF',{filename:'nf.xml'}),doc('boleto','BOLETO CLIENTE',{clienteId:'a',vendaId:'g'}),doc('outro','BOLETO CLIENTE',{clienteId:'b',vendaId:'g'}),doc('solto','BOLETO CLIENTE'),doc('outra-os','PDF NF',{cargaId:'x'}),doc('frete','COMPROVANTE FRETE')]});
test('capas são internas e Juliana recebe preços de venda sem resumo de custo',()=>{
 const d=fixture(),juliana=internalCover(d,'JULIANA').output(),pedro=internalCover(d,'PEDRO').output();
 for(const v of ['CLIENTE-TESTE','28,75','57,50'])assert(juliana.includes(v),v);
 assert(!juliana.includes('ITEM-CUSTO'));assert(!juliana.includes('13,4567'));assert(pedro.includes('13,4567'));
 assert.deepEqual(internalPackageSelection(d,'JULIANA').map(x=>x.id),['nf','xml','boleto']);
 assert.deepEqual(internalPackageSelection(d,'PEDRO').map(x=>x.id),['nf','xml','boleto','frete']);
 assert.throws(()=>internalPackageSelection(d,'CLIENTE'),/interno/);
});
test('incorpora páginas originais e falha sem produzir pacote quando falta um PDF',async()=>{
 const d=fixture(),original=await PDFDocument.create();original.addPage();const bytes=await original.save(),read=[];
 const result=await assembleInternalPDF(d,'JULIANA',async x=>{read.push(x.id);return bytes;});
 const combined=await PDFDocument.load(result);assert.equal(combined.getPageCount(),internalCover(d,'JULIANA').getNumberOfPages()+2);assert.deepEqual(read,['nf','boleto']);
 await assert.rejects(assembleInternalPDF(d,'JULIANA',async x=>{if(x.id==='boleto')throw Error('indisponível');return bytes;}),/boleto.pdf/);
});
