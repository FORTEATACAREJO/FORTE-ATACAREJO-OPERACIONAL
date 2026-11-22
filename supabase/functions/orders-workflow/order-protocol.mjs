// Protocolo do PEDIDOS FT: apenas o PRIMEIRO nome do motorista + DDMMAA, tudo junto.
// Identificador secundário: nunca substitui o ID imutável da carga ou o número oficial.
function dateParts(value){
 if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))){
  const [year,month,day]=value.split('-');
  const probe=new Date(value+'T12:00:00Z');
  if(Number.isNaN(probe.getTime())||probe.toISOString().slice(0,10)!==value)throw new Error('Data inválida para o protocolo.');
  return {day,month,year:year.slice(-2)};
 }
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))throw new Error('Data inválida para o protocolo.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));
 return {day:parts.day,month:parts.month,year:parts.year};
}
export function protocolBase(name,date){
 const first=String(name||'').trim().split(/[\s-]+/u)[0]||'';
 const clean=first.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toLowerCase();
 if(!clean)return '';
 const formatted=clean.charAt(0).toUpperCase()+clean.slice(1);
 const {day,month,year}=dateParts(date);
 return formatted+day+month+year;
}
export function assignOrderProtocol(state,order,load,driver,at){
 if(!driver?.id||!driver?.nome||!load) return '';
 const existing=load.protocolo||order?.protocolo||'';
 const existingDriver=load.protocoloMotoristaId||order?.protocoloMotoristaId||'';
 const reference=order?.criadaEm||load.criadaEm||at;
 const base=protocolBase(driver.nome,reference);
 if(!base)throw new Error('Nome do motorista ou data inválidos para o protocolo.');
 // Preserva os protocolos já despachados; corrige padrões anteriores só antes do despacho.
 const dispatched=!!(load.ordemEnviadaEm||load.fretePublicadaId||load.finalizadaEm);
 const currentFormat=existing===base||(existing.startsWith(base)&&/^\d{2,}$/.test(existing.slice(base.length)));
 if(existing&&existingDriver===driver.id&&(currentFormat||dispatched)){
  if(!load.protocolo)load.protocolo=existing;
  if(order&&!order.protocolo)order.protocolo=existing;
  return existing;
 }
 if(existing&&dispatched)throw new Error('O protocolo de uma ordem já enviada não pode ser alterado.');
 const occupied=new Set();
 for(const c of state.cargas||[]){
  if(c.id===load.id)continue;
  if(c.protocolo)occupied.add(c.protocolo);
  for(const h of c.protocoloHistorico||[])if(h.valor)occupied.add(h.valor);
 }
 let candidate=base,serial=2;
 while(occupied.has(candidate))candidate=base+String(serial++).padStart(2,'0');
 const history=[...(load.protocoloHistorico||[])];
 if(existing&&existing!==candidate)history.push({valor:existing,motoristaId:existingDriver,substituidoEm:at});
 const generatedAt=at||new Date().toISOString();
 const entry={protocolo:candidate,protocoloMotoristaId:driver.id,protocoloDataReferencia:reference,protocoloGeradoEm:generatedAt,protocoloHistorico:history};
 Object.assign(load,entry);
 if(order)Object.assign(order,{...entry,protocoloHistorico:structuredClone(history)});
 return candidate;
}
