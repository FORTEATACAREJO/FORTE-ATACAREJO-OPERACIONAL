import {useState} from 'react';
import {
 SUPPLIER_DUE_DAY_OPTIONS,SUPPLIER_PAYMENT_METHODS,
 supplierSelectedDueDays,formatSupplierDueDays,
 supplierPaymentMethod,toggleSupplierDueDay,normalizeDueDays,parseCustomSupplierDueDays
} from './supplier-terms-selection.mjs';
export default function SupplierPaymentPreferences({supplier,onChange}){
 const [custom,setCustom]=useState('');
 const [customError,setCustomError]=useState('');
 const days=supplierSelectedDueDays(supplier);
 const method=supplierPaymentMethod(supplier.formaPagamentoPadrao);
 const formatted=formatSupplierDueDays(days);
 const setDays=selected=>{
  const cleaned=normalizeDueDays(selected),term=formatSupplierDueDays(cleaned);
  onChange(row=>({...row,formaPagamentoPadrao:supplierPaymentMethod(row.formaPagamentoPadrao),
   prazosNegociadosDias:cleaned,condicaoPagamento:term,prazosPagamento:term?[term]:[]}));
 };
 function addCustom(){
  const parsed=parseCustomSupplierDueDays(custom);
  if(parsed.error){setCustomError(parsed.error);return;}
  setDays([...days.filter(x=>x!==0),...parsed.days]);
  setCustom('');
  setCustomError('');
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
    <label>Outros prazos (dias) — pode digitar vários
     <input aria-label="Outros prazos em dias" type="text" inputMode="text" autoComplete="off" spellCheck={false}
      value={custom} onChange={e=>{setCustom(e.target.value);setCustomError('');}}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom();}}}
      placeholder="Ex.: 7,14,21,28"/>
    </label>
    <button type="button" className="secondary" disabled={!custom.trim()} onClick={addCustom}>+ Adicionar prazos</button>
   </div>
   <p className="ft-supplier-due-hint">Digite <strong>7,14,21</strong>, <strong>7/14/21</strong> ou <strong>7;14;21</strong> e toque em Adicionar prazos. Os já marcados não serão duplicados.</p>
   {customError&&<p className="ft-supplier-due-error" role="alert">{customError}</p>}
   <p className="ft-supplier-due-summary" role="status"><strong>Prazo negociado:</strong> {formatted||'Selecione pelo menos uma opção'}</p>
   <p className="ft-supplier-due-hint">Essa condição será apresentada automaticamente ao selecionar o fornecedor no pedido. O prazo não será confundido com a forma de pagamento.</p>
  </fieldset>
 </section>;
}
