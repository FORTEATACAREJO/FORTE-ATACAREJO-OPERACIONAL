import {isResaleProduct} from '../../../supabase/functions/orders-workflow/supplier-catalog.mjs';

export function validSupplierCatalog(rows, products) {
 const ids=new Set();
 for(const row of rows||[]){
  if(ids.has(row.produtoId)||!products.some(p=>p.id===row.produtoId&&isResaleProduct(p)))return false;
  if(!Number.isFinite(Number(row.custoUnitario))||Number(row.custoUnitario)<=0)return false;
  ids.add(row.produtoId);
 }
 return true;
}

export default function SupplierProductCatalog({supplier,products,onChange}){
 const rows=supplier.produtosNegociados||[];
 const available=products.filter(isResaleProduct);
 const save=produtosNegociados=>onChange(current=>({...current,produtosNegociados}));
 const edit=(index,patch)=>save(rows.map((row,i)=>i===index?{...row,...patch}:row));
 return <fieldset className="ow-supplier-section">
  <legend>Produtos negociados com o fornecedor</legend>
  {rows.map((row,index)=><div className="ow-grid" key={index}>
   <label>Produto <select value={row.produtoId} onChange={e=>edit(index,{produtoId:e.target.value})}>
    <option value="">Selecione</option>
    {available.filter(p=>p.id===row.produtoId||!rows.some(r=>r.produtoId===p.id)).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
   </select></label>
   <label>Custo unitário (R$)<input type="number" step="0.01" min="0.01" value={row.custoUnitario} onChange={e=>edit(index,{custoUnitario:e.target.value})}/></label>
   <button type="button" className="secondary" onClick={()=>save(rows.filter((_,i)=>i!==index))}>Remover vínculo</button>
  </div>)}
  <button type="button" className="secondary" disabled={rows.some(row=>!row.produtoId)||rows.length>=available.length} onClick={()=>save([...rows,{produtoId:'',custoUnitario:''}])}>Vincular produto</button>
 </fieldset>;
}
