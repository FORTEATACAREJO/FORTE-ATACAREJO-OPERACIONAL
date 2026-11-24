import {useMemo,useState} from 'react';
import {supplierCatalogCandidates,searchSupplierCatalog,validSupplierCatalog} from '../../../supabase/functions/orders-workflow/supplier-catalog.mjs';
export {validSupplierCatalog};
import {linkSupplierProductsInBulk} from './supplier-products-bulk.mjs';
export default function SupplierProductCatalog(props){
 return <SupplierProductCatalogFields key={props.supplier.id||'novo'} {...props}/>;
}
function SupplierProductCatalogFields({supplier,catalogState,onChange}){
 const rows=supplier.produtosNegociados||[];
 const [query,setQuery]=useState('');
 const [chosen,setChosen]=useState([]);
 const available=useMemo(()=>supplierCatalogCandidates(catalogState,supplier.id),[catalogState,supplier.id]);
 const linked=new Set(rows.map(r=>r.produtoId).filter(Boolean));
 const unlinked=available.filter(p=>!linked.has(p.id));
 const filtered=searchSupplierCatalog(catalogState,supplier.id,query,[...linked]);
 const checked=chosen.filter(id=>unlinked.some(p=>p.id===id));
 const save=produtosNegociados=>onChange(current=>({...current,produtosNegociados}));
 const edit=(index,patch)=>save(rows.map((row,i)=>i===index?{...row,...patch}:row));
 const toggle=id=>{if(!unlinked.some(p=>p.id===id))return;setChosen(previous=>previous.includes(id)?previous.filter(v=>v!==id):[...previous,id]);};
 const selectAll=()=>setChosen(previous=>[...new Set([...previous.filter(id=>unlinked.some(p=>p.id===id)),...filtered.map(p=>p.id)])]);
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
   {available.length===0&&<p role="status">Nenhum produto cadastrado neste fornecedor. <a href="https://forte-vendas.onrender.com/?forte_view=cadastros" target="_blank" rel="noopener noreferrer">Abrir cadastro de produtos no FORTE OP</a> e vincule o produto ao ID do fornecedor; depois reabra este cadastro.</p>}
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
    <input aria-label={'Custo negociado '+(available.find(p=>p.id===row.produtoId)?.nome||index+1)} type="number" step="0.0001" min="0.0001"
      value={row.custoUnitario??''} onChange={e=>edit(index,{custoUnitario:e.target.value})} placeholder="Informe o valor acordado"/>
   </label>
   <button type="button" className="secondary" onClick={()=>save(rows.filter((_,i)=>i!==index))}>Remover vínculo</button>
  </div>)}
  {rows.some(row=>!row.produtoId||!(Number(row.custoUnitario)>0))&&<p className="ft-supplier-catalog-hint" role="status">Preencha o custo unitário de cada produto vinculado para salvar o fornecedor.</p>}
  <button type="button" className="secondary ft-supplier-add-single" disabled={rows.some(row=>!row.produtoId)||rows.length>=available.length} onClick={()=>save([...rows,{produtoId:'',custoUnitario:''}])}>+ Vincular um produto individualmente</button>
 </fieldset>;
}
