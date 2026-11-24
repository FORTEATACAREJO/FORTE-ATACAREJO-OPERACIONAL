import {useMemo,useState} from 'react';
import {isResaleProduct} from '../../../supabase/functions/orders-workflow/supplier-catalog.mjs';
import {linkSupplierProductsInBulk} from './supplier-products-bulk.mjs';
const searchKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
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
 const [query,setQuery]=useState('');
 const [chosen,setChosen]=useState([]);
 const [selectionSupplier,setSelectionSupplier]=useState(supplier.id);
 const available=useMemo(()=>{
  const normalize=searchKey;
  const supplierId=String(supplier.id||'');
  const brands=(Array.isArray(supplier.marcas)&&supplier.marcas.length?supplier.marcas:[supplier.nome||''])
   .map(normalize).filter(Boolean);
  const linkedIds=new Set((supplier.produtosNegociados||[]).map(row=>String(row.produtoId)));
  return products.filter(p=>isResaleProduct(p)&&(
   linkedIds.has(String(p.id))||
   (supplierId&&String(p.fornecedorId||'')===supplierId)||
   (supplierId&&Array.isArray(p.fornecedorIds)&&p.fornecedorIds.some(id=>String(id)===supplierId))||
   brands.includes(normalize(p.marca))
  ));
 },[products,supplier]);
 const linked=new Set(rows.map(r=>r.produtoId).filter(Boolean));
 const unlinked=available.filter(p=>!linked.has(p.id));
 const filtered=unlinked.filter(p=>searchKey([p.nome,p.marca,p.codigo,p.sku].join(' ')).includes(searchKey(query)));
 const checked=(selectionSupplier===supplier.id?chosen:[]).filter(id=>unlinked.some(p=>p.id===id));
 const save=produtosNegociados=>onChange(current=>({...current,produtosNegociados}));
 const edit=(index,patch)=>save(rows.map((row,i)=>i===index?{...row,...patch}:row));
 const toggle=id=>{setSelectionSupplier(supplier.id);setChosen(previous=>selectionSupplier===supplier.id?(previous.includes(id)?previous.filter(v=>v!==id):[...previous,id]):[id]);};
 const selectAll=()=>{setSelectionSupplier(supplier.id);setChosen(previous=>[...new Set([...(selectionSupplier===supplier.id?previous:[]),...filtered.map(p=>p.id)])]);};
 const addBulk=()=>{
  if(checked.length===0)return;
  save(linkSupplierProductsInBulk(rows,checked,available));
  setChosen([]);
  setQuery('');
 };
 return <fieldset className="ow-supplier-section ft-supplier-catalog">
  <legend>Produtos negociados com o fornecedor</legend>
  <p className="ft-supplier-catalog-help">Marque vários produtos para vincular de uma vez. Depois, informe o custo negociado de cada um.</p>
  <div className="ft-supplier-bulk">
   <label>Pesquisar produtos para vincular
    <input aria-label="Pesquisar produtos para vincular" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, marca ou código"/>
   </label>
   <div className="ft-supplier-bulk-actions">
    <button type="button" className="secondary" disabled={filtered.length===0} onClick={selectAll}>Marcar todos os exibidos ({filtered.length})</button>
    <button type="button" className="secondary" disabled={checked.length===0} onClick={()=>setChosen([])}>Limpar marcação</button>
   </div>
   <div className="ft-supplier-product-checks" role="group" aria-label="Marcar produtos para vincular">
    {filtered.map(p=><label key={p.id} className="ft-supplier-product-option">
     <input type="checkbox" checked={checked.includes(p.id)} onChange={()=>toggle(p.id)}/>
     <span>{p.nome}{p.marca&&<small> · {p.marca}</small>}</span>
    </label>)}
    {filtered.length===0&&<p>{unlinked.length===0?'Nenhum outro produto cadastrado para este fornecedor está disponível para vínculo.':'Nenhum produto corresponde à pesquisa.'}</p>}
   </div>
   <button type="button" disabled={!checked.length} onClick={addBulk}>VINCULAR {checked.length||''} PRODUTO{checked.length===1?'':'S'} SELECIONADO{checked.length===1?'':'S'}</button>
  </div>
  <h4 className="ft-supplier-linked-heading">Produtos vinculados ({rows.filter(r=>r.produtoId).length})</h4>
  {rows.map((row,index)=><div className="ft-supplier-linked-product" key={row.produtoId||'novo-'+index}>
   <label>Produto <select value={row.produtoId} onChange={e=>edit(index,{produtoId:e.target.value})}>
    <option value="">Selecione</option>
    {available.filter(p=>p.id===row.produtoId||!rows.some(r=>r.produtoId===p.id)).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
   </select></label>
   <label>Custo unitário negociado (R$)
    <input aria-label={'Custo negociado '+(available.find(p=>p.id===row.produtoId)?.nome||index+1)} type="number" step="0.01" min="0.01"
      value={row.custoUnitario??''} onChange={e=>edit(index,{custoUnitario:e.target.value})} placeholder="Informe o valor acordado"/>
   </label>
   <button type="button" className="secondary" onClick={()=>save(rows.filter((_,i)=>i!==index))}>Remover vínculo</button>
  </div>)}
  {rows.some(row=>!row.produtoId||!(Number(row.custoUnitario)>0))&&<p className="ft-supplier-catalog-hint" role="status">Preencha o custo unitário de cada produto vinculado para salvar o fornecedor.</p>}
  <button type="button" className="secondary ft-supplier-add-single" disabled={rows.some(row=>!row.produtoId)||rows.length>=available.length} onClick={()=>save([...rows,{produtoId:'',custoUnitario:''}])}>+ Vincular um produto individualmente</button>
 </fieldset>;
}
