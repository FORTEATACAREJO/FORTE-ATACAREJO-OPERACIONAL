// Exclusão de uma OS de teste sem efeitos externos. Não apaga cadastros,
 // vendas, documentos fiscais ou registros de auditoria.
const list=(s,k)=>Array.isArray(s[k])?s[k]:[];
const fail=m=>{throw Error(m);};
const removable=new Set(['QUEUED','BLOCKED','CANCELLED']);
export function purgeTestOrder(s,b,p){
 if(p.perfil!=='MASTER')fail('Exclusão definitiva exclusiva do MASTER.');
 const c=list(s,'cargas').find(x=>x.id===b.cargaId);
 if(!c)fail('Carga não localizada.');
 const orders=list(s,'comprasFornecedor').filter(o=>o.id===c.compraFornecedorId||o.cargaId===c.id);
 if(orders.length!==1)fail('Pedido sem vínculo único: exige revisão.');
 const o=orders[0],os=o.numero||c.numeroOS;
 if(!os||b.confirmacao!==os||b.testeConfirmado!==true)fail('Confirme que é teste e digite exatamente a OS.');
 if(c.finalizadaEm||c.estoqueConsolidado||c.fretePublicadaId||c.ordemEnviadaEm||c.ordemMotoristaEnviada||c.numeroPedidoFornecedor||o.numeroPedidoFornecedor||o.envioAceitoEm||o.envioComprovadoEm||c.notaFiscalId||c.numeroNotaFiscal||o.notaFiscalId)fail('Pedido com efeito fiscal, logístico ou envio confirmado: exige revisão e cancelamento, não exclusão direta.');
 const refs=new Set([c.id,o.id,os,c.codigo].filter(Boolean));
 const matches=x=>typeof x==='string'?refs.has(x):Array.isArray(x)?x.some(matches):x&&typeof x==='object'?Object.values(x).some(matches):false;
 const relatedSales=list(s,'vendas').filter(v=>v.cargaId===c.id||(c.vendaIds||[]).includes(v.id));
 const groups=new Set(relatedSales.map(v=>v.grupoPedidoId||v.id));
 if(relatedSales.some(v=>v.cargaId&&v.cargaId!==c.id||v.nf||v.numeroNF||v.notaFiscalId||v.numeroNotaFiscal||v.chaveNfe||v.nfeId||v.entregueEm||/FATURAD|LIQUIDAD|ENTREGUE|PAGO|RECEBID/i.test(v.status||''))||list(s,'vendas').some(v=>groups.has(v.grupoPedidoId||v.id)&&!relatedSales.includes(v)))fail('Venda com vínculo inconsistente ou efeito financeiro/fiscal: exige revisão.');
 const saleRefs=new Set([...relatedSales.map(v=>v.id),...groups]);
 const saleLinked=x=>saleRefs.has(x.vendaId)||x.vendaIds?.some(id=>saleRefs.has(id));
 for(const key of ['documentos','notasFiscais','contasReceber','contasPagar','boletosClientes','boletosFornecedores','comprovantesClientes','estoqueMov','pagamentosFretes']){
  if(list(s,key).some(x=>matches(x)||saleLinked(x)))fail('Existe vínculo em '+key+'. Exclusão direta bloqueada.');
 }
 const jobs=list(s,'comunicacoes').filter(matches);
 if(jobs.some(j=>!removable.has(j.state)||j.providerId||j.sentAt||j.attemptAt))fail('Existe envio realizado ou tentado. Confira o destinatário antes de cancelar.');
 // Fail closed for references in collections not explicitly handled. Never delete
 // shared records, emails or external documents based on a guessed relationship.
 const handled=new Set(['cargas','comprasFornecedor','vendas','comunicacoes','auditoria','workflowEvents','settings']);
 for(const [key,value] of Object.entries(s))if(!handled.has(key)&&Array.isArray(value)&&value.some(matches))fail('Existe vínculo adicional em '+key+'. Exclusão direta bloqueada.');
 if(list(s,'cargas').some(x=>x.id!==c.id&&matches(x))||list(s,'comprasFornecedor').some(x=>x.id!==o.id&&matches(x))||list(s,'vendas').some(x=>!relatedSales.includes(x)&&matches(x)))fail('Existe referência em outra operação.');
 const motivo=String(b.motivo||'').trim();if(motivo.length<5||motivo.length>500)fail('Informe o motivo da exclusão.');
 s.cargas=list(s,'cargas').filter(x=>x.id!==c.id);
 s.comprasFornecedor=list(s,'comprasFornecedor').filter(x=>x.id!==o.id);
 s.comunicacoes=list(s,'comunicacoes').filter(x=>!jobs.includes(x));
 for(const v of relatedSales){v.cargaId='';v.destinoPainel='AGUARDANDO ROTEAMENTO';}
 const seq=/^OS-(\d+)$/.exec(os);if(seq){const next=Math.max(Number(s.settings?.nextOsSeq)||1,Number(seq[1])+1);s.settings={...s.settings,nextOsSeq:next};}
 return {os,cargaId:c.id,pedidoId:o.id,vendasDesvinculadas:relatedSales.length,enviosRemovidos:jobs.length,motivo,warning:'OS de teste excluída; vendas, cadastros, numeração e auditoria preservados.'};
}
