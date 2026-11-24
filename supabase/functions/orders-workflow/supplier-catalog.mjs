const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const active=x=>x.ativo!==false,arr=(s,k)=>s[k]||[];
export function isResaleProduct(p) {
 const purpose=norm(p?.finalidade||p?.purpose||p?.tipoProduto||p?.classificacao||p?.destinacao||'REVENDA');
 return !!p&&active(p)&&p.revenda!==false&&!/USO|CONSUMO|IMOBILIZADO/.test(purpose);
}
// Only persisted supplier-ID associations authorize a product; a brand never does.
export function supplierCatalogCandidates(s,id) {
 const f=arr(s,'fornecedores').find(x=>x.id===id);
 if(!id||!f||!active(f))return [];
 return arr(s,'produtos').filter(p=>isResaleProduct(p)&&(
  p.fornecedorId===id||
  (Array.isArray(p.fornecedorIds)&&p.fornecedorIds.includes(id))||
  arr(s,'custosFornecedor').some(c=>active(c)&&c.fornecedorId===id&&c.produtoId===p.id)||
  (Array.isArray(f.produtosNegociados)&&f.produtosNegociados.some(row=>row.produtoId===p.id))
 ));
}
export function searchSupplierCatalog(s,id,query='',excluded=[]) {
 const key=norm(query);
 const used=new Set(excluded);
 return supplierCatalogCandidates(s,id).filter(p=>!used.has(p.id)&&norm([p.nome,p.marca,p.codigo,p.sku].join(' ')).includes(key));
}
export function validSupplierCatalog(rows,s,id) {
 if(!Array.isArray(rows))return false;
 if(!rows.length)return true;
 const allowed=new Set(supplierCatalogCandidates(s,id).map(p=>p.id)), seen=new Set();
 return rows.every(row=>{
  if(!row||!allowed.has(row.produtoId)||seen.has(row.produtoId)||!Number.isFinite(Number(row.custoUnitario))||Number(row.custoUnitario)<=0)return false;
  seen.add(row.produtoId);return true;
 });
}
export function supplierProducts(s,id) {
 const f=arr(s,'fornecedores').find(x=>x.id===id);
 const candidates=supplierCatalogCandidates(s,id);
 if(!f)return [];
 return Array.isArray(f.produtosNegociados)?candidates.filter(p=>f.produtosNegociados.some(row=>row.produtoId===p.id)):candidates;
}

export function supplierProductTerms(s,supplierId,productId) {
 const supplier=arr(s,'fornecedores').find(f=>f.id===supplierId);
 return supplier?.produtosNegociados?.find(row=>row.produtoId===productId);
}
