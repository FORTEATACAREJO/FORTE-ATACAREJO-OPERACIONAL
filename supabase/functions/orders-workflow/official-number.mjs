// A reference is reserved globally in the operational company, not just per supplier.
export const officialNumberKey=v=>String(v??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,'');
export function officialNumberConflict(state,number,{cargaId='',orderId=''}={}){
 const key=officialNumberKey(number);if(!key)return null;
 const loads=state.cargas||[],orders=state.comprasFornecedor||[];
 const belongs=c=>Boolean((cargaId&&c.id===cargaId)||(orderId&&c.compraFornecedorId===orderId));
 const sameOrder=o=>Boolean((orderId&&o.id===orderId)||(cargaId&&o.cargaId===cargaId)||loads.some(c=>belongs(c)&&c.compraFornecedorId===o.id));
 const load=loads.find(c=>!belongs(c)&&officialNumberKey(c.numeroPedidoFornecedor)===key);
 if(load)return {os:load.numeroOS||load.codigo||load.id,cargaId:load.id};
 const order=orders.find(o=>!sameOrder(o)&&officialNumberKey(o.numeroPedidoFornecedor)===key);
 return order?{os:order.numero||order.id,cargaId:order.cargaId}:null;
}
export function assertOfficialNumberAvailable(state,number,owner){
 const conflict=officialNumberConflict(state,number,owner);
 if(conflict)throw Error('Número do fornecedor já utilizado em outra carga: OS '+conflict.os+'. Exclua o vínculo anterior antes de reutilizar.');
}
export function releaseOfficialNumber(state,{orderId,cargaId,number,reason,actor,at,id}){
 const orders=state.comprasFornecedor||[],loads=state.cargas||[];
 const order=orders.find(o=>o.id===orderId);
 const load=loads.find(c=>c.id===cargaId&&(!orderId||c.compraFornecedorId===orderId||order?.cargaId===c.id));
 if(!load||orderId&&!order)throw Error('Vínculo não localizado.');
 const key=officialNumberKey(number),refs=[load.numeroPedidoFornecedor,order?.numeroPedidoFornecedor].filter(v=>officialNumberKey(v));
 if(!key||!refs.length||refs.some(v=>officialNumberKey(v)!==key))throw Error('O número foi alterado. Atualize a OS.');
 if(String(reason||'').trim().length<5)throw Error('Informe o motivo da exclusão do vínculo (mínimo 5 caracteres).');
 if(load.finalizadaEm||load.fretePublicadaId||load.ordemEnviadaEm||load.ordemMotoristaEnviada||load.notaFiscalId||load.numeroNotaFiscal||load.chaveNfe||(state.notasFiscais||[]).some(n=>n.cargaId===load.id)||(state.documentos||[]).some(d=>d.cargaId===load.id&&['XML NF','PDF NF','BOLETO FORNECEDOR','COMPROVANTE FRETE','COMPROVANTE ENVIO MOTORISTA','COMPROVANTE ENTREGA'].includes(d.categoria))||(state.comunicacoes||[]).some(j=>j.cargaId===load.id&&['SENDING','UNCERTAIN','SENT','ACCEPTED','DELIVERED','READ'].includes(j.state)&&j.audience==='MOTORISTA'))throw Error('Carga com expedição, faturamento ou documento vinculado exige revisão administrativa/fiscal antes da exclusão.');
 const event={id,acao:'EXCLUSÃO DO VÍNCULO DO PEDIDO DO FORNECEDOR',numero:refs[0],evidencia:order?.evidenciaRetorno||load.evidenciaPedido||'',motivo:String(reason).trim(),actor,at};
 if(order){order.historico=[...(order.historico||[]),event];order.numeroPedidoFornecedor='';delete order.evidenciaRetorno;delete order.confirmadoEm;delete order.confirmadoPor;if(order.status!=='CANCELADO')order.status='AGUARDANDO RETORNO DO FORNECEDOR';}
 load.historicoOperacao=[...(load.historicoOperacao||[]),event];load.numeroPedidoFornecedor='';for(const k of ['pedidoConfirmadoEm','pedidoConfirmadoPor','evidenciaPedido','ordemRevisadaEm','ordemRevisadaPor'])delete load[k];if(load.status!=='CANCELADA')load.fase='AGUARDANDO RETORNO DO FORNECEDOR';
 for(const j of state.comunicacoes||[])if(j.cargaId===load.id&&j.audience==='MOTORISTA'&&['QUEUED','BLOCKED','FAILED'].includes(j.state)){j.state='CANCELLED';j.reason='NÚMERO DO FORNECEDOR DESVINCULADO';}
 return {cargaId:load.id,id:order?.id,numeroExcluido:refs[0],motivo:event.motivo};
}
