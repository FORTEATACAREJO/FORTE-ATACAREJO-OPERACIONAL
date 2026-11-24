// A seleção no PEDIDOS FT nunca ativa cadastros ou ignora aprovação no servidor.
// O vínculo operacional definitivo também é conferido pelo orders-workflow.
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const blocked=/PENDENTE|ANALISE|RECUSAD|CONFEREN|AGUARDANDO|INATIVO|LEGADO|BLOQUEAD/;

export function isDriverSelectable(m){
 if(!m||m.ativo!==true||!m.id)return false;
 return !blocked.test(normalize([m.statusCadastro,m.status_ia].filter(Boolean).join(' ')));
}
export function isDriverDraftSelectable(m){
 return isDriverSelectable(m)||!!(m?.id&&m.cadastroAdministrativoLiberado===true&&m.documentosConferidos!==true&&m.bloqueadoGestor!==true&&!/INATIVO|BLOQUEAD|RECUSAD/.test(normalize([m.statusCadastro,m.status_ia].filter(Boolean).join(' '))));
}
export function driverOptionsFrom(drivers=[],{draft=false}={}){
 const seen=new Set();
 return drivers.filter(draft?isDriverDraftSelectable:isDriverSelectable).filter(m=>{const key=m.freteMotoristaId||m.id;if(seen.has(key))return false;seen.add(key);return true;}).map(m=>({
  value:m.id,
  label:(m.nome||'Motorista')+(draft&&!isDriverSelectable(m)?' • cadastro ativo, documentos a conferir':' • '+(m.placa1||'placa pendente'))+
   ' • limite '+Number(m.capacidadeMaximaKg||m.capacidadeAlvoKg||m.capacidade_operacional_kg||0).toLocaleString('pt-BR')+' kg',
  search:[m.nome,m.cpf,m.placa1,m.placa2,m.placa3,m.placa4].join(' ')
 }));
}
