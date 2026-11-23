import {useState} from 'react';
import {
 SUPPLIER_DUE_DAY_OPTIONS,SUPPLIER_PAYMENT_METHODS,
 supplierSelectedDueDays,formatSupplierDueDays,
 supplierPaymentMethod,toggleSupplierDueDay,normalizeDueDays
} from './supplier-terms-selection.mjs';
export default function SupplierPaymentPreferences({supplier,onChange}){
 const [custom,setCustom]=useState('');
 const days=supplierSelectedDueDays(supplier);
 const method=supplierPaymentMethod(supplier.formaPagamentoPadrao);
 const formatted=formatSupplierDueDays(days);
 const setDays=selected=>{
  const cleaned=normalizeDueDays(selected),term=formatSupplierDueDays(cleaned);
  onChange(row=>({...row,formaPagamentoPadrao:supplierPaymentMethod(row.formaPagamentoPadrao),
   prazosNegociadosDias:cleaned,condicaoPagamento:term,prazosPagamento:term?[term]:[]}));
 };
 function addCustom(){
  const value=Number(custom);
  if(!Number.isInteger(value)||value<1||value>365)return;
  setDays([...days.filter(x=>x!==0),value]);setCustom('');
 }
 return <section className="ft-supplier-terms" aria-label="Pagamento e prazos do fornecedor">
  <label>Forma de pagamento
   <select value={method} onChange={e=>onChange(row=>({...row,formaPagamentoPadrao:e.target.value}))}>
    <option value="">Selecione a forma de pagamento</option>
    {method&&!SUPPLIER_PAYMENT_METHODS.includes(method)&&<option value={method}>{method}</option>}
    {SUPPLIER_PAYMENT_METHODS.map(v=><option value={v} key={v}>{v}</option>)}
   </select>
  </label>
  <fieldset className="ft-supplier-due-options">
   <legend>Prazos negociados — marque um ou vários</legend>
   <p>Selecione todos os vencimentos combinados com o fornecedor. Ex.: 7, 14, 21 e 28 dias.</p>
   <div className="ft-supplier-due-grid">
    {SUPPLIER_DUE_DAY_OPTIONS.map(day=><label key={day} className="ft-supplier-due-choice">
     <input type="checkbox" checked={days.includes(day)}
      onChange={()=>setDays(toggleSupplierDueDay(days,day))}/>
     <span>{day===0?'À vista':day+' dias'}</span>
    </label>)}
    {days.filter(day=>!SUPPLIER_DUE_DAY_OPTIONS.includes(day)).map(day=><label key={day} className="ft-supplier-due-choice">
     <input type="checkbox" checked onChange={()=>setDays(days.filter(x=>x!==day))}/>
     <span>{day} dias</span>
    </label>)}
   </div>
   <div className="ft-supplier-add-day">
    <label>Outro prazo (dias)
     <input aria-label="Outro prazo em dias" type="number" min="1" max="365" step="1"
      value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Ex.: 56"/>
    </label>
    <button type="button" className="secondary" disabled={!custom||!Number.isInteger(Number(custom))||Number(custom)<1||Number(custom)>365} onClick={addCustom}>+ Adicionar prazo</button>
   </div>
   <p className="ft-supplier-due-summary" role="status"><strong>Prazo negociado:</strong> {formatted||'Selecione pelo menos uma opção'}</p>
   <p className="ft-supplier-due-hint">Essa condição será apresentada automaticamente ao selecionar o fornecedor no pedido. O prazo não será confundido com a forma de pagamento.</p>
  </fieldset>
 </section>;
}
