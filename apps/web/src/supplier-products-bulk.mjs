import {isResaleProduct} from '../../../supabase/functions/orders-workflow/supplier-catalog.mjs';
export function linkSupplierProductsInBulk(rows=[],ids=[],products=[]){
 const allowed=new Set(products.filter(isResaleProduct).map(x=>x.id));
 const used=new Set(rows.map(row=>row.produtoId).filter(Boolean));
 const added=[];
 for(const id of ids){
  if(!allowed.has(id)||used.has(id))continue;
  used.add(id);added.push({produtoId:id,custoUnitario:''});
 }
 return [...rows,...added];
}
