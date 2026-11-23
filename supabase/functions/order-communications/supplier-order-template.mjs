// Documento padrão do pedido ao fornecedor: modelo A4 aprovado em 23/11/2026.
// Dados vêm do pedido gravado e dos snapshots do fornecedor; nunca são inventados.
const safe=v=>String(v??'').trim();
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number=v=>Number(v||0).toLocaleString('pt-BR');
const weight=v=>number(v)+' kg';
const date=v=>{const d=v?new Date(v):null;return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'A confirmar';};
const missing=(v,text='A confirmar')=>safe(v)||text;
const itemWeight=i=>Number(i.pesoKg)||0;
const itemQty=i=>Number(i.qtd)||0;
const hasPrice=i=>Number.isFinite(Number(i.custoUnitario))&&Number(i.custoUnitario)>0;
const asSacks=s=>/CIMENTO|ARGAMASSA|REJUNTE|CAL\b|SACO|\bKG\b/i.test(safe(s));
const carrierText=o=>[o.motorista,...(Array.isArray(o.placas)?o.placas:[])].filter(Boolean).join(' • ')||'A definir após vinculação';
const stateBadge=o=>/ENVIADO|ENTREGUE|CONFIRMADO/.test(safe(o.status).toUpperCase())?'PEDIDO REGISTRADO • ENVIO CONFERIR':
 /RASCUNHO|PENDENTE|CONFERÊNCIA|CONFERENCIA/.test(safe(o.status).toUpperCase())?'PEDIDO GRAVADO • ENVIO PENDENTE':'PEDIDO DE COMPRA • CONFERIR ANTES DO ENVIO';
