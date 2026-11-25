// Referência externa da compra, nunca a sequência interna de carga.
export function customerPurchaseOrder(reference,line){
 const raw=String(reference??'').trim();
 const item=String(line??'').trim();
 if(raw.length>15||/[\u0000-\u001f\u007f]/.test(raw))throw Error('Ordem de compra do cliente: informe até 15 caracteres, sem caracteres de controle.');
 if(item&&(!raw||!/^\d{1,6}$/.test(item)||Number(item)<1))throw Error('Item da ordem de compra: informe o número de 1 a 999999 e a ordem correspondente.');
 return {ordemCompraCliente:raw,itemOrdemCompraCliente:item?Number(item):null};
}
