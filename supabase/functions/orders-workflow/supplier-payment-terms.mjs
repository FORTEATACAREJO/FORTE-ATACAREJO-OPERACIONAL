// Uma condição negociada é uma unidade; os dias são os vencimentos previstos.
export function paymentDays(raw){
 if(typeof raw==='number')raw=String(raw);
 if(typeof raw!=='string')return [];
 const v=raw.trim().toUpperCase();
 if(/^(À|A)\s*VISTA$|^ANTECIPAD[OA]$/.test(v))return [0];
 const m=v.match(/^(\d{1,3}(?:(?:\s*[/,;]\s*|\s+)\d{1,3})*)\s*(?:DIAS?|D)?$/i);
 if(!m)return [];
 const days=[...new Set(m[1].split(/(?:\s*[/,;]\s*|\s+)/).map(Number))].sort((a,b)=>a-b);
 return days.some(d=>d>365)||days.includes(0)&&days.length>1?[]:days;
}
export function paymentLabel(raw){const days=paymentDays(raw);return days.length?(days[0]===0?'À VISTA':days.join('/')+' dias'):String(raw??'').trim();}
export function paymentKey(raw){const days=paymentDays(raw);return days.length?'D:'+days.join('/'):String(raw??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();}
export function paymentOptions(values,selected=''){
 const options=new Map();
 for(const value of values){const label=paymentLabel(value),key=paymentKey(value);if(label&&key&&!options.has(key))options.set(key,label);}
 if(String(selected??'').trim())options.set(paymentKey(selected),String(selected).trim());
 return [...options.values()];
}
export function paymentBaseDate(value){
 const s=String(value??'');
 if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';}
 const d=new Date(s);
 if(!Number.isFinite(d.getTime()))return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
export function paymentSchedule(term,reference){
 const dataBasePagamento=paymentBaseDate(reference);
 const vencimentosPagamento=dataBasePagamento?paymentDays(term).map(dias=>{const date=new Date(dataBasePagamento+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+dias);return {dias,vencimento:date.toISOString().slice(0,10)};}):[];
 return {dataBasePagamento,vencimentosPagamento};
}
export function paymentScheduleText(record={}){return (record.vencimentosPagamento||[]).map(v=>v.dias+' d: '+String(v.vencimento).split('-').reverse().join('/')).join(' • ');}

export function registerSharedTerms(rows=[],terms=[]){
 const out=[...rows];
 for(const raw of terms){
  const days=paymentDays(raw);
  if(!days.length)continue;
  const label=paymentLabel(raw),key=paymentKey(label);
  if(out.some(x=>x.ativo!==false&&paymentKey(x.descricao)===key))continue;
  const id='pg-prazo-'+days.join('-');
  const unique=out.some(x=>x.id===id)?id+'-ativo':id;
  if(out.some(x=>x.id===unique))throw Error('Condição desativada no catálogo. Reative-a no cadastro central.');
  out.push({id:unique,descricao:label,ativo:true});
 }
 return out;
}
