// Documento de carregamento do motorista, sem dados comerciais ou financeiros.
// A ordem é emitida a partir do snapshot conferido da carga.
const palette={navy:[25,48,67],red:[174,18,54],slate:[78,96,111],pale:[244,246,248],line:[219,225,231],amber:[255,243,229],brown:[139,76,11],white:[255,255,255]};
const val=(x,fallback='A conferir')=>String(x??'').trim()||fallback;
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const kg=n=>fmt(n)+' kg';
const fmtDate=date=>{
 if(!date)return new Date().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const x=new Date(date);return Number.isNaN(x.getTime())?'A conferir':x.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
};
const array=x=>Array.isArray(x)?x:[];
const textWidth=(doc,str,width)=>doc.splitTextToSize(val(str),width);
const titleCase=x=>val(x);
export function driverLoadingOrderDocument(jsPDF,order){
 const official=String(order?.numeroPedidoFornecedor||'').trim();
 if(!official)throw new Error('Confirme o número oficial do pedido do fornecedor antes de gerar a ordem.');
 const doc=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'});
 const maxX=198,margin=12,cols={item:16,product:28,qty:133,weight:160};
 const items=array(order.itens);
 const paymentWords=/R\$|PIX|BOLETO|FRETE COMBINADO|CONDIÇÃO DE PAGAMENTO|VALOR UNITÁRIO|CUSTO UNITÁRIO/i;
 const paint=(color)=>doc.setFillColor(...color);
 const rect=(x,y,w,h,color,r=0)=>{paint(color);if(r)doc.roundedRect(x,y,w,h,r,r,'F');else doc.rect(x,y,w,h,'F');};
 const text=(value,x,y,{size=8.8,bold=false,color=palette.navy,width=180,align='left',maxLines}={})=>{
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);
  const lines=textWidth(doc,value,width);
  doc.text(maxLines?lines.slice(0,maxLines):lines,x,y,{align});
  return (maxLines?Math.min(lines.length,maxLines):lines.length);
 };
 const stripe=(y,label)=>{
  rect(margin,y,186,8.3,palette.pale,1.2);
  text(label.toUpperCase(),margin+4,y+5.6,{size:9,bold:true});
  return y+10.6;
 };
 const header=()=>{
  rect(0,0,210,32,palette.navy);
  rect(12,0,1.2,32,palette.red);
  rect(16,6,18,18,palette.red,2);
  text('F',25,19,{size:23,bold:true,color:palette.white,align:'center'});
  text('FORTE ATACAREJO',39,14,{size:16.7,bold:true,color:palette.white});
  text('ORDEM DE CARREGAMENTO • MOTORISTA',39,23,{size:9.5,bold:true,color:[238,244,248]});
 };
 const sectionLine=(label,value,x,y,width=82)=>{
  text(label,x,y,{size:7.4,color:palette.slate,width});
  text(value,x,y+6,{size:9,bold:true,width,maxLines:2});
 };
 const transport=order.motoristaSnapshot||{};
 const plates=array(order.placas).filter(Boolean);
 const supplier=val(order.fornecedor);
 const os=val(order.numeroOS||order.numero,'Não vinculada');
 const pickup=val(order.localCarregamento||order.origem);
 const destination=val(order.destino);
 const totalQty=items.reduce((sum,item)=>sum+Number(item.qtd||0),0);
 const totalWeight=Number(order.pesoKg)||items.reduce((sum,item)=>sum+Number(item.pesoKg||0),0);
 header();
 rect(margin,36,186,9,palette.amber,1.5);
 text(order.ordemRevisadaEm?'ORDEM CONFERIDA • ENVIO SUJEITO À VALIDAÇÃO':'PRÉVIA • CONFERIR A ORDEM ANTES DO ENVIO',margin+4,42,{size:8,bold:true,color:palette.brown});
 text('PEDIDO OFICIAL DA INDÚSTRIA',margin,53,{size:8,bold:true,color:palette.slate});
 text(official,margin,62,{size:14.7,bold:true,width:116,maxLines:2});
 text('NOSSA OS',198,53,{size:8,bold:true,color:palette.slate,align:'right'});
 text(os,198,62,{size:11.3,bold:true,width:70,align:'right'});
 text('Código da carga: '+val(order.codigo||order.codigoCarga,'—'),margin,71,{size:8,color:palette.slate});
 text('Emissão: '+fmtDate(order.criadaEm||order.createdAt),198,71,{size:8,color:palette.slate,align:'right'});
 doc.setDrawColor(...palette.line);doc.line(margin,75,maxX,75);
 let y=stripe(79,'Fornecedor e local de retirada');
 sectionLine('FORNECEDOR',supplier,16,y+2,178);
 sectionLine('RETIRAR EM',pickup,16,y+20,178);
 y+=39;
 y=stripe(y,'Motorista e veículo');
 sectionLine('MOTORISTA',order.motorista,16,y+1,101);
 sectionLine('PLACA DO VEÍCULO',plates.join(' / '),120,y+1,74);
 sectionLine('CPF',transport.cpf,16,y+16,83);
 sectionLine('CNH',transport.cnhNumero||transport.cnh,104,y+16,91);
 sectionLine('TRANSPORTADORA',order.transportadoraNome||transport.transportadoraNome||'Não informada',16,y+31,169);
 y+=49;
 y=stripe(y,'Produtos autorizados para retirada');
 const tableHeader=at=>{
  rect(margin,at,186,8,palette.navy,1);
  text('ITEM',cols.item,at+5.5,{size:7.3,bold:true,color:palette.white});
  text('DESCRIÇÃO / EMBALAGEM',cols.product,at+5.5,{size:7.3,bold:true,color:palette.white});
  text('QTDE.',cols.qty,at+5.5,{size:7.3,bold:true,color:palette.white});
  text('PESO',194,at+5.5,{size:7.3,bold:true,color:palette.white,align:'right'});
  return at+8.5;
 };
 y=tableHeader(y);
 for(let i=0;i<items.length;i++){
  const item=items[i];
  const description=val(item.produto||item.descricao);
  const lines=textWidth(doc,description,99);
  const h=Math.max(12,lines.length*4.5+4.8);
  if(y+h+47>276){
   doc.addPage();header();y=tableHeader(stripe(40,'Produtos — continuação'));
  }
  if(i%2===0)rect(margin,y,186,h,palette.pale);
  text(String(i+1).padStart(2,'0'),cols.item,y+5.9,{size:8.4,bold:true,width:12});
  text(description,cols.product,y+5.9,{size:8.2,bold:true,width:99});
  text(fmt(item.qtd||0),cols.qty,y+5.9,{size:8.5,bold:true,width:24});
  text(kg(item.pesoKg||0),194,y+5.9,{size:8.4,width:35,align:'right'});
  y+=h;
 }
 if(y+53>276){doc.addPage();header();y=stripe(41,'Resumo da carga');}
 rect(margin,y+2,186,11,[233,239,244],1.5);
 text('TOTAL DA CARGA',margin+4,y+9.2,{size:8.9,bold:true});
 text(fmt(totalQty)+' unidades',130,y+9.2,{size:8.7,bold:true,width:42});
 text(kg(totalWeight),195,y+9.2,{size:8.7,bold:true,width:34,align:'right'});
 y+=17;
 y=stripe(y,'Condições de carregamento e destino');
 sectionLine('PALETES',val(order.regraPallets)+' • '+fmt(order.palletQuantidade||0)+' un.',16,y+2,82);
 sectionLine('DESTINO DA CARGA',destination,106,y+2,89);
 y+=24;
 if(order.justificativaPallets&&y+14<280){
  text('Observação sobre paletes: '+order.justificativaPallets,margin+3,y,{size:7.7,width:178});
  y+=9;
 }
 if(y+19<281){
  doc.setDrawColor(...palette.line);doc.line(margin,y,maxX,y);
  text('Na retirada, confira pedido oficial, descrição, quantidade, peso e documentos fiscais.',margin+3,y+6,{size:7.9,width:177});
  text('Em caso de divergência, contate a Forte Atacarejo antes de carregar.',margin+3,y+12,{size:7.9,bold:true,width:178});
 }
 const pages=doc.getNumberOfPages();
 for(let n=1;n<=pages;n++){
  doc.setPage(n);doc.setDrawColor(...palette.line);doc.line(margin,283,maxX,283);
  text('FORTE ATACAREJO • PEDIDOS FT • ORDEM AO MOTORISTA',margin,289,{size:7,bold:true});
  text(n+' / '+pages,maxX,289,{size:7,align:'right',color:palette.slate});
 }
 // O PDF não recebe nem exibe campos financeiros, mesmo quando presentes na carga.
 return doc;
}
