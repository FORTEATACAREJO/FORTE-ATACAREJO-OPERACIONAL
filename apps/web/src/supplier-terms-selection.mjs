import {paymentDays,paymentKey,paymentOptions} from '../../../supabase/functions/orders-workflow/supplier-payment-terms.mjs';
// Prazo negociado é uma condição de parcelas (ex.: 7/14/21/28 dias), não a forma de pagamento.
export const SUPPLIER_DUE_DAY_OPTIONS=[0,7,10,14,21,28,30,35,42,45,60,90];
export const SUPPLIER_PAYMENT_METHODS=['BOLETO','PIX','TRANSFERÊNCIA','DEPÓSITO','DINHEIRO','CARTÃO','A COMBINAR'];
const numeric=value=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=365;
export const normalizeDueDays=values=>{
 const clean=[...new Set((Array.isArray(values)?values:[]).filter(numeric).map(Number))].sort((a,b)=>a-b);
 return clean.length>1?clean.filter(n=>n!==0):clean;
};
export function parseDueDays(raw){return Array.isArray(raw)?normalizeDueDays(raw.flatMap(parseDueDays)):paymentDays(raw);}
export function supplierSelectedDueDays(supplier={}){
 if(Array.isArray(supplier.prazosNegociadosDias)){
  return normalizeDueDays(supplier.prazosNegociadosDias);
 }
 const direct=parseDueDays(supplier.condicaoPagamento);
 if(direct.length)return direct;
 const terms=Array.isArray(supplier.prazosPagamento)?supplier.prazosPagamento:[supplier.prazosPagamento];
 for(const term of terms){const days=parseDueDays(term);if(days.length)return days;}
 return parseDueDays(supplier.formaPagamentoPadrao);
}
export const formatSupplierDueDays=days=>{
 const sorted=normalizeDueDays(days);
 if(!sorted.length)return '';
 return sorted.length===1&&sorted[0]===0?'À VISTA':sorted.join('/')+' dias';
};
export const supplierPaymentMethod=value=>{
 const raw=String(value||'').trim();
 return parseDueDays(raw).length?'':raw;
};
// A combinação 7/14/21 é uma ÚNICA condição; outras combinações cadastradas
// continuam disponíveis, sem serem desmembradas em prazos individuais.
export function supplierRegisteredTerms(supplier={}){
 const original=[
  ...(Array.isArray(supplier.prazosPagamento)?supplier.prazosPagamento:[]),
  supplier.condicaoPagamento
 ];
 const dedup=new Set();
 return original.map(term=>{
  const parsed=parseDueDays(term);
  return parsed.length?formatSupplierDueDays(parsed):String(term||'').trim();
 }).filter(term=>{
  const key=term.toLocaleUpperCase('pt-BR');
  if(!term||dedup.has(key))return false;
  dedup.add(key);return true;
 });
}
export function supplierWithSelectedTerms(supplier){
 const days=supplierSelectedDueDays(supplier);
 const term=formatSupplierDueDays(days);
 const original=supplierRegisteredTerms(supplier);
 const next=term?[...original.filter(x=>x!==term),term]:original;
 return {...supplier,
  formaPagamentoPadrao:supplierPaymentMethod(supplier.formaPagamentoPadrao),
  prazosNegociadosDias:days,
  condicaoPagamento:term,
  prazosPagamento:next
 };
}
export function toggleSupplierDueDay(current,day){
 if(!numeric(day))return normalizeDueDays(current);
 const original=normalizeDueDays(current);
 if(original.includes(Number(day)))return original.filter(x=>x!==Number(day));
 return normalizeDueDays(Number(day)===0?[0]:[...original.filter(x=>x!==0),Number(day)]);
}

/**
 * Interpreta vários vencimentos informados de uma vez no campo do celular.
 * Exemplos válidos: "7", "7,14,21", "7/14/21", "7; 14; 21".
 * Valores inválidos nunca são parcialmente adicionados.
 */
export function parseCustomSupplierDueDays(input){
 const text=String(input??'').trim().replace(/\s*dias?\s*$/i,'').trim();
 if(!text)return {days:[],error:'Informe um ou mais prazos em dias.'};
 const parts=text.split(/(?:\s*[,;/]\s*|\s+)/);
 if(parts.some(part=>!/^\d{1,3}$/.test(part))){
  return {days:[],error:'Use números separados por vírgula, barra ou ponto e vírgula. Ex.: 7,14,21.'};
 }
 const values=parts.map(Number);
 if(values.some(n=>n<1||n>365)){
  return {days:[],error:'Cada prazo deve ter de 1 a 365 dias. Para pagamento à vista, marque a opção À vista.'};
 }
 return {days:normalizeDueDays(values),error:''};
}

// Catálogo geral de prazos: os vínculos comerciais permanecem em cada cadastro.
export const CLIENT_PAYMENT_METHODS=['PIX','CARTÃO','BOLETO'];
export const SUPPLIER_INITIAL_TERMS=['À VISTA','7 dias','10 dias','12 dias','14 dias','28 dias','7/14/21 dias','7/14/21/28 dias'];
export const CLIENT_INITIAL_TERMS=['À VISTA','5 dias','7 dias','10 dias','12 dias','14 dias','7/14/21 dias','7/14/21/28 dias','7/14/21/28/35 dias','7/14/21/28/35/42 dias','5/10/15/20/25/30/35/40 dias'];
export function sharedPaymentTerms(state={},kind='fornecedores'){
 const defaults=kind==='clientes'?CLIENT_INITIAL_TERMS:SUPPLIER_INITIAL_TERMS;
 const catalog=(state.pagamentos||[]).filter(x=>x.ativo!==false).map(x=>x.descricao).filter(x=>paymentDays(x).length);
 return paymentOptions([...defaults,...catalog]);
}
export function customerRegisteredTerms(customer={}){
 const original=[...(Array.isArray(customer.prazosPagamento)?customer.prazosPagamento:[]),customer.condicaoPagamento];
 return paymentOptions(original.filter(x=>String(x||'').trim()));
}
export function registerSharedTerms(rows=[],terms=[]){
 const out=[...rows];
 for(const raw of terms){
  const days=paymentDays(raw);
  if(!days.length)continue;
  const label=formatSupplierDueDays(days),key=paymentKey(label);
  if(out.some(x=>x.ativo!==false&&paymentKey(x.descricao)===key))continue;
  const id='pg-prazo-'+days.join('-');
  const unique=out.some(x=>x.id===id)?id+'-ativo':id;
  if(out.some(x=>x.id===unique))throw Error('Condição desativada no catálogo. Reative-a no cadastro central.');
  out.push({id:unique,descricao:label,ativo:true});
 }
 return out;
}
