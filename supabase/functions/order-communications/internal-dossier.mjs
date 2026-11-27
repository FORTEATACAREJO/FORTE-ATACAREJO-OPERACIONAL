// Internal-only recipient, never accepted from the caller or from a sale.
const categories=new Set(['PDF NF','XML NF','BOLETO FORNECEDOR','NF PALLETS','BOLETO CLIENTE','ANEXO DA VENDA','COMPROVANTE PAGAMENTO CLIENTE']);
const clientCategories=new Set(['BOLETO CLIENTE','ANEXO DA VENDA','COMPROVANTE PAGAMENTO CLIENTE']);
export function internalRecipient(env,role){
 if(!['PEDRO','JULIANA'].includes(role))throw Error('Destinatário interno inválido.');
 const to=String(env('PEDIDOS_FT_'+role+'_WHATSAPP')||'').replace(/\D/g,'');
 if(!/^55\d{11}$/.test(to))throw Error('WhatsApp interno de '+role+' não configurado no servidor.');
 return to;
}
export function internalSnapshot(state,id,role){
 const c=(state.cargas||[]).find(x=>x.id===id);
 if(!c||/CANCELAD/i.test(c.status||''))throw Error('OS indisponível.');
 const order=(state.comprasFornecedor||[]).find(o=>o.id===c.compraFornecedorId||o.cargaId===c.id);
 const sales=(state.vendas||[]).filter(v=>! /CANCELAD/i.test(v.status||'')&&(v.cargaId===id||!v.cargaId&&(c.vendaIds||[]).includes(v.id)));
 const docs=(state.documentos||[]).filter(doc=>{
  if(doc.cargaId?doc.cargaId!==id||doc.compraFornecedorId&&doc.compraFornecedorId!==order?.id:!order||doc.compraFornecedorId!==order.id)return false;
  if(doc.clienteId||doc.vendaId)return sales.some(v=>(!doc.clienteId||v.clienteId===doc.clienteId)&&(!doc.vendaId||v.id===doc.vendaId||v.grupoPedidoId===doc.vendaId))&&(role==='PEDRO'||categories.has(doc.categoria));
  return !clientCategories.has(doc.categoria)&&(role==='PEDRO'||categories.has(doc.categoria));
 });
 return {c,order,sales,docs,os:order?.numero||c.numeroOS||''};
}
const fmt=n=>n==null||n===''||!Number.isFinite(Number(n))?'Pendente':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:4});
const total=(v,p,t)=>v[t]??(v[p]!=null&&v[p]!==''&&v.qtd!=null?Math.round(Number(v[p])*Number(v.qtd)*100)/100:null);
export async function buildInternalDocument(snapshot,role,jsPDF,PDFDocument,read){
 const {c,order,sales,docs,os}=snapshot;if(!os)throw Error('OS não vinculada.');
 const cover=new jsPDF();let y=18;
 function line(value,bold=false){cover.setFont('helvetica',bold?'bold':'normal');cover.setFontSize(bold?12:9);for(const t of cover.splitTextToSize(String(value),180)){if(y>277){cover.addPage();y=18;}cover.text(t,15,y);y+=5.5;}y+=2;}
 line('FORTE ATACAREJO — DOSSIÊ INTERNO '+role,true);line(os+' • Pedido oficial: '+(c.numeroPedidoFornecedor||'Pendente'));line('Fornecedor: '+(c.fornecedor||'Pendente'));line('Motorista: '+(c.motorista||'Pendente'));line('Destino: '+(c.destino||'Pendente'));
 line('Vendas por cliente',true);
 for(const v of sales)line((v.cliente||'Cliente pendente')+' • '+(v.numeroVenda||'Venda')+' • '+v.produto+' • Qtd '+v.qtd+' • Venda unitária '+fmt(v.precoUnitario)+' • Total '+fmt(total(v,'precoUnitario','totalVenda'))+' • '+(v.condicaoPagamento||v.formaPagamento||'Pagamento pendente'));
 if(role==='PEDRO'){
  line('Compra e resultado — uso interno',true);
  const items=order?.itens?.length?order.itens:c.itensPedido?.length?c.itensPedido:c.itens||[];
  for(const v of items)line(v.produto+' • Qtd '+v.qtd+' • Custo unitário '+fmt(v.custoUnitario)+' • Total '+fmt(total(v,'custoUnitario','total')));
  const sum=a=>a.length&&a.every(x=>x!=null&&x!==''&&Number.isFinite(Number(x)))?a.reduce((n,x)=>n+Number(x),0):null;
  const cost=order?.custoTotal??sum(items.map(v=>total(v,'custoUnitario','total'))),revenue=sum(sales.map(v=>total(v,'precoUnitario','totalVenda')));
  const mode=String(c.modalidadeFrete||order?.modalidadeFrete||'').toUpperCase(),freight=mode==='CIF'?0:mode==='FOB'&&c.freteValor!=null&&(Number(c.freteValor)>0||c.freteRegistradoEm)?Number(c.freteValor):null;
  line('Compra: '+fmt(cost)+' • Vendas: '+fmt(revenue)+' • Frete descontado: '+fmt(freight));line('Resultado comercial após frete: '+fmt(cost==null||revenue==null||freight==null?null:revenue-cost-freight));
 }
 line('Índice dos anexos originais',true);for(const d of docs)line(d.categoria+' • '+d.filename+' • '+(d.validationStatus||'Pendente'));
 line('XMLs originais incorporados como anexos digitais do PDF. Uso interno; não enviar a terceiros.');
 const pdf=await PDFDocument.load(cover.output('arraybuffer'));let size=0;
 for(const d of docs){
  const filename=String(d.filename||'').replace(/[^a-zA-Z0-9._-]/g,'_');
  const bytes=await read(d);size+=bytes.byteLength;if(size>45*1024*1024)throw Error('Pacote excede o limite interno.');
  if(/\.pdf$/i.test(filename)){const original=await PDFDocument.load(bytes);for(const p of await pdf.copyPages(original,original.getPageIndices()))pdf.addPage(p);}
  else if(/\.xml$/i.test(filename))await pdf.attach(bytes,filename,{mimeType:'application/xml'});
  else throw Error('Formato não suportado no pacote: '+filename);
 }
 const result=await pdf.save();if(result.byteLength>45*1024*1024)throw Error('Pacote excede o limite interno.');return result;
}
