export const sectors=['VENDAS','FINANCEIRO','FISCAL','PEDIDOS','FRETES'];
export const sectorLabels={VENDAS:'Vendas e orçamentos',FINANCEIRO:'Financeiro e boletos',FISCAL:'Notas fiscais',PEDIDOS:'Pedidos e fornecedores',FRETES:'Fretes e carregamentos'};
export function agentName(profile){const name=String(profile?.nome||'').replace(/[\r\n*\x00-\x1f]/g,' ').trim().replace(/\s+/g,' ').slice(0,100);if(!name)throw Error('Nome do atendente não cadastrado.');return name;}
export function requireOwner(thread,user){if(thread.assignedTo&&thread.assignedTo!==user.id)throw Error('Atendimento atribuído a outro usuário. Solicite transferência.');}
export function buildReply({profile,kind='REPLY',text='',commandId}){
 const name=agentName(profile),prefix='*'+name+':*\n';
 if(kind==='REPLY'){const raw=String(text).trim();if(!raw||prefix.length+raw.length>4096)throw Error('Informe uma resposta dentro do limite de caracteres.');return {text:prefix+raw,originalText:raw,kind};}
 if(kind==='WELCOME'){const body=prefix+'Olá! Seja bem-vindo à FORTE ATACAREJO. Selecione o setor desejado:';return {text:body,originalText:'',kind,interactive:{type:'list',body:{text:body},action:{button:'Escolher setor',sections:[{title:'Setores',rows:sectors.map(s=>({id:'fa-sector:'+commandId+':'+s,title:sectorLabels[s]}))}]}}};}
 if(kind==='CLOSE'){const body=prefix+'A FORTE ATACAREJO agradece o seu contato! Estamos à disposição. Como você avalia nosso atendimento?';return {text:body,originalText:'',kind,interactive:{type:'list',body:{text:body},action:{button:'Avaliar atendimento',sections:[{title:'Avaliação de 1 a 5',rows:[1,2,3,4,5].map(n=>({id:'fa-rating:'+commandId+':'+n,title:n+' '+(n===1?'estrela':'estrelas')}))}]}}};}
 throw Error('Tipo de resposta inválido.');
}
export function recordInteractiveReply(thread,messages,message,at){
 const token=message.interactive?.list_reply?.id;if(typeof token!=='string')return false;
 const match=/^fa-(sector|rating):([0-9a-f-]{36}):([A-Z]+|[1-5])$/i.exec(token);if(!match)return false;
 const [,type,commandId,value]=match,source=messages.find(m=>m.id==='reply:'+commandId&&m.threadId===thread.id&&m.direction==='OUT'&&m.providerId&&m.providerId===message.context?.id&&['SENT','DELIVERED','READ'].includes(m.state));
 if(!source||source.kind!==(type==='rating'?'CLOSE':'WELCOME'))return false;
 if(type==='rating'){if(!/^[1-5]$/.test(value)||source.rating)return false;source.rating={score:Number(value),at,externalId:message.id,agentId:source.actor,agentName:source.actorName};return true;}
 if(!sectors.includes(value)||source.sectorSelected)return false;source.sectorSelected={sector:value,at,externalId:message.id};thread.sector=value;thread.state='PENDENTE';return true;
}
