import {officialNumberConflict} from './official-number.mjs';
const digits=v=>String(v||'').replace(/\D/g,'');
export function phone(v){let n=digits(v);if(n.length===10||n.length===11)n='55'+n;return /^\d{12,15}$/.test(n)?n:'';}
export function supplierConfirmationChannel(supplier){
 const configured=String(supplier?.canalConfirmacao||'').toUpperCase();
 return ['EMAIL','WHATSAPP'].includes(configured)?configured:'';
}
export function purchaseSnapshot(o){return JSON.stringify({id:o.id,numero:o.numero,protocolo:o.protocolo||'',modalidadeCompra:o.modalidadeCompra,motoristaSnapshot:o.motoristaSnapshot,fornecedorSnapshot:o.fornecedorSnapshot,liberacaoPalletsFornecedor:o.liberacaoPalletsFornecedor,fornecedorId:o.fornecedorId,unidadeId:o.unidadeId,cnpjComprador:o.cnpjComprador,codigoFornecedor:o.codigoFornecedor,motoristaId:o.motoristaId,placas:o.placas,itens:o.itens,origem:o.origem,destino:o.destino,pagamento:o.pagamento,modalidadeFrete:o.modalidadeFrete,regraPallets:o.regraPallets,palletQuantidade:o.palletQuantidade});}
export function itemsText(rows){return rows.map(v=>`${v.qtd} ${v.unidadeMedida||'sacos'} de ${v.produto}`).join('; ');}
export const CUSTOMER_AUTOMATIC_MESSAGES_ENABLED=false;
export function queueCustomer(s,rows,kind,event,at,previous){
 if(!CUSTOMER_AUTOMATIC_MESSAGES_ENABLED)return;
 const first=rows[0];if(!first)return;
 const customer=(s.clientes||[]).find(c=>c.id===first.clienteId);
 const to=phone(customer?.whatsapp||customer?.telefone||first.clienteWhatsapp);
 const descriptions=itemsText(rows),reference=first.numeroVenda||first.grupoPedidoId||first.id;
 const message=kind==='AJUSTE'?`FORTE ATACAREJO — Pedido ${reference}. Seu pedido de ${previous} foi ajustado para ${descriptions} para efeito de carregamento.`:kind==='CARREGAMENTO'?`FORTE ATACAREJO — Pedido ${reference}. Seu pedido de ${descriptions} está em carregamento.`:kind==='ENTREGA'?`FORTE ATACAREJO — Pedido ${reference}. Você confirma ter recebido ${descriptions}?`: `FORTE ATACAREJO — Pedido ${reference}. Seu pedido de ${descriptions} foi registrado com sucesso.`;
 const key=event+':'+(first.grupoPedidoId||first.id)+':'+kind;
 s.comunicacoes??=[];if(s.comunicacoes.some(j=>j.key===key))return;
 // No prices, totals, rates or payment conditions are copied into customer messages.
 s.comunicacoes.push({id:key,key,kind,audience:'CLIENTE',canal:'WHATSAPP',to,clienteId:first.clienteId,cliente:first.cliente,vendaIds:rows.map(v=>v.id),cargaId:first.cargaId||'',message,items:rows.map(v=>({produtoId:v.produtoId,produto:v.produto,qtd:v.qtd})),reference,replyToken:kind==='ENTREGA'?event+':'+first.id:null,state:to&&customer?.whatsappAutorizado===true?'QUEUED':'BLOCKED',reason:!to?'WHATSAPP NÃO CADASTRADO':customer?.whatsappAutorizado!==true?'AUTORIZAÇÃO DO CLIENTE PENDENTE':'',createdAt:at});
}
export function queueLoading(s,c,event,at){const groups=new Map();for(const v of s.vendas||[]){if(!(c.vendaIds||[]).includes(v.id))continue;const k=v.grupoPedidoId||v.id;groups.set(k,[...(groups.get(k)||[]),v]);}for(const rows of groups.values())queueCustomer(s,rows,'CARREGAMENTO',event,at);}
export function linkedReturn(s,{providerId,contextId,from,text,at}){
 if((s.retornosFornecedor||[]).some(r=>r.providerId===providerId))return false;
 const body=String(text||'').slice(0,12000),osRefs=[...new Set([...body.matchAll(/\bOS[-\s]?(\d{3,12})\b/gi)].map(m=>'OS-'+m[1].padStart(6,'0')))];
 const orders=s.comprasFornecedor||[],suppliers=s.fornecedores||[];
 const eligible=j=>{const o=orders.find(o=>o.id===j.compraFornecedorId),f=suppliers.find(f=>f.id===o?.fornecedorId);return j.audience==='FORNECEDOR'&&j.canal==='WHATSAPP'&&phone(j.to)===phone(from)&&['SENT','DELIVERED','READ'].includes(j.state)&&(!f||supplierConfirmationChannel(f)!=='EMAIL'&&(!phone(f.whatsapp||f.telefone)||phone(f.whatsapp||f.telefone)===phone(from)));};
 const direct=(s.comunicacoes||[]).filter(j=>contextId&&j.providerId===contextId&&eligible(j));
 const jobs=direct.length||contextId?direct:osRefs.length===1?(s.comunicacoes||[]).filter(j=>eligible(j)&&orders.some(o=>o.id===j.compraFornecedorId&&o.numero===osRefs[0])):[];
 const r={providerId,contextId,from:phone(from),text:String(text||'').slice(0,12000),receivedAt:at,state:'CONFERIR',reason:'RETORNO SEM VÍNCULO INEQUÍVOCO'};
 if(jobs.length&&new Set(jobs.map(j=>j.compraFornecedorId)).size===1){const j=jobs[0],o=(s.comprasFornecedor||[]).find(o=>o.id===j.compraFornecedorId);r.compraFornecedorId=o?.id;r.cargaId=o?.cargaId;
  const matches=[...r.text.matchAll(/(?:pedido\s*(?:n[ºo.]?\s*)?[:#-]?\s*)([0-9][0-9A-Za-z/-]{1,39})/gi)].map(m=>m[1]);
  const standalone=contextId&&/^\s*\d{5,20}\s*$/.test(r.text)?r.text.trim():'';
  const unique=[...new Set([...matches,standalone].filter(Boolean))];
  const c=(s.cargas||[]).find(c=>c.id===o?.cargaId);
  if(!/cancelad|cancelamento|n[aã]o\s+(?:[ée]|foi|confirm)/i.test(r.text)&&o&&(!osRefs.length||osRefs.length===1&&osRefs[0]===o.numero)&&c&&!c.finalizadaEm&&unique.length===1&&!o.numeroPedidoFornecedor&&!officialNumberConflict(s,unique[0],{cargaId:c.id,orderId:o.id})&&!c.numeroPedidoFornecedor&&c.status!=='CANCELADA'&&o.status!=='CANCELADO'){
   o.numeroPedidoFornecedor=unique[0];o.status='AGUARDANDO NOTAS FISCAIS';o.evidenciaRetorno='WHATSAPP | '+providerId;o.confirmadoEm=at;o.confirmadoPor='RETORNO WHATSAPP VINCULADO';c.numeroPedidoFornecedor=unique[0];c.fase=o.status;c.pedidoConfirmadoEm=at;c.pedidoConfirmadoPor=o.confirmadoPor;r.state='VINCULADO';r.reason=contextId?'RESPOSTA AO ENVIO ORIGINAL':'OS EXPLÍCITA NO RETORNO DO FORNECEDOR';
  }else r.reason='CONFIRA O NÚMERO OFICIAL DO FORNECEDOR';
 }
 s.retornosFornecedor=[...(s.retornosFornecedor||[]),r];return true;
}
export function deliveryReply(s,{id,from,contextId,payload,at}){
 const matches=(s.comunicacoes||[]).filter(j=>j.kind==='ENTREGA'&&j.providerId===contextId&&phone(j.to)===phone(from)&&['SENT','DELIVERED','READ'].includes(j.state)&&(payload===j.replyToken+':SIM'||payload===j.replyToken+':NAO'));
 if(matches.length!==1)return false;const j=matches[0];if(j.reply)return false;
 j.reply={providerId:id,from:phone(from),answer:payload.endsWith(':SIM')?'SIM':'NÃO',receivedAt:at,items:structuredClone(j.items),reference:j.reference,cargaId:j.cargaId};
 s.auditoria=[...(s.auditoria||[]),{id,acao:'CONFIRMAÇÃO DE ENTREGA WHATSAPP',dataHora:at,detalhe:j.id+' — '+j.reply.answer,usuario:'CLIENTE'}];return true;
}
