// A seleção no PEDIDOS FT nunca ativa cadastros ou ignora aprovação no servidor.
// O vínculo operacional definitivo também é conferido pelo orders-workflow.
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const blocked=/PENDENTE|ANALISE|RECUSAD|CONFEREN|AGUARDANDO|INATIVO|LEGADO|BLOQUEAD|REPROVADO/;

export function isDriverSelectable(m){
 if(!m||m.ativo!==true||!m.id)return false;
 return !blocked.test(normalize([m.statusCadastro,m.status_ia].filter(Boolean).join(' ')));
}
export function isDriverDraftSelectable(m){
 return isDriverSelectable(m)||!!(m?.id&&m.cadastroAdministrativoLiberado===true&&m.documentosConferidos!==true&&m.bloqueadoGestor!==true&&!/INATIVO|BLOQUEAD|RECUSAD|REPROVADO/.test(normalize([m.statusCadastro,m.status_ia].filter(Boolean).join(' '))));
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

 // Avisos informativos: não alteram o cadastro, nem o critério de seleção.
export function driverRegistrationWarnings(m={},today=new Date().toISOString().slice(0,10)){
 const digits=v=>String(v||'').replace(/\D/g,'');
 const notices=[];
 if(digits(m.cpf).length!==11)notices.push('CPF não informado ou incompleto');
 if(digits(m.cnhNumero||m.cnh).length!==11)notices.push('Registro CNH não informado ou incompleto');
 const category=normalize(m.cnhCategoria||m.categoria_cnh).trim();
 if(!category)notices.push('Categoria CNH não informada');
 else if(!/^(A?[CDE])$/.test(category))notices.push('Conferir compatibilidade da categoria CNH com o conjunto');
 const validity=String(m.cnhValidade||m.validade_cnh||'').slice(0,10);
 if(validity&&/^\d{4}-\d{2}-\d{2}$/.test(validity)&&validity<today)notices.push('CNH com data de validade vencida — conferir situação antes de dirigir');
 if(digits(m.telefone||m.whatsapp).length<10)notices.push('Telefone não informado ou incompleto');
 if(m.enderecoInformado===false)notices.push('Endereço não informado');
 if(m.documentosConferidos!==true)notices.push('Documentação pessoal a conferir');
 return notices;
}
