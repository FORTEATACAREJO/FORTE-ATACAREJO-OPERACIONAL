// Cálculo comercial da carga; não substitui apuração fiscal/contábil.
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;

function sumAmounts(rows,amountOf){
 let sum=0;
 for(const item of rows){
  const amount=amountOf(item);
  if(amount===null)return null;
  sum+=amount;
 }
 return round(sum);
}
function purchaseAmount(item){
 const explicit=finite(item.total);
 if(explicit!==null)return explicit;
 const qty=finite(item.qtd),price=finite(item.custoUnitario);
 return qty===null||price===null?null:round(qty*price);
}
function salesAmount(item){
 const explicit=finite(item.totalVenda);
 if(explicit!==null)return explicit;
 const qty=finite(item.qtd),price=finite(item.precoUnitario);
 return qty===null||price===null?null:round(qty*price);
}
export function financialSummary({carga={},order=null,sales=[]}={}){
 const mode=String(carga.modalidadeFrete||order?.modalidadeFrete||'').toUpperCase();
 const items=order?.itens?.length?order.itens:carga.itensPedido?.length?carga.itensPedido:carga.itens||[];
 const cost=finite(order?.custoTotal)??(items.length?sumAmounts(items,purchaseAmount):null);
 const revenue=sales.length?sumAmounts(sales,salesAmount):null;
 const difference=cost===null||revenue===null?null:round(revenue-cost);
 let deducted=null,freightStatus='MODALIDADE_PENDENTE';
 if(mode==='CIF'){
  deducted=0;
  freightStatus='INCLUSO_NO_PRECO';
 }else if(mode==='FOB'){
  const recorded=finite(carga.freteValor);
  if(recorded!==null&&(recorded>0||Boolean(carga.freteRegistradoEm))){
   deducted=round(recorded);
   freightStatus='REGISTRADO';
  }else{
   freightStatus='FRETE_PENDENTE';
  }
 }
 const afterFreight=difference===null||deducted===null?null:round(difference-deducted);
 return {
  modalidadeFrete:mode||'NÃO INFORMADA',
  receitaVendas:revenue,
  custoFornecedor:cost,
  diferencaAntesFrete:difference,
  freteDescontado:deducted,
  statusFrete:freightStatus,
  resultadoAposFrete:afterFreight,
  completo:afterFreight!==null
 };
}