const terms=o=>missing(o.pagamento||o.condicaoFornecedor||o.fornecedorSnapshot?.condicaoPagamento);
const mode=o=>missing(o.modalidadeFrete);
const pallets=o=>missing(o.regraPallets);
const supplierInfo=o=>o.fornecedorSnapshot||{};
const buyerUnit=o=>missing(o.unidade);
const buyerCnpj=o=>missing(o.cnpjComprador||supplierInfo(o).cnpjComprador);
const supplierCode=o=>missing(o.codigoFornecedor||supplierInfo(o).codigoCliente||supplierInfo(o).codigoForte);
const supplierName=o=>missing(supplierInfo(o).razaoSocial||o.fornecedor||supplierInfo(o).nome);
const supplierTax=o=>missing(supplierInfo(o).inscricaoEstadual||supplierInfo(o).ie);
const supplierPhone=o=>missing(supplierInfo(o).telefone);
const totalPrice=order=>order.itens.reduce((sum,i)=>sum+(hasPrice(i)?Number(i.total)||itemQty(i)*Number(i.custoUnitario):0),0);
const allPriced=order=>order.itens.length>0&&order.itens.every(hasPrice);
const copy={navy:[25,48,67],red:[174,18,54],slate:[78,96,111],pale:[244,246,248],line:[219,225,231],amber:[255,243,229],brown:[148,80,15]};
export function supplierOrderDocument(jsPDF,order){
 const doc=new jsPDF({format:'a4',unit:'mm',orientation:'portrait'});
 const items=Array.isArray(order?.itens)?order.itens:[];
 const width=210,margin=12,maxX=198;
 const rect=(x,y,w,h,c,r=0)=>{
  doc.setFillColor(...c);r?doc.roundedRect(x,y,w,h,r,r,'F'):doc.rect(x,y,w,h,'F');
 };
 const stroke=(x,y,w,h)=>{doc.setDrawColor(...copy.line);doc.setLineWidth(.35);doc.roundedRect(x,y,w,h,2,2,'S');};
 const txt=(t,x,y,{size=9,bold=false,color=copy.navy,max=180,align='left'}={})=>{
  doc.setTextColor(...color);doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
  const lines=doc.splitTextToSize(missing(t,'—'),max);
  doc.text(lines,x,y,{align});
  return lines.length;
 };
 const header=()=>{
  rect(0,0,width,32,copy.navy);rect(12,0,1.3,32,copy.red);
  rect(16,6,18,18,copy.red,3);txt('F',25,19,{size:23,bold:true,color:[255,255,255],align:'center'});
  txt('FORTE ATACAREJO',39,14,{size:17,bold:true,color:[255,255,255]});
  txt('PEDIDO DE COMPRA AO FORNECEDOR',39,23,{size:9.7,bold:true,color:[236,242,248]});
 };
 const footer=()=>{
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){
   doc.setPage(i);doc.setDrawColor(...copy.line);doc.line(margin,283,maxX,283);
   txt('FORTE ATACAREJO  •  PEDIDOS FT',margin,289,{size:7.4,bold:true});
   txt('Pedido ao fornecedor  •  '+i+'/'+n,maxX,289,{size:7.2,align:'right',color:copy.slate});
  }
 };
 const section=(name,y)=>{
  rect(margin,y,186,8.4,copy.pale,1.5);txt(name.toUpperCase(),margin+4,y+5.6,{size:9.2,bold:true});return y+10.8;
 };
 const field=(label,value,x,y,w=85)=>{
  txt(label,x,y,{size:7.5,color:copy.slate,max:w});
  const lines=doc.splitTextToSize(missing(value),w);
  doc.setFont('helvetica','bold');doc.setFontSize(8.7);doc.setTextColor(...copy.navy);
  doc.text(lines.slice(0,2),x,y+5.7);
 };
 const drawCards=y=>{
  rect(margin,y,91,37,copy.pale,2);stroke(margin,y,91,37);
  rect(107,y,91,37,copy.pale,2);stroke(107,y,91,37);
  txt('COMPRADOR',margin+4,y+6,{size:8.2,bold:true,color:copy.red});
  txt('FORTE ATACAREJO LTDA.',margin+4,y+13,{size:9.2,bold:true,max:81});
  txt(buyerUnit(order),margin+4,y+19,{size:8,max:82});
  txt('CNPJ: '+buyerCnpj(order),margin+4,y+25,{size:7.9,max:82});
  txt('Código no fornecedor: '+supplierCode(order),margin+4,y+31.5,{size:7.7,max:82});
  txt('FORNECEDOR',111,y+6,{size:8.2,bold:true,color:copy.red});
  txt(supplierName(order),111,y+13,{size:8.9,bold:true,max:83});
  txt('CNPJ: '+missing(supplierInfo(order).cnpj),111,y+20,{size:7.9,max:83});
  txt('I.E.: '+supplierTax(order),111,y+26,{size:7.9,max:83});
  txt('Telefone: '+supplierPhone(order),111,y+32,{size:7.9,max:83});
 };
 const colX={item:16,product:27,qty:130,peso:151,value:195};
 const tableHeader=y=>{
  rect(margin,y,186,8.5,copy.navy,1);
  txt('ITEM',colX.item,y+5.7,{size:7.5,bold:true,color:[255,255,255]});
  txt('DESCRIÇÃO / EMBALAGEM',colX.product,y+5.7,{size:7.5,bold:true,color:[255,255,255]});
  txt('QTDE.',colX.qty,y+5.7,{size:7.5,bold:true,color:[255,255,255]});
  txt('PESO',colX.peso,y+5.7,{size:7.5,bold:true,color:[255,255,255]});
  txt('VALOR',colX.value,y+5.7,{size:7.5,bold:true,color:[255,255,255],align:'right'});
  return y+9;
 };
 const row=(item,index,y)=>{
  const description=missing(item.produto||item.descricao,'Produto sem descrição');
  const wrap=doc.splitTextToSize(description,95);
  const height=Math.max(13.7,wrap.length>1?16.5:13.7);
  if(index%2===0)rect(margin,y,186,height,copy.pale);
  txt(String(index+1).padStart(2,'0'),colX.item,y+5.9,{size:8.3,bold:true});
  txt(description,colX.product,y+5.4,{size:8.5,bold:true,max:95});
  if(wrap.length===1){
   txt('Unitário: '+(hasPrice(item)?money(item.custoUnitario):'A confirmar'),colX.product,y+10,{size:7.3,color:copy.slate,max:95});
  }
  txt(number(itemQty(item))+(asSacks(description)?' sacos':' un.'),colX.qty,y+6.1,{size:7.6,max:22});
  txt(weight(itemWeight(item)),colX.peso,y+6.1,{size:7.6,max:29});
  txt(hasPrice(item)?money(Number(item.total)||itemQty(item)*Number(item.custoUnitario)):'A confirmar',colX.value,y+6.1,{size:7.7,bold:true,max:32,align:'right'});
  return y+height;
 };
 header();
 const badge=stateBadge(order);rect(margin,37,186,7,copy.amber,2);txt(badge,margin+3,42,{size:7.6,bold:true,color:copy.brown});
 txt('NOSSA OS',margin,51,{size:8,bold:true,color:copy.slate});
 txt(missing(order.numero,'A gerar após gravar no PEDIDOS FT'),margin,59,{size:12.5,bold:true,max:115});
 txt('DATA DO PEDIDO',198,51,{size:7.5,bold:true,color:copy.slate,align:'right'});
 txt(date(order.criadaEm||order.dataPedido),198,58.5,{size:10,bold:true,align:'right'});
 doc.setDrawColor(...copy.line);doc.line(margin,63,maxX,63);
 drawCards(66);
 let y=section('Produtos solicitados',107);
 y=tableHeader(y);
 for(let i=0;i<items.length;i++){
  const item=items[i],rowHeight=doc.splitTextToSize(missing(item.produto||item.descricao),95).length>1?16.5:13.7;
  if(y+rowHeight>208){
   doc.addPage();header();y=section('Produtos solicitados (continuação)',38);y=tableHeader(y);
  }
  y=row(item,i,y);
 }
 if(y+100>274){doc.addPage();header();y=section('Resumo e condições do pedido',38);}
 rect(margin,y+2,186,11,[235,239,242],1.5);
 txt('TOTAL DOS PRODUTOS',margin+4,y+9.4,{size:8.7,bold:true});
 const totalUnits=items.reduce((a,i)=>a+itemQty(i),0);
 const totalWeight=Number(order.pesoKg)||items.reduce((a,i)=>a+itemWeight(i),0);
 txt(number(totalUnits)+' unidades',128,y+9.4,{size:8,bold:true,max:35});
 txt(weight(totalWeight),165,y+9.4,{size:8,bold:true,max:24,align:'right'});
 txt(allPriced({itens:items})?money(totalPrice({itens:items})):'R$ a confirmar',196,y+9.4,{size:8,bold:true,max:30,align:'right'});
 y+=19;
 y=section('Condições comerciais e entrega',y);
 const fields=[
  ['Prazo negociado',terms(order),'Modalidade de frete',mode(order)],
  ['Paletização',pallets(order),'Destino previsto',missing(order.destino)],
  ['Motorista e veículo',carrierText(order),'Local de carregamento',missing(order.localCarregamento||order.origem)]
 ];
 for(const [a,b,c,d] of fields){field(a,b,16,y+3,82);field(c,d,108,y+3,86);y+=12;}
 y+=3;y=section('Confirmação do fornecedor',y);
 txt('Nº do pedido na indústria:',16,y+4,{size:8.5,bold:true});
 if(safe(order.numeroPedidoFornecedor)){
  txt(order.numeroPedidoFornecedor,91,y+4,{size:9,bold:true,max:100});
 }else{
  doc.setDrawColor(...copy.line);doc.roundedRect(88,y-1,106,9,1.5,1.5,'S');
 }
 y+=14;
 const extras=[
  ...(safe(order.modalidadeCompra)&&order.modalidadeCompra!=='PADRAO'?['Tipo de compra: '+order.modalidadeCompra]:[]),
  ...(safe(order.motoristaSnapshot?.rntrc)?['RNTRC: '+order.motoristaSnapshot.rntrc]:[])
 ];
 if(extras.length&&y+7<281){txt(extras.join('  •  '),margin+3,y+2,{size:7.2,max:178,color:copy.slate});y+=6;}
 // A data prevista de carregamento não é solicitada neste modelo aprovado.
 if(items.some(i=>!hasPrice(i))){
  rect(margin,y,186,11,copy.amber,1.5);
  txt('CONFERIR PREÇOS ANTES DE ENVIAR O PEDIDO.',margin+4,y+7,{size:8,bold:true,color:copy.brown});
 }
 footer();
 return doc;
}
