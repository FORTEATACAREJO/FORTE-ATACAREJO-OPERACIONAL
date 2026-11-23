// Prazo negociado é uma condição de parcelas (ex.: 7/14/21/28 dias), não a forma de pagamento.
export const SUPPLIER_DUE_DAY_OPTIONS=[0,7,10,14,21,28,30,35,42,45,60,90];
export const SUPPLIER_PAYMENT_METHODS=['BOLETO','PIX','TRANSFERÊNCIA','DEPÓSITO','DINHEIRO','CARTÃO','A COMBINAR'];
const numeric=value=>Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=365;
export const normalizeDueDays=values=>{
 const clean=[...new Set((Array.isArray(values)?values:[]).filter(numeric).map(Number))].sort((a,b)=>a-b);
 return clean.length>1?clean.filter(n=>n!==0):clean;
};
export function parseDueDays(raw){
 if(Array.isArray(raw))return normalizeDueDays(raw.flatMap(parseDueDays));
 if(typeof raw==='number')return numeric(raw)?[raw]:[];
 const value=String(raw||'').trim().toUpperCase();
 if(!value)return [];
 if(/^(À|A)\s*VISTA$|^ANTECIPAD[OA]$/.test(value))return [0];
 const match=value.match(/^(\d{1,3}(?:\s*[/,;]\s*\d{1,3})*)\s*(?:DIAS?|D)?$/i);
 return match?normalizeDueDays(match[1].split(/\s*[/,;]\s*/).map(Number)):[];
}
export function supplierSelectedDueDays(supplier={}){
 if(Array.isArray(supplier.prazosNegociadosDias)){
  return normalizeDueDays(supplier.prazosNegociadosDias);
 }
 const direct=parseDueDays(supplier.condicaoPagamento);
 if(direct.length)return direct;
 const old=parseDueDays(supplier.prazosPagamento);
 if(old.length)return old;
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
export function supplierWithSelectedTerms(supplier){
 const days=supplierSelectedDueDays(supplier);
 const text=formatSupplierDueDays(days);
 return {...supplier,
  formaPagamentoPadrao:supplierPaymentMethod(supplier.formaPagamentoPadrao),
  prazosNegociadosDias:days,
  condicaoPagamento:text,
  prazosPagamento:text?[text]:[]
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
 const parts=text.split(/\s*[,;/]\s*/);
 if(parts.some(part=>!/^\d{1,3}$/.test(part))){
  return {days:[],error:'Use números separados por vírgula, barra ou ponto e vírgula. Ex.: 7,14,21.'};
 }
 const values=parts.map(Number);
 if(values.some(n=>n<1||n>365)){
  return {days:[],error:'Cada prazo deve ter de 1 a 365 dias. Para pagamento à vista, marque a opção À vista.'};
 }
 return {days:normalizeDueDays(values),error:''};
}
