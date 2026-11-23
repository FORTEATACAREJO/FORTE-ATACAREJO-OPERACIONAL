import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jsPDF} from '../apps/web/node_modules/jspdf/dist/jspdf.es.min.js';
import {purchaseDocument} from '../supabase/functions/order-communications/order-document.mjs';

const purchase=()=>({
 id:'pedido-1',numero:'OS-000001',status:'RASCUNHO — NÃO ENVIADO',
 criadaEm:'2026-11-23T20:00:00-03:00',fornecedor:'CIPLAN CIMENTO PLANALTO S.A.',
 unidade:'Filial Caldas Novas / GO',cnpjComprador:'49.832.961/0002-32',
 codigoFornecedor:'242489',fornecedorSnapshot:{
  razaoSocial:'CIPLAN CIMENTO PLANALTO S.A.',cnpj:'00.057.240/0001-22',
  inscricaoEstadual:'0732872500112',telefone:'6134879002'
 },
 itens:[
  {produto:'CIMENTO CIPLAN CP II-Z-32 50 KG',qtd:760,pesoKg:38000,custoUnitario:30,total:22800},
  {produto:'CIMENTO CIPLAN EXTRA FORTE 40 KG',qtd:50,pesoKg:2000,custoUnitario:28,total:1400}
 ],pesoKg:40000,pagamento:'14 dias',modalidadeFrete:'CIF',regraPallets:'Sem pallets',
 destino:'Caldas Novas / GO',origem:'Sobradinho / DF',placas:[],motorista:'',
 numeroPedidoFornecedor:'',dataCarregamento:'2026-11-28'
});

test('modelo aprovado: PDF A4 de uma página com OS, comprador, fornecedor, itens, valores e confirmação',()=>{
 const pdf=purchaseDocument(jsPDF,purchase(),false);
 const raw=pdf.output();
 assert.equal(pdf.getNumberOfPages(),1);
 assert.match(raw,/PEDIDO DE COMPRA AO FORNECEDOR/);
 assert.match(raw,/OS-000001/);
 assert.match(raw,/CIPLAN CIMENTO PLANALTO/);
 assert.match(raw,/49\.832\.961\/0002-32/);
 assert.match(raw,/00\.057\.240\/0001-22/);
 assert.match(raw,/242489/);
 assert.match(raw,/760/);
 assert.match(raw,/50 KG/);
 assert.match(raw,/TOTAL DOS PRODUTOS/);
 assert.match(raw,/CONFIRMA.C.O DO FORNECEDOR|CONFIRMA/);
 assert.match(raw,/14 dias/);
 assert.match(raw,/CIF/);
 assert.doesNotMatch(raw,/Data de carregamento|Data prevista para carregamento|28\/11\/2026/);
});
test('preços ausentes não são inventados e não geram zero financeiro',()=>{
 const order=purchase();
 delete order.itens[0].custoUnitario;delete order.itens[0].total;
 const raw=purchaseDocument(jsPDF,order,false).output();
 assert.match(raw,/CONFERIR PRE.OS ANTES DE ENVIAR/);
 assert.match(raw,/R\$ a confirmar/);
});
test('número do pedido da indústria permanece separado da OS interna',()=>{
 const order=purchase();order.numeroPedidoFornecedor='INDUSTRIA-7788';
 const raw=purchaseDocument(jsPDF,order,false).output();
 assert.match(raw,/OS-000001/);
 assert.match(raw,/INDUSTRIA-7788/);
});
test('pedidos maiores são paginados sem descartar produtos',()=>{
 const order=purchase();
 order.itens=Array.from({length:14},(_,i)=>({
  produto:'CIMENTO CIPLAN LOTE '+String(i+1).padStart(2,'0')+' 50 KG',
  qtd:40,pesoKg:2000,custoUnitario:27,total:1080
 }));
 order.pesoKg=28000;
 const pdf=purchaseDocument(jsPDF,order,false);
 assert(pdf.getNumberOfPages()>1);
 const raw=pdf.output();
 for(let n=1;n<=14;n++)assert(raw.includes('LOTE '+String(n).padStart(2,'0')));
});
test('ordem de carregamento permanece documento separado, exigindo pedido oficial',()=>{
 const order=purchase();
 assert.throws(()=>purchaseDocument(jsPDF,order,true),/número oficial/);
 order.numeroPedidoFornecedor='INDUSTRIA-7788';
 const raw=purchaseDocument(jsPDF,order,true).output();
 assert.match(raw,/ORDEM DE CARREGAMENTO/);
 assert.match(raw,/INDUSTRIA-7788/);
 assert.doesNotMatch(raw,/PEDIDO DE COMPRA AO FORNECEDOR/);
});
