import {useState} from 'react';
import {
 SUPPLIER_DUE_DAY_OPTIONS,SUPPLIER_PAYMENT_METHODS,
 supplierSelectedDueDays,formatSupplierDueDays,supplierRegisteredTerms,parseDueDays,
 supplierPaymentMethod,toggleSupplierDueDay,normalizeDueDays,parseCustomSupplierDueDays
} from './supplier-terms-selection.mjs';

export default function SupplierPaymentPreferences({supplier,registered,onChange,onRegisterTerm,onChooseTerm}){
 const [custom,setCustom]=useState('');
 const [customError,setCustomError]=useState('');
 const [registerBusy,setRegisterBusy]=useState(false);
 const [registerStatus,setRegisterStatus]=useState('');
 const [registerError,setRegisterError]=useState('');
 const days=supplierSelectedDueDays(supplier);
 const method=supplierPaymentMethod(supplier.formaPagamentoPadrao);
 const formatted=formatSupplierDueDays(days);
 const registeredTerms=supplierRegisteredTerms(registered||{});
 const isRegistered=Boolean(formatted&&registeredTerms.includes(formatted));
 const setDays=selected=>{
  const cleaned=normalizeDueDays(selected),term=formatSupplierDueDays(cleaned);
  setRegisterStatus('');setRegisterError('');
  // Não altera a relação de condições cadastradas enquanto só marca caixas.
  onChange(row=>({...row,
   formaPagamentoPadrao:supplierPaymentMethod(row.formaPagamentoPadrao),
   prazosNegociadosDias:cleaned,condicaoPagamento:term}));
 };
 function addCustom(){
  const parsed=parseCustomSupplierDueDays(custom);
  if(parsed.error){setCustomError(parsed.error);return;}
  setDays([...days.filter(x=>x!==0),...parsed.days]);
  setCustom('');setCustomError('');
 }
 async function registerCondition(){
  if(!formatted||!registered?.id||!onRegisterTerm||registerBusy||isRegistered)return;
  setRegisterBusy(true);setRegisterError('');setRegisterStatus('');
  try{
   await onRegisterTerm(formatted);
   onChange(row=>({...row,
    prazosPagamento:[...new Set([...(row.prazosPagamento||[]),formatted])]}));
   onChooseTerm?.(formatted);
   setRegisterStatus('Condição '+formatted+' cadastrada! Já está disponível no campo Prazo do fornecedor.');
  }catch(error){
   setRegisterError(error?.message||'Não foi possível gravar a condição. Nenhum prazo foi registrado.');
  }finally{setRegisterBusy(false);}
 }
 function useRegisteredTerm(term){
  const parsed=parseDueDays(term);
  if(parsed.length){setDays(parsed);onChooseTerm?.(term);setRegisterStatus('Condição '+term+' selecionada para o pedido.');}
 }
 return <section className="ft-supplier-terms" aria-label="Pagamento e prazos do fornecedor">
  <label>Forma de pagamento
   <select value={method} onChange={e=>onChange(row=>({...row,formaPagamentoPadrao:e.target.value}))}>
    <option value="">Selecione a forma de pagamento</option>
    {method&&!SUPPLIER_PAYMENT_METHODS.includes(method)&&<option value={method}>{method}</option>}
    {SUPPLIER_PAYMENT_METHODS.map(value=><option value={value} key={value}>{value}</option>)}
   </select>
  </label>
  <fieldset className="ft-supplier-due-options">
   <legend>Prazos negociados — marque um ou vários</legend>
   <p>Os vencimentos marcados formam <strong>uma única condição de pagamento</strong>. Ex.: 7, 14 e 21 dias = 7/14/21 dias.</p>
   <div className="ft-supplier-term-quick-save">
    <p className="ft-supplier-due-summary" role="status"><strong>Condição selecionada:</strong> {formatted||'Marque os vencimentos'}</p>
    {isRegistered?<p className="ft-supplier-registered-note">✓ Esta condição já está cadastrada no fornecedor e pode ser selecionada no pedido.</p>
    :<button type="button" className="ft-supplier-register-btn" disabled={!formatted||!registered?.id||!onRegisterTerm||registerBusy} onClick={registerCondition}>
      {registerBusy?'Registrando…':'REGISTRAR CONDIÇÃO '+(formatted||'SELECIONADA')}
     </button>}
    {!registered?.id&&<p className="ft-supplier-due-hint">Para cadastrar condições no banco, salve primeiro o novo fornecedor.</p>}
    {registerStatus&&<p className="ft-supplier-registered-note" role="status">{registerStatus}</p>}
    {registerError&&<p className="ft-supplier-due-error" role="alert">{registerError}</p>}
   </div>
   {registeredTerms.length>0&&<div className="ft-supplier-registered-terms">
    <strong>Condições já cadastradas neste fornecedor</strong>
    <div className="ft-supplier-registered-list">
     {registeredTerms.map(term=><button type="button" key={term} className="secondary" disabled={!parseDueDays(term).length||registerBusy}
      onClick={()=>useRegisteredTerm(term)} aria-label={'Selecionar condição '+term}>{term}</button>)}
    </div>
   </div>}
   <div className="ft-supplier-due-grid">
    {SUPPLIER_DUE_DAY_OPTIONS.map(day=><label key={day} className="ft-supplier-due-choice">
     <input type="checkbox" checked={days.includes(day)} disabled={registerBusy}
      onChange={()=>setDays(toggleSupplierDueDay(days,day))}/>
     <span>{day===0?'À vista':day+' dias'}</span>
    </label>)}
    {days.filter(day=>!SUPPLIER_DUE_DAY_OPTIONS.includes(day)).map(day=><label key={day} className="ft-supplier-due-choice">
     <input type="checkbox" checked disabled={registerBusy} onChange={()=>setDays(days.filter(x=>x!==day))}/>
     <span>{day} dias</span>
    </label>)}
   </div>
   <div className="ft-supplier-add-day">
    <label>Outros prazos (dias) — pode digitar vários
     <input aria-label="Outros prazos em dias" type="text" inputMode="text" autoComplete="off" spellCheck={false}
      value={custom} onChange={e=>{setCustom(e.target.value);setCustomError('');}}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom();}}}
      placeholder="Ex.: 7,14,21,28" disabled={registerBusy}/>
    </label>
    <button type="button" className="secondary" disabled={!custom.trim()||registerBusy} onClick={addCustom}>+ Adicionar prazos</button>
   </div>
   <p className="ft-supplier-due-hint">Digite <strong>7,14,21</strong>, <strong>7/14/21</strong> ou <strong>7;14;21</strong>. Depois, toque em Registrar condição para gravar a opção no fornecedor.</p>
   {customError&&<p className="ft-supplier-due-error" role="alert">{customError}</p>}
  </fieldset>
 </section>;
}
