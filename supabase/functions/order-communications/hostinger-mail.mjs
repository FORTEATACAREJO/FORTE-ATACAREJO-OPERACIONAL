// Envio de pedidos pelo e-mail corporativo existente na Hostinger.
// Nunca expor o token no cliente nem repetir automaticamente envios com resultado incerto.
export const HOSTINGER_ORDER_SENDER='contato@forteatacarejo.com.br';
const api='https://api.mail.hostinger.com/api/v1';
const requestHeaders=token=>({Authorization:'Bearer '+token,'Content-Type':'application/json'});
const deadline=ms=>AbortSignal.timeout(ms);

export async function hostingerMailbox(token,{fetcher=fetch}={}){
 if(!token)throw Error('Hostinger ainda não autorizada no servidor do FORTE ATENDE.');
 const res=await fetcher(api+'/me',{method:'GET',headers:{Authorization:'Bearer '+token},signal:deadline(15000)});
 if(!res.ok)throw Error(res.status===401||res.status===403?'A credencial da Hostinger requer nova autorização.':'Não foi possível conferir a caixa da Hostinger (HTTP '+res.status+').');
 const result=await res.json();
 const selected=result?.data?.mailboxes?.find(row=>String(row.address||'').toLowerCase()===HOSTINGER_ORDER_SENDER);
 if(!selected?.resourceId)throw Error('A conta autorizada não possui a caixa de e-mail contato@forteatacarejo.com.br.');
 return {mailboxResourceId:selected.resourceId,address:HOSTINGER_ORDER_SENDER};
}

function encodeBase64(bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const blocks=[];
 for(let i=0;i<data.length;i+=8192)blocks.push(String.fromCharCode(...data.subarray(i,i+8192)));
 return btoa(blocks.join(''));
}

export function supplierEmailPayload(job,pdf){
 const to=String(job?.to||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw Error('E-mail do fornecedor inválido.');
 if(!job?.id||!job?.reference)throw Error('Pedido sem identificação para envio.');
 const filename=String(job.reference).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,70)||'pedido';
 return {
  displayName:'Forte Atacarejo',
  to:[to],
  subject:'Pedido '+String(job.reference).replace(/[\r\n]/g,' ').slice(0,130),
  text:String(job.message||''),
  attachments:[{filename:filename+'.pdf',content:encodeBase64(pdf),contentType:'application/pdf'}]
 };
}

export async function sendSupplierEmailHostinger(token,job,pdf,{fetcher=fetch}={}){
 const mailbox=await hostingerMailbox(token,{fetcher});
 const url=api+'/mailboxes/'+encodeURIComponent(mailbox.mailboxResourceId)+'/send';
 const res=await fetcher(url,{method:'POST',headers:requestHeaders(token),body:JSON.stringify(supplierEmailPayload(job,pdf)),signal:deadline(25000)});
 if(!res.ok)throw Error('A Hostinger não confirmou o envio do pedido (HTTP '+res.status+'). Confira os enviados antes de qualquer nova tentativa.');
 // 204: aceito para envio pela Hostinger, não é prova de entrega na caixa do destinatário.
 return 'hostinger:pedido:'+job.id;
}
