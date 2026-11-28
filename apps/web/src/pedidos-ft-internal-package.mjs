import {PDFDocument} from 'pdf-lib';
import {buildPedidosFTDossier} from './pedidos-ft-model.mjs';
import {reportPDF} from './orders-reports.js';

const fmt=n=>n===null||n===undefined||n===''||!Number.isFinite(Number(n))?'Pendente':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:4});
const supplierCategories=new Set(['PDF NF','XML NF','BOLETO FORNECEDOR','NF PALLETS']);
const clientCategories=new Set(['BOLETO CLIENTE','COMPROVANTE PAGAMENTO CLIENTE','RECIBO A RECEBER','NF VENDA PDF','ANEXO DA VENDA']);
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

export const CLIENT_GALLERY_ACCEPT='image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
// The billing pipeline stores PDF only; photos become a single A4 page per file.
export async function billingImagePDF(bytes,kind){
 const pdf=await PDFDocument.create({updateMetadata:false});
 const image=kind==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
 const page=pdf.addPage(image.width>image.height?[841.89,595.28]:[595.28,841.89]);
 const {width,height}=page.getSize(),scale=Math.min((width-36)/image.width,(height-36)/image.height);
 const w=image.width*scale,h=image.height*scale;
 page.drawImage(image,{x:(width-w)/2,y:(height-h)/2,width:w,height:h});
 return pdf.save();
}
export async function galleryBillingFile(file){
 if(!file||!(/\.(jpe?g|png|webp)$/i.test(file.name)||['image/jpeg','image/png','image/webp'].includes(file.type)))throw Error('Escolha uma imagem JPG, PNG ou WebP.');
 if(file.size>20*1024*1024)throw Error('Escolha uma imagem de até 20 MB.');
 let bitmap;
 try{
  bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  const scale=Math.min(1,2600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Conversão indisponível neste aparelho.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Não foi possível preparar a imagem.')),'image/jpeg',0.94));
  const pdf=await billingImagePDF(await blob.arrayBuffer(),'image/jpeg');
  if(pdf.byteLength>10*1024*1024)throw Error('PDF convertido excede 10 MB.');
  return new File([pdf],file.name.replace(/\.[^.]+$/,'')+'-foto.pdf',{type:'application/pdf'});
 }catch(e){throw Error('Não foi possível converter '+file.name+': '+(e.message||'imagem inválida'));}
 finally{bitmap?.close();}
}
