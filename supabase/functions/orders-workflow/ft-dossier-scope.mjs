const rows=(s,k)=>Array.isArray(s?.[k])?s[k]:[];
const fail=m=>{throw Error(m);};
export const billingCategories=['NF VENDA PDF','NF VENDA XML','BOLETO CLIENTE','COMPROVANTE PAGAMENTO CLIENTE','RECIBO A RECEBER'];
const paymentCategories=['BOLETO CLIENTE','COMPROVANTE PAGAMENTO CLIENTE','RECIBO A RECEBER'];
const supplierCategories=['PDF NF','XML NF','BOLETO FORNECEDOR','NF PALLETS'];
const closingCategories=[...supplierCategories,'COMPROVANTE FRETE','COMPROVANTE ENTREGA','COMPROVANTE ENVIO MOTORISTA'];
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
export function latestAssignments(history){
 const by=new Map();
 for(const h of history){const key=JSON.stringify([h.carga_id,h.user_id]);if(!by.has(key)||by.get(key).revision<h.revision)by.set(key,h);}
 return [...by.values()];
}
export const currentAssignments=history=>latestAssignments(history).filter(h=>h.ativo===true);
export function scopeFor(history,uid,id){
 const h=currentAssignments(history).find(h=>h.user_id===uid&&h.carga_id===id);
 if(!h||!['JULIANA','PEDRO'].includes(h.papel))fail('Carga não atribuída ao seu usuário.');
 return h.papel;
}
export function scopedSnapshot(state,id,role){
 if(!['JULIANA','PEDRO'].includes(role))fail('Escopo inválido.');
 const c=rows(state,'cargas').find(x=>x.id===id&&!/CANCELAD/i.test(x.status||''));
 if(!c)fail('Carga indisponível.');
 const order=rows(state,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId||o.cargaId===id);
 const sales=rows(state,'vendas').filter(v=>! /CANCELAD|REPROVAD/i.test(v.status||'')&&(v.cargaId===id||!v.cargaId&&(c.vendaIds||[]).includes(v.id)));
 const docs=rows(state,'documentos').filter(d=>{
  if(d.cargaId?d.cargaId!==id||d.compraFornecedorId&&d.compraFornecedorId!==order?.id:!order||d.compraFornecedorId!==order.id)return false;
  if(billingCategories.includes(d.categoria)||d.vendaId||d.clienteId){
   return billingCategories.includes(d.categoria)&&!!d.vendaId&&!!d.clienteId&&sales.some(v=>v.clienteId===d.clienteId&&(v.id===d.vendaId||v.grupoPedidoId===d.vendaId));
  }
  return (role==='PEDRO'?closingCategories:supplierCategories).includes(d.categoria);
 });
 return {c,order,sales,docs,os:order?.numero||c.numeroOS||c.codigo};
}
export function scopedView(state,id,role){
 const {c,order,sales,docs,os}=scopedSnapshot(state,id,role);
 const items=order?.itens?.length?order.itens:c.itensPedido?.length?c.itensPedido:c.itens||[];
 return {id,os,role,...pick(c,['fornecedor','numeroPedidoFornecedor','status','fase','finalizadaEm','finalizadaPor','modalidadeFrete','faturamentoFT']),...(role==='PEDRO'?pick(c,['motorista','placas','origem','destino','freteValor','fechamentoPedro']):{}),items:items.map(i=>pick(i,['produtoId','produto','qtd','pesoKg',...(role==='PEDRO'?['custoUnitario','total']:[])])),sales:sales.map(v=>({...pick(v,['id','grupoPedidoId','numeroVenda','clienteId','cliente','produtoId','produto','qtd','precoUnitario','totalVenda','condicaoPagamento','formaPagamento','ordemCompraCliente']),cliente:v.cliente||rows(state,'clientes').find(x=>x.id===v.clienteId)?.nome||'Cliente'})),documents:docs.map(d=>pick(d,['id','clienteId','vendaId','categoria','filename','validationStatus','receivedAt']))};
}
export function saleForUpload(snapshot,group,client){
 const matched=snapshot.sales.filter(v=>(v.grupoPedidoId||v.id)===group);
 if(!matched.length||!client||matched.some(v=>v.clienteId!==client))fail('Venda não pertence ao cliente desta OS.');
 return matched;
}
export function billingReady(snapshot){
 if(snapshot.c.destinoTipo==='VENDA DIRETA'&&!snapshot.sales.length)fail('Distribuição comercial pendente.');
 const groups=new Map();
 for(const v of snapshot.sales){const key=v.grupoPedidoId||v.id;if(!v.clienteId||!(Number(v.qtd)>0)||!(Number(v.precoUnitario)>0))fail('Venda incompleta.');if(groups.has(key)&&groups.get(key)!==v.clienteId)fail('Grupo de venda inconsistente.');groups.set(key,v.clienteId);}
 for(const [g,client] of groups){const docs=snapshot.docs.filter(d=>d.clienteId===client&&(d.vendaId===g||snapshot.sales.some(v=>(v.grupoPedidoId||v.id)===g&&v.id===d.vendaId)));
  if(!docs.some(d=>paymentCategories.includes(d.categoria)))fail('Anexe boleto, comprovante ou recibo de valor a receber de cada venda.');
 }
 return true;
}
export const billingVersion=s=>JSON.stringify([s.sales.map(v=>pick(v,['id','grupoPedidoId','clienteId','produtoId','qtd','precoUnitario','totalVenda','formaPagamento','condicaoPagamento'])),s.docs.filter(d=>billingCategories.includes(d.categoria)).map(d=>pick(d,['id','vendaId','clienteId','categoria','hash']))]);
