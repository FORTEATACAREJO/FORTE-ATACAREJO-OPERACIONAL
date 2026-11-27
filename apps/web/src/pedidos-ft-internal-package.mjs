import {PDFDocument} from 'pdf-lib';
import {buildPedidosFTDossier} from './pedidos-ft-model.mjs';
import {reportPDF} from './orders-reports.js';

const fmt=n=>n===null||n===undefined||n===''||!Number.isFinite(Number(n))?'Pendente':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:4});
const supplierCategories=new Set(['PDF NF','XML NF','BOLETO FORNECEDOR','NF PALLETS']);
const clientCategories=new Set(['BOLETO CLIENTE','COMPROVANTE PAGAMENTO CLIENTE','RECIBO A RECEBER','NF VENDA PDF','NF VENDA XML','ANEXO DA VENDA']);
const activeClient=(d,doc)=>d.clients.some(c=>(!doc.clienteId||String(doc.clienteId)===String(c.id))&&(!doc.vendaId||c.items.some(i=>i.id===doc.vendaId)||c.salesGroups.some(g=>g.id===doc.vendaId))&&(doc.clienteId||doc.vendaId));
export function internalPackageSelection(d,role){
 if(!d||!['JULIANA','PEDRO'].includes(role))throw Error('Dossiê interno indisponível.');
 return d.documents.filter(doc=>{
  if(doc.cargaId&&doc.cargaId!==d.carga.id)return false;
  if(doc.clienteId||doc.vendaId)return activeClient(d,doc)&&(role==='PEDRO'||clientCategories.has(doc.categoria)||['PDF NF','XML NF'].includes(doc.categoria));
  if(clientCategories.has(doc.categoria))return false;
  return role==='PEDRO'||supplierCategories.has(doc.categoria);
 });
}
export function internalCover(d,role,docs=internalPackageSelection(d,role)){
 const os=d.order?.numero||d.carga.numeroOS||'OS não vinculada';
 const groups=d.clients.flatMap(c=>c.salesGroups.map(g=>({title:c.nome+' • '+g.numero,rows:d.sales.filter(v=>(v.grupoPedidoId||v.id)===g.id&&String(v.clienteId||v.cliente||v.id)===String(c.id)).map(v=>v.produto+' • '+v.qtd+' un. • Venda unitária: '+fmt(v.precoUnitario)+' • Total: '+fmt(v.totalVenda??(v.precoUnitario!=null&&v.precoUnitario!==''&&v.qtd!=null?Math.round(Number(v.precoUnitario)*Number(v.qtd)*100)/100:null))+' • Pagamento: '+(v.condicaoPagamento||v.formaPagamento||'Pendente')+(v.ordemCompraCliente?' • OC: '+v.ordemCompraCliente:''))})));
 const sections=[{title:'Identificação — uso interno',rows:['OS: '+os,'Fornecedor: '+(d.carga.fornecedor||'Pendente'),'Pedido oficial: '+(d.carga.numeroPedidoFornecedor||'Pendente'),'Motorista: '+(d.carga.motorista||'Pendente'),'Destino: '+(d.carga.destino||'Pendente'),'Distribuição: '+d.reconciliation.status]},...groups];
 if(role==='PEDRO')sections.push({title:'Compra e resultado — uso interno',rows:[...d.items.map(i=>i.produto+' • '+i.qtd+' un. • Custo unitário: '+fmt(i.custoUnitario)+' • Total: '+fmt(i.total??(i.custoUnitario!=null&&i.qtd!=null?Math.round(Number(i.custoUnitario)*Number(i.qtd)*100)/100:null))),'Total compra: '+fmt(d.finance.custoFornecedor),'Total vendas: '+fmt(d.finance.receitaVendas),'Frete descontado: '+fmt(d.finance.freteDescontado),'Resultado comercial após frete: '+fmt(d.finance.resultadoAposFrete)]});
 sections.push({title:'Índice dos documentos vinculados',rows:docs.length?docs.map(x=>x.categoria+' • '+(x.filename||'Sem nome')+' • '+(x.validationStatus||'Pendente')+(/\.xml$/i.test(x.filename||'')?' • XML original disponível separadamente para download':'')).concat(['Prévia de conferência: a impressão não valida documentos nem encerra a OS.']):['Nenhum documento vinculado.']});
 return reportPDF('DOSSIÊ INTERNO '+role+' • '+os,sections);
}
export async function assembleInternalPDF(d,role,readDocument){
 const docs=internalPackageSelection(d,role);
 const pdf=await PDFDocument.load(internalCover(d,role,docs).output('arraybuffer'));
 let size=0;
 for(const doc of docs){
  if(/\.xml$/i.test(doc.filename||''))continue;
  if(!/\.pdf$/i.test(doc.filename||''))throw Error('Formato não imprimível no pacote: '+(doc.filename||'sem nome')+'. Confira o original.');
  if(!doc.storagePath||!doc.storageBucket)throw Error('Documento sem arquivo disponível: '+doc.filename);
  try{
   const bytes=await readDocument(doc);size+=bytes.byteLength;
   if(size>80*1024*1024)throw Error('Limite do pacote excedido.');
   const original=await PDFDocument.load(bytes);
   for(const page of await pdf.copyPages(original,original.getPageIndices()))pdf.addPage(page);
  }catch(e){throw Error('Não foi possível incorporar '+doc.filename+': '+e.message);}
 }
 return pdf.save();
}
export function downloadInternalPDF(bytes,filename){
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
