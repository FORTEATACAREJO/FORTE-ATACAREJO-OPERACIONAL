import {supplierPalletRule,SUPPLIER_PALLET_OPTIONS} from './supplier-pallet-preferences.mjs';
import {financialSummary} from './pedidos-ft-finance.mjs';

const rows=(state,key)=>Array.isArray(state?.[key])?state[key]:[];
const numeric=v=>Number.isFinite(Number(v))&&Number(v)>=0?Number(v):0;
const keyFor=v=>String(v?.produtoId||v?.produto||'').trim();
const isCancelled=v=>/CANCELAD/.test(String(v?.status||'').toUpperCase());
export const palletLabel=rule=>SUPPLIER_PALLET_OPTIONS.find(o=>o.orderRule===rule)?.label||rule||'Não configurado';

export function quantityReconciliation(items,sales){
 const totals=new Map();let invalid=false;
 for(const i of items||[]){
  const id=keyFor(i),q=Number(i.qtd);if(!id||!Number.isFinite(q)||q<=0||!Number.isInteger(q))invalid=true;
  if(id)totals.set(id,{produtoId:id,produto:i.produto||id,comprado:(totals.get(id)?.comprado||0)+numeric(i.qtd),distribuido:0});
 }
 for(const v of sales||[]){
  const id=keyFor(v),q=Number(v.qtd);if(!id||!Number.isFinite(q)||q<=0||!Number.isInteger(q))invalid=true;
  if(!id)continue;
  const entry=totals.get(id)||{produtoId:id,produto:v.produto||id,comprado:0,distribuido:0};
  entry.distribuido+=numeric(v.qtd);totals.set(id,entry);
 }
 const details=[...totals.values()].map(r=>({...r,saldo:r.comprado-r.distribuido}));
 const comprado=details.reduce((n,r)=>n+r.comprado,0),distribuido=details.reduce((n,r)=>n+r.distribuido,0);
 const over=details.some(r=>r.saldo<0)||invalid;
 const complete=details.length>0&&comprado>0&&!over&&details.every(r=>r.saldo===0);
 return {details,comprado,distribuido,saldo:comprado-distribuido,status:over?'DIVERGENTE':complete?'CONCILIADA':'PENDENTE'};
}

function pertainsToLoad(item,c,order){
 if(item.cargaId)return item.cargaId===c.id&&(!item.compraFornecedorId||!order||item.compraFornecedorId===order.id);
 return Boolean(order&&item.compraFornecedorId===order.id);
}

export function buildPedidosFTDossier(state,cargaId){
 const c=rows(state,'cargas').find(x=>x.id===cargaId);
 if(!c)return null;
 const order=rows(state,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId||o.cargaId===c.id)||null;
 const supplier=rows(state,'fornecedores').find(x=>x.id===(c.fornecedorId||order?.fornecedorId))||null;
 const driver=rows(state,'motoristas').find(x=>x.id===c.motoristaId)||null;
 const sold=rows(state,'vendas').filter(v=>!isCancelled(v)&&(
  v.cargaId===c.id||(!v.cargaId&&(c.vendaIds||[]).includes(v.id))
 ));
 const items=order?.itens?.length?order.itens:c.itensPedido?.length?c.itensPedido:c.itens||[];
 const reconciliation=quantityReconciliation(items,sold);
 const finance=financialSummary({carga:c,order,sales:sold});
 const docs=rows(state,'documentos').filter(d=>pertainsToLoad(d,c,order));
 const chats=rows(state,'comunicacoes').filter(j=>pertainsToLoad(j,c,order));
 const returns=rows(state,'retornosFornecedor').filter(r=>pertainsToLoad(r,c,order));
 const clients=new Map();
 for(const v of sold){
  const id=String(v.clienteId||v.cliente||v.id);
  const match=rows(state,'clientes').find(x=>x.id===v.clienteId);
  if(!clients.has(id))clients.set(id,{id,nome:match?.nomeFantasia||match?.fantasia||match?.nome||v.cliente||'Cliente',cidade:match?.cidade||'',uf:match?.uf||'',items:[],documents:[]});
  clients.get(id).items.push({id:v.id,produto:v.produto,produtoId:v.produtoId,qtd:numeric(v.qtd),precoUnitario:v.precoUnitario,condicaoPagamento:v.condicaoPagamento||v.formaPagamento||'',numeroVenda:v.numeroVenda});
 }
 for(const d of docs){
  const client=clients.get(String(d.clienteId||''));
  if(client)client.documents.push(d);
  else if(d.vendaId){const match=[...clients.values()].find(x=>x.items.some(i=>i.id===d.vendaId));if(match)match.documents.push(d);}
 }
 const preferenceRule=supplierPalletRule(supplier);
 const rule=preferenceRule||c.regraPallets||order?.regraPallets||'';
 const pallets=typeof c.palletQuantidade==='number'?c.palletQuantidade:typeof order?.palletQuantidade==='number'?order.palletQuantidade:null;
 const palletMismatch=Boolean(preferenceRule&&c.regraPallets&&preferenceRule!==c.regraPallets);
 const requested=rule.startsWith('Solicitar');
 const evidence=c.liberacaoPalletsFornecedor?.evidencia||order?.liberacaoPalletsFornecedor?.evidencia||null;
 const palletStatus=!preferenceRule?'PREFERÊNCIA NÃO CONFIGURADA':palletMismatch?'DIVERGÊNCIA COM CADASTRO':requested&&!evidence?'AGUARDANDO LIBERAÇÃO':pallets==null?'QUANTIDADE NÃO CONFERIDA':'REGRA CADASTRADA';
 const timeline=[];
 const add=(when,label,kind)=>{const t=Date.parse(when);if(Number.isFinite(t))timeline.push({when,label,kind});};
 add(order?.criadaEm||c.criadaEm,'Pedido cadastrado','PEDIDO');
 for(const j of chats) add(j.createdAt||j.sentAt,'Comunicação '+(j.canal||'')+' • '+(j.state||'pendente'),'MENSAGEM');
 for(const r of returns) add(r.receivedAt,'Resposta do fornecedor • '+(r.state||'a conferir'),'RESPOSTA');
 for(const d of docs) add(d.receivedAt||d.criadaEm,'Documento: '+(d.categoria||d.filename||'anexo'),'DOCUMENTO');
 for(const h of c.historicoOperacao||[])add(h.at,'Operação atualizada','CARGA');
 timeline.sort((a,b)=>Date.parse(b.when)-Date.parse(a.when));
 return {
  carga:c,order,supplier,driver,items,sales:sold,clients:[...clients.values()],
  documents:docs,communications:chats,returns,reconciliation,finance,
  pallets:{rule,label:palletLabel(rule),quantity:pallets,status:palletStatus,needsRelease:requested&&!evidence},
  timeline:timeline.slice(0,30)
 };
}
