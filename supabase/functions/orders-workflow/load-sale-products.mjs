// A sale started from an OS can only offer products from its purchase.
export function loadSaleProducts(state,loadId){
 const load=(state.cargas||[]).find(c=>c.id===loadId);
 if(!load||load.finalizadaEm||load.status==='CANCELADA')throw Error('OS indisponível para nova venda.');
 const purchase=(state.comprasFornecedor||[]).find(o=>o.id===load.compraFornecedorId||o.cargaId===load.id);
 if(purchase?.status==='CANCELADO')throw Error('Compra cancelada.');
 const items=purchase?.itens?.length?purchase.itens:load.itensPedido?.length?load.itensPedido:load.itens||[];
 const ids=new Set(items.map(i=>i.produtoId).filter(Boolean));
 return (state.produtos||[]).filter(p=>ids.has(p.id)&&p.ativo!==false&&p.marca);
}
export function checkLoadSaleProducts(state,loadId,items){
 const products=loadSaleProducts(state,loadId);
 const allowed=new Map(products.map(p=>[p.id,p.marca]));
 if(!items?.length||items.some(i=>!allowed.has(i.produtoId)||allowed.get(i.produtoId)!==i.marca))throw Error('Selecione somente os produtos e marcas da compra desta OS.');
}
