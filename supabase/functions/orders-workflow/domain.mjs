import {checkLoadSaleProducts} from './load-sale-products.mjs';
import {assertOfficialNumberAvailable,officialNumberKey,releaseOfficialNumber} from './official-number.mjs';
import {customerPurchaseOrder} from './customer-purchase-order.mjs';
import {paymentDays,paymentLabel,paymentKey,paymentOptions,paymentSchedule} from './supplier-payment-terms.mjs';
import {supplierPalletRule} from './supplier-pallet-preferences.mjs';
import {supplierBuyerCode,requireSupplierBuyerCode,buyerCnpj} from './supplier-buyer-codes.mjs';
import {isResaleProduct,supplierProducts,supplierProductTerms} from './supplier-catalog.mjs';
export {isResaleProduct,supplierProducts} from './supplier-catalog.mjs';
import {queueDriverOrder} from './driver-dispatch.mjs';
import {linkFreightReceipt,receiptSyncResult} from './freight-receipts.mjs';
import {sheetAction,linkSales,terminalSale} from './operation-sheet.mjs';
import {requireCapacity,isProvisionalCommercialOrder} from './capacity.mjs';
import {PURCHASE_MODES,driverSnapshot,supplierSnapshot,canEditPurchase,palletReleaseNeeded,supplierWasSent} from './complements.mjs';
import {purchaseSnapshot,queueCustomer,queueLoading,itemsText,phone} from './communications.mjs';
import {assignOrderProtocol} from './order-protocol.mjs';
import {requireSupplierFreightMode,assertFreightSnapshot} from './supplier-freight-mode.mjs';
export const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
export const PALLETS = ['Com pallets', 'Sem pallets', 'Leva pallets', 'Solicitar pallets com liberação do vendedor'];
export const DOCUMENTS = ['XML NF', 'PDF NF', 'BOLETO FORNECEDOR', 'BOLETO CLIENTE', 'NF PALLETS', 'COMPROVANTE FRETE', 'COMPROVANTE PAGAMENTO CLIENTE', 'COMPROVANTE ENVIO FORNECEDOR', 'COMPROVANTE ENVIO MOTORISTA', 'COMPROVANTE ENTREGA', 'ANEXO DA VENDA'];
const active = x => x.ativo !== false;
const arr = (s,k) => s[k] || [];
const cents = n => Math.round(Number(n) * 100) / 100;
const fail = msg => { throw new Error(msg); };
const text = (v,label) => String(v || '').trim() || fail(`Informe ${label}.`);
const num = (v,label,zero=false) => { const n=Number(v); if(!Number.isFinite(n)||(zero?n<0:n<=0))fail(`Confira ${label}.`); return n; };
const integer = (v,label,zero=false) => {const n=num(v,label,zero);if(!Number.isSafeInteger(n))fail(`${label} deve ser inteiro.`);return n;};
const byId = (s,k,id,label) => arr(s,k).find(x=>x.id===id&&active(x)) || fail(`${label} não localizado ou inativo.`);
const cpfValidoOperacional = value => {
 const d=String(value||'').replace(/\D/g,'');
 if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
 const digit=n=>{let value=0;for(let i=0;i<n;i++)value+=Number(d[i])*(n+1-i);const r=value*10%11;return r===10?0:r;};
 return digit(9)===Number(d[9])&&digit(10)===Number(d[10]);
};
const dataCnh = value=>{
 const v=String(value||'').slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))?v:'';
};

const privileged = p => ['MASTER','ADMINISTRADOR'].includes(p.perfil);
export function supplierTerms(s,id,selected=''){
 const f=arr(s,'fornecedores').find(x=>x.id===id)||{};
 // Historicamente formaPagamentoPadrao também continha "14 DIAS". Preservar
 // esse legado como prazo, mas não incluir BOLETO/PIX como vencimentos.
 const legacy=norm(f.formaPagamentoPadrao);
 const isMethod=/^(BOLETO|PIX|TRANSFERENCIA|DEPOSITO|DINHEIRO|CARTAO|A COMBINAR|A PRAZO)$/.test(legacy);
 return paymentOptions([
  f.condicaoPagamento,
  ...(Array.isArray(f.prazosPagamento)?f.prazosPagamento:[f.prazosPagamento]),
  ...(!isMethod?[f.formaPagamentoPadrao]:[]),
  ...arr(s,'custosFornecedor').filter(c=>active(c)&&c.fornecedorId===id).map(c=>c.condicaoPagamento)
 ],selected);
}
export function supplierExpeditions(s,id) {
 const f=arr(s,'fornecedores').find(x=>x.id===id);
 const locations=arr(s,'locais').filter(active);
 return Array.isArray(f?.expedicoes)?locations.filter(l=>f.expedicoes.includes(l.id)):locations;
}
function assertSupplierExpedition(s,id,origin){
 const f=arr(s,'fornecedores').find(x=>x.id===id);
 if(Array.isArray(f?.expedicoes)&&!supplierExpeditions(s,id).some(l=>norm(l.nome)===norm(origin)))fail('Selecione uma expedição cadastrada neste fornecedor.');
}
export function supplierLocationPrices(s,id,product) {
 const supplier=arr(s,'fornecedores').find(f=>f.id===id);
 return (Array.isArray(supplier?.cotacoesPorLocal)?supplier.cotacoesPorLocal:[]).filter(row=>row?.produtoId===product);
}
export function supplierCost(s,id,product,mode='PADRAO',origin='',unitId='') {
 const f=arr(s,'fornecedores').find(x=>x.id===id);
 if(Array.isArray(f?.expedicoes)&&!supplierExpeditions(s,id).some(l=>norm(l.nome)===norm(origin)))return undefined;
 const scoped=supplierLocationPrices(s,id,product);
 if(scoped.length){
  const unit=arr(s,'unidades').find(u=>u.id===unitId);
  const location=arr(s,'locais').find(l=>active(l)&&norm(l.nome)===norm(origin));
  if(!location||!unit)return undefined;
  const matches=scoped.filter(q=>q.unidadeId===unitId&&q.cnpjComprador===buyerCnpj(unit)&&q.localCarregamentoId===location.id&&q.ativo!==false&&Number.isFinite(Number(q.precoUnitarioExibido))&&Number(q.precoUnitarioExibido)>0&&/^\d{4}-\d{2}-\d{2}$/.test(q.dataCotacao||''));
  const latest=matches.reduce((best,row)=>!best||row.dataCotacao>=best.dataCotacao?row:best,null);
  return latest?Number(latest.precoUnitarioExibido):undefined;
 }
 const negotiated=supplierProductTerms(s,id,product);
 if(negotiated)return negotiated.custoUnitario;
 const p=arr(s,'produtos').find(p=>p.id===product);
 return mode==='CSN_DIRETO'?p?.precoNegociadoCsnDireto:mode==='CSN_FIBRA'?p?.precoNegociadoCsnFibra:p?.precoNegociado;
}
export function palletQuantity(s,items,rule) {if(rule===PALLETS[1])return 0;return (items||[]).reduce((total,i)=>{const p=arr(s,'produtos').find(p=>p.id===i.produtoId),q=Number(i.qtd||0);if(!q)return total;const per=Number(p?.palletQtd||p?.qtdPorPallet||p?.sacosPorPallet||p?.unidadesPorPallet);if(!Number.isSafeInteger(per)||per<=0)fail('Cadastre a quantidade por pallet do produto '+(p?.nome||'selecionado')+'.');return total+Math.ceil(q/per);},0);}
export function salePrice(s,client,product){const p=arr(s,'produtos').find(x=>x.id===product);const c=arr(s,'precosClientes').find(x=>active(x)&&x.clienteId===client&&x.produtoId===product);return c?.precoFinal??cents(Number(p?.precoTabela||0)*(1-Number(c?.descontoPct||0)/100));}
export function validDriver(s,id,weight,pedido=false,linkedVehicle=null){
 const original=byId(s,'motoristas',id,'Motorista');
 // O veículo vinculado vem exclusivamente da consulta autenticada do servidor.
 // Nunca altera o cadastro independente do motorista.
 const m=linkedVehicle?{
  ...original,placa1:linkedVehicle.placa,placa2:'',placa3:'',placa4:'',
  capacidadeMaximaKg:Number(linkedVehicle.capacidade_kg)||0,
  capacidadeAlvoKg:Number(linkedVehicle.capacidade_kg)||0,
  veiculoId:linkedVehicle.id,vinculoFrotaId:linkedVehicle.vinculoId,
  transportadoraNome:linkedVehicle.transportadora_nome||'',
  transportadoraCnpj:linkedVehicle.transportadora_cnpj||''
 }:original;
 if(/PENDENTE|ANALISE|RECUSAD|CONFERENCIA|AGUARDANDO|INATIVO|BLOQUEAD/.test(norm(m.statusCadastro)))fail('Motorista aguarda aprovação.');
 if(m.documentosConferidos===true&&!linkedVehicle)fail('Motorista aprovado sem veículo vinculado. Vincule o veículo na aba Veículos antes de emitir ordem.');
 const capacity=num(m.capacidadeMaximaKg||m.capacidadeAlvoKg,'capacidade do conjunto');
 if(weight>capacity&&!pedido)fail('Peso acima da capacidade do conjunto.');
 if(!m.placa1)fail('Cadastre a placa do conjunto.');
 return m;
}
function pallets(s,b,p,at){if(!PALLETS.includes(b.regraPallets))fail('Selecione uma das quatro regras de pallets.');const suggested=palletQuantity(s,b.itens,b.regraPallets);const custom=b.palletQuantidadeAjustada;const qty=custom==null||custom===''?suggested:integer(custom,'Quantidade de pallets',true);if(b.regraPallets===PALLETS[1]&&qty!==0)fail('Sem pallets exige quantidade zero.');if(b.regraPallets!==PALLETS[1]&&qty<=0)fail('Informe a quantidade de pallets.');const reason=qty!==suggested?text(b.justificativaPallets,'justificativa do ajuste de pallets'):'';return {regraPallets:b.regraPallets,pallet:b.regraPallets,palletQuantidade:qty,pallets:qty,palletQuantidadeSugerida:suggested,palletQuantidadeAjustada:qty!==suggested?qty:'',justificativaPallets:reason,aprovacaoPallets:null,liberacaoPalletsFornecedor:null};}

function purchaseItems(s,b,p,at){assertSupplierExpedition(s,b.fornecedorId,b.origem);const mode=b.modalidadeCompra||'PADRAO';if(!PURCHASE_MODES.includes(mode))fail('Modalidade de compra inválida.');if(mode!=='PADRAO'&&!norm(byId(s,'fornecedores',b.fornecedorId,'Fornecedor').nome).includes('CSN'))fail('Direto/Fibra disponíveis somente para CSN.');const allowed=supplierProducts(s,b.fornecedorId);if(!b.itens?.length)fail('Inclua ao menos um produto.');const seen=new Set();return b.itens.map(i=>{if(seen.has(i.produtoId))fail('Consolide quantidades do mesmo produto.');seen.add(i.produtoId);const prod=allowed.find(x=>x.id===i.produtoId)||fail('Produto não vinculado ao fornecedor.');const qtd=integer(i.qtd,'Quantidade'),pesoKg=qtd*num(prod.pesoKg,'peso cadastrado do produto');const cost=supplierCost(s,b.fornecedorId,prod.id,mode,b.origem,b.unidadeId);if(cost==null&&supplierLocationPrices(s,b.fornecedorId,prod.id).length)fail('Cadastre o preço do produto para a unidade de expedição e CNPJ comprador selecionados.');const price=num(cost,'preço negociado no cadastro de produtos');if(i.custoUnitario!=null&&i.custoUnitario!==''&&Math.round(Number(i.custoUnitario)*10000)!==Math.round(price*10000))fail('Preço negociado mudou no cadastro; selecione novamente o produto.');return {produtoId:prod.id,produto:prod.nome,marca:prod.marca,unidadeMedida:prod.unidadeMedida||prod.unidade||'sacos',qtd,pesoKg,custoUnitario:price,total:cents(qtd*price)};});}
function officialUnique(s,f,n,except,orderId){assertOfficialNumberAvailable(s,n,{cargaId:except,orderId});}
function next(s,key,prefix,collection,field){let seq=Number(s.settings?.[key]||1);const used=new Set(arr(s,collection).map(x=>x[field]));let code;do{code=prefix+String(seq++).padStart(6,'0');}while(used.has(code));s.settings={...s.settings,[key]:seq};return code;}
function nextOS(s){
 // O contador da OS é permanente por empresa: não reinicia por ano,
 // não reutiliza os números cancelados e considera códigos importados.
 const max=[...arr(s,'comprasFornecedor'),...arr(s,'cargas').flatMap(c=>[{numero:c.numeroOS},{numero:c.codigo}])].reduce((value,o)=>{
  const match=/^OS-(\d+)$/.exec(String(o.numero||''));
  return match?Math.max(value,Number(match[1])):value;
 },0);
 const stored=Number(s.settings?.nextOsSeq||1);
 s.settings={...s.settings,nextOsSeq:Math.max(Number.isSafeInteger(stored)&&stored>0?stored:1,max+1)};
 return next(s,'nextOsSeq','OS-','comprasFornecedor','numero');
}
function ensureLoad(s,order,id,at){let c=arr(s,'cargas').find(x=>x.compraFornecedorId===order.id||x.id===order.cargaId);if(c)return c;const f=byId(s,'fornecedores',order.fornecedorId,'Fornecedor');const os=order.numero||nextOS(s);c={id,codigo:os,compraFornecedorId:order.id,numeroOS:os,fornecedorId:f.id,fornecedor:f.nome,marca:order.itens.map(i=>i.marca).filter(Boolean).join(' / '),itens:order.itens,itensPedido:structuredClone(order.itens),pesoPedidoKg:order.pesoKg,qtdPedida:order.qtd,produtoId:order.itens[0].produtoId,produto:order.itens.map(i=>i.produto).join(' / '),qtd:order.itens.reduce((a,i)=>a+i.qtd,0),pesoKg:order.pesoKg,qtdSemDestino:order.itens.reduce((a,i)=>a+i.qtd,0),motoristaId:order.motoristaId,motorista:order.motorista,veiculoId:order.veiculoId||'',vinculoFrotaId:order.vinculoFrotaId||'',transportadoraNome:order.transportadoraNome||'',placas:order.placas,unidadeId:order.unidadeId,unidade:order.unidade,origem:order.origem,localCarregamento:order.origem,destino:order.destino,destinoTipo:order.destinoTipo,modalidadeFrete:order.modalidadeFrete,condicaoFornecedor:order.pagamento,dataBasePagamento:order.dataBasePagamento,vencimentosPagamento:structuredClone(order.vencimentosPagamento||[]),modalidadeCompra:order.modalidadeCompra||'PADRAO',motoristaSnapshot:structuredClone(order.motoristaSnapshot),codigoFornecedor:order.codigoFornecedor||order.fornecedorSnapshot?.codigoCliente||order.fornecedorSnapshot?.codigoForte||'',fornecedorSnapshot:structuredClone(order.fornecedorSnapshot),liberacaoPalletsFornecedor:order.liberacaoPalletsFornecedor,regraPallets:order.regraPallets,pallet:order.pallet,palletQuantidade:order.palletQuantidade,aprovacaoPallets:order.aprovacaoPallets,nfPalletsAplica:order.nfPalletsAplica,numeroPedidoFornecedor:order.numeroPedidoFornecedor||'',vendaIds:[],status:'VERMELHO',fase:order.numeroPedidoFornecedor?'AGUARDANDO NOTAS FISCAIS':'AGUARDANDO RETORNO DO FORNECEDOR',criadaEm:at};s.cargas=[...arr(s,'cargas'),c];order.cargaId=c.id;order.codigoCarga=c.codigo;return c;}
export function documentStatus(s,c,type){if(type==='COMPROVANTE ENTREGA'){const ids=c.vendaIds||[],jobs=arr(s,'comunicacoes').filter(j=>j.kind==='ENTREGA'&&j.cargaId===c.id&&j.reply?.answer==='SIM');if(ids.length&&ids.every(id=>jobs.some(j=>j.vendaIds.includes(id))))return 'VALIDADO';}if(type==='COMPROVANTE FRETE'&&(c.modalidadeFrete==='CIF'||c.freteValor===0))return 'NÃO SE APLICA';if(type==='NF PALLETS'&&c.nfPalletsAplica===false)return 'NÃO SE APLICA';const docs=arr(s,'documentos').filter(d=>d.cargaId===c.id&&d.categoria===type);return docs.some(d=>d.validationStatus==='VALIDADO')?'VALIDADO':docs.length?'RECEBIDO — CONFERIR':'PENDENTE';}
export function applyWorkflow(original,b,p,{id,at}){
 if(!p.ativo||p.status_aprovacao!=='APROVADO'||p.trocar_senha||!['MASTER','ADMINISTRADOR','OPERADOR_GERAL','VENDEDOR_INTERNO'].includes(p.perfil))fail('Acesso ativo e aprovado necessário.');
 const requestedAction=b.action;
 const request=JSON.stringify(Object.fromEntries(Object.entries(b).filter(([k])=>!k.startsWith('internal'))));
 const key=text(b.requestId,'identificador da operação');if(key.length>100)fail('Identificador inválido.');
 const prior=arr(original,'workflowEvents').find(e=>e.requestId===key);if(prior){if(prior.actor!==p.user_id||prior.action!==b.action||prior.request!==request)fail('Identificador já utilizado por outra operação.');return {state:original,result:prior.result,replayed:true};}
 const s=structuredClone(original);let result={},capacityDecision=null;
 const operationDriver=(id,weight,pedido=false)=>validDriver(s,id,weight,pedido,
   b.internalFleetVehicle?.motoristaId===id?b.internalFleetVehicle:null);
 const confirmCapacity=(m,weight)=>{const check=requireCapacity(m,weight,b.capacityConfirmation,{request:b.action.startsWith('SUPPLIER_')});capacityDecision={...check,actor:p.user_id,at};return capacityDecision;};
 const purchase=()=>arr(s,'comprasFornecedor').find(x=>x.id===b.id&&(b.action==='SUPPLIER_CANCEL'||x.status!=='CANCELADO'))||fail('Pedido não localizado.');
 const load=()=>arr(s,'cargas').find(x=>x.id===b.cargaId&&x.status!=='CANCELADA')||fail('Carga não localizada.');
 const external=b.action==='EXTERNAL_ACCEPT'?arr(s,'vendasExternas').find(v=>v.id===b.vendaId):null;
 if(b.action==='EXTERNAL_ACCEPT'){
  if(!privileged(p)&&p.permissoes?.aprovarVendasExternas!==true)fail('Sem permissão para aprovar vendas externas.');
  if(!external||external.vendaInternaId||!['AGUARDANDO APROVAÇÃO','APROVADA'].includes(external.status))fail('Proposta indisponível ou já convertida.');
  const source=external.itens?.length?external.itens:[external];
  b={...b,action:'SALE_CREATE',clienteId:external.clienteId,vendedorId:external.vendedorId,destino:b.destino||external.destino,fretePorTon:0,itens:source.map(i=>({produtoId:i.produtoId,marca:arr(s,'produtos').find(p=>p.id===i.produtoId)?.marca,qtd:i.qtd,precoUnitario:i.precoAutorizado??i.precoUnitario}))};
 }
 const sheet=sheetAction(s,b,p,{id,at});
 if(sheet){result=sheet;if(requestedAction==='SALE_EDIT'){const rows=arr(s,'vendas').filter(v=>v.id===b.vendaId||v.grupoPedidoId===b.vendaId);for(const j of arr(s,'comunicacoes').filter(j=>j.vendaIds?.some(id=>rows.some(v=>v.id===id))&&['QUEUED','BLOCKED','FAILED'].includes(j.state)))Object.assign(j,{state:'CANCELLED',reason:'PEDIDO EDITADO'});queueCustomer(s,rows,'AJUSTE',id,at);}
 }else if(b.action==='DRIVER_REVIEW'){
  if(!privileged(p))fail('Somente Master ou Administrador pode conferir e habilitar motoristas.');
  const m=arr(s,'motoristas').find(x=>String(x.id)===String(b.motoristaId))||fail('Motorista não localizado no cadastro operacional.');
  if(!m.id||!String(m.nome||'').trim())fail('Cadastro de motorista inválido.');
  if(m.bloqueadoGestor===true||norm(m.statusCadastro)==='INATIVO')fail('Cadastro bloqueado pelo gestor.');
  const approved=b.aprovar===true,cpf=String(b.cpf||'').replace(/\D/g,''),
   cnh=String(b.cnhNumero||'').replace(/\D/g,''),
   categoria=norm(b.cnhCategoria).replace(/\s/g,''),
   validity=dataCnh(b.cnhValidade),
   telefone=String(b.telefone||'').replace(/\D/g,'');
  if(cpf&&!cpfValidoOperacional(cpf))fail('CPF inválido; confira os dígitos.');
  if(cnh&&cnh.length!==11)fail('CNH deve conter 11 dígitos.');
  if(categoria&&!/^(A?[CDE])$/.test(categoria))fail('Categoria CNH inválida para veículo de carga; utilize C, D, E, AC, AD ou AE.');
  if(b.cnhValidade&&!validity)fail('Data de validade da CNH inválida.');
  if(telefone&&telefone.length<10)fail('Telefone incompleto. Informe DDD.');
  if(approved){
   if(!cpfValidoOperacional(cpf)||cnh.length!==11||!/^(A?[CDE])$/.test(categoria))
    fail('Para habilitar, confira CPF válido, registro da CNH e categoria de carga.');
   if(validity&&validity<=at.slice(0,10))fail('CNH vencida. Não é possível habilitar esse motorista.');
   if(b.documentosConferidos!==true||b.confirmacaoResponsavel!==true)
    fail('Confirme expressamente a conferência dos documentos originais e sua responsabilidade.');
  }
  Object.assign(m,{
   cpf:cpf||'',cnhNumero:cnh||'',cnhCategoria:categoria||'',cnhValidade:validity||'',
   telefone:telefone||'',statusCadastro:approved?'APROVADO':'PENDENTE_DOCUMENTOS',
   ativo:approved,documentosConferidos:approved,elegivelParaCarga:approved,
   cadastroAdministrativoLiberado:approved||m.cadastroAdministrativoLiberado===true,
   ultimaRevisaoCadastro:{responsavel:p.user_id,em:at,tipo:approved?'APROVACAO_DOCUMENTAL':'RASCUNHO'}
  });
  if(approved){
   m.aprovacaoOperacional={responsavel:p.user_id,em:at,referenciaConferencia:String(b.referenciaConferencia||'').trim()||'Conferência documental confirmada pelo responsável autenticado.',documentosConferidos:true};
  }else m.aprovacaoOperacional=null;
  result={motoristaId:m.id,aprovado:approved,warning:approved?
   'Motorista habilitado documentalmente. Para gerar ordem, vincule um veículo ativo na aba Veículos.':
   'Cadastro salvo como pendente, sem liberar motorista para ordens.'};
 }else if(b.action==='DRIVERS_IMPORTED'){
  const imported=b.internalDrivers||[];
  // A sincronização de frete não pode apagar a aprovação documental feita
  // por um administrador no FORTE OP nem reativar cadastros não conferidos.
  const preserved=arr(s,'motoristas').filter(m=>m.origemCadastro!=='FORTE FRETE'||m.documentosConferidos===true&&m.aprovacaoOperacional?.responsavel||m.cadastroAdministrativoLiberado===true||norm(m.statusCadastro)==='INATIVO');
  const preservedIds=new Set(preserved.map(m=>m.id));
  const preservedSources=new Set(preserved.map(m=>m.freteMotoristaId).filter(Boolean));
  s.motoristas=[...preserved,...imported.filter(m=>!preservedIds.has(m.id)&&!preservedSources.has(m.freteMotoristaId))];
  result={count:imported.length};
 }else if(b.action==='FRETE_PUBLISHED'){
  const c=load();if(palletReleaseNeeded(c))fail('Liberação de pallets pendente.');Object.assign(c,{fretePublicadaId:b.internalReceipt.id,fretePublicadaEm:at,ordemMotoristaEnviada:true,ordemEnviadaEm:b.internalReceipt.enviadaEm,ordemCanal:'FORTE FRETE',ordemDestinatario:b.internalReceipt.motoristaId,fase:'ORDEM DISPONÍVEL NO FORTE FRETE'});result={cargaId:c.id,freteId:b.internalReceipt.id};
 }else if(['SUPPLIER_CREATE','SUPPLIER_EDIT'].includes(b.action)){
  const old=b.action==='SUPPLIER_EDIT'?purchase():null;if(old&&!canEditPurchase(s,old))fail('Pedido enviado, cancelado, confirmado ou faturado não pode ser editado.');const editReason=old?text(b.motivo,'motivo da edição'):'';
  const f=byId(s,'fornecedores',b.fornecedorId,'Fornecedor'),u=byId(s,'unidades',b.unidadeId,'Unidade');
  const selectedTerm=text(b.pagamento,'prazo');const keepHistorical=old?.fornecedorId===f.id&&paymentKey(old.pagamento)===paymentKey(selectedTerm);if(!keepHistorical&&!supplierTerms(s,f.id).some(t=>paymentKey(t)===paymentKey(selectedTerm)))fail('Cadastre o prazo no fornecedor antes de gravar.');const payment=keepHistorical?old.pagamento:paymentLabel(selectedTerm);const schedule=paymentSchedule(payment,old?.dataBasePagamento||old?.criadaEm||at);
  const itens=purchaseItems(s,b,p,at),pesoKg=itens.reduce((a,i)=>a+i.pesoKg,0);
  const candidate=b.motoristaId?(arr(s,'motoristas').find(m=>m.id===b.motoristaId)||fail('Motorista não localizado.')):null;
  const provisional=candidate?.cadastroAdministrativoLiberado===true&&candidate.documentosConferidos!==true&&!/INATIVO|BLOQUEAD|RECUSAD/.test(norm(candidate.statusCadastro));
  const m=provisional?{id:candidate.id,nome:candidate.nome,cpf:candidate.cpf,telefone:candidate.telefone}:candidate?operationDriver(candidate.id,pesoKg,true):null;
  if(m&&!provisional)confirmCapacity(m,pesoKg);
  const sameSupplier=old?.fornecedorId===f.id;
  const supplierFreight=(sameSupplier&&old.modalidadeFrete)||requireSupplierFreightMode(f);
  assertFreightSnapshot(b.modalidadeFrete,supplierFreight);
  const palletRule=(sameSupplier&&old.regraPallets)||supplierPalletRule(f);
  if(palletRule&&b.regraPallets&&b.regraPallets!==palletRule)fail('Use a condição de paletes do fornecedor ou a já gravada no pedido.');
  if(palletRule)b={...b,regraPallets:palletRule};
  if(!['GALPÃO','VENDA DIRETA','A DEFINIR'].includes(b.destinoTipo))fail('Selecione o tipo de destino.');
  const order={id:old?.id||id,numero:old?.numero||nextOS(s),fornecedorId:f.id,fornecedor:f.nome,unidadeId:u.id,unidade:u.nome,modalidadeCompra:b.modalidadeCompra||'PADRAO',fornecedorSnapshot:supplierSnapshot(f,u),cnpjComprador:buyerCnpj(u),motoristaSnapshot:driverSnapshot(m),confirmacaoCapacidade:capacityDecision,codigoFornecedor:supplierBuyerCode(f,u),itens,pesoKg,custoTotal:cents(itens.reduce((a,i)=>a+i.total,0)),qtd:itens.reduce((a,i)=>a+i.qtd,0),produto:itens.map(i=>i.produto).join(' / '),motoristaId:m?.id||'',motorista:m?.nome||'',veiculoId:m?.veiculoId||'',vinculoFrotaId:m?.vinculoFrotaId||'',transportadoraNome:m?.transportadoraNome||'',placas:m?[m.placa1,m.placa2,m.placa3,m.placa4].filter(Boolean):[],origem:text(b.origem,'expedição'),destino:text(b.destino,'destino'),destinoTipo:b.destinoTipo,modalidadeFrete:supplierFreight,pagamento:payment,...schedule,...pallets(s,b,p,at),nfPalletsAplica:b.regraPallets!==PALLETS[1],origemPreenchimento:b.origemPreenchimento||'MANUAL',protocolo:old?.protocolo||'',protocoloMotoristaId:old?.protocoloMotoristaId||'',protocoloDataReferencia:old?.protocoloDataReferencia||'',protocoloGeradoEm:old?.protocoloGeradoEm||'',protocoloHistorico:structuredClone(old?.protocoloHistorico||[]),status:'RASCUNHO — NÃO ENVIADO',criadaEm:old?.criadaEm||at,criadaPor:old?.criadaPor||p.nome,revisao:old?(old.revisao||0)+1:0,historico:[...(old?.historico||[]),{id,acao:old?'EDIÇÃO':'CRIAÇÃO',at,actor:p.user_id,motivo:editReason,...(old?{antes:purchaseSnapshot(old)}:{})}]};
  if(old){const c=arr(s,'cargas').find(c=>c.id===old.cargaId);if(c?.vendaIds?.length&&(c.fornecedorId!==order.fornecedorId||c.unidadeId!==order.unidadeId))fail('Carga com vendas vinculadas: mantenha fornecedor e unidade.');for(const v of arr(s,'vendas').filter(v=>c?.vendaIds?.includes(v.id))){const i=order.itens.find(i=>i.produtoId===v.produtoId);const qty=arr(s,'vendas').filter(x=>c.vendaIds.includes(x.id)&&x.produtoId===v.produtoId).reduce((a,x)=>a+Number(x.qtd),0);if(!i||qty>i.qtd)fail('Ajuste primeiro as vendas vinculadas.');}order.cargaId=old.cargaId;order.codigoCarga=old.codigoCarga;if(c)Object.assign(c,{...order,itensPedido:structuredClone(order.itens),pesoPedidoKg:order.pesoKg,qtdPedida:order.qtd,condicaoFornecedor:order.pagamento,localCarregamento:order.origem,qtdSemDestino:order.qtd-arr(s,'vendas').filter(v=>c.vendaIds?.includes(v.id)).reduce((a,v)=>a+Number(v.qtd),0),id:c.id,codigo:c.codigo,compraFornecedorId:old.id,status:'VERMELHO',vendaIds:c.vendaIds||[],fase:'PEDIDO EDITADO — CONFERIR ESPELHO'});for(const j of arr(s,'comunicacoes').filter(j=>j.compraFornecedorId===old.id&&['QUEUED','BLOCKED','FAILED'].includes(j.state))){j.state='CANCELLED';j.reason='PEDIDO EDITADO';}s.comprasFornecedor=arr(s,'comprasFornecedor').map(x=>x.id===old.id?order:x);}else s.comprasFornecedor=[...arr(s,'comprasFornecedor'),order];const c=ensureLoad(s,order,id+'-carga',at);if(m&&!provisional)assignOrderProtocol(s,order,c,m,at);if(b.vendaIds?.length){c.destinoTipo='VENDA DIRETA';linkSales(s,c,b.vendaIds);}c.fase='PEDIDO EM CONFERÊNCIA — ENVIO PENDENTE';result={id:order.id,numero:order.numero,cargaId:c.id};
 }else if(b.action==='SUPPLIER_CANCEL'){
  const o=purchase(),c=arr(s,'cargas').find(c=>c.id===o.cargaId);if(o.status==='CANCELADO')fail('Pedido já cancelado.');if(c?.fretePublicadaId||c?.ordemEnviadaEm)fail('Ordem já enviada ao motorista: revise o cancelamento operacional antes de cancelar.');if(c?.finalizadaEm||c&&arr(s,'documentos').some(d=>d.cargaId===c.id&&['XML NF','PDF NF'].includes(d.categoria)))fail('Pedido faturado ou carga finalizada exige revisão fiscal.');if(arr(s,'comunicacoes').some(j=>j.compraFornecedorId===o.id&&j.state==='SENDING'))fail('Aguarde a conclusão do envio antes de cancelar.');const motivo=text(b.motivo,'motivo do cancelamento');o.status='CANCELADO';o.canceladoEm=at;o.canceladoPor=p.user_id;o.historico=[...(o.historico||[]),{id,acao:'CANCELAMENTO',at,actor:p.user_id,motivo}];if(c){c.status='CANCELADA';c.fase='CANCELADA';for(const v of arr(s,'vendas').filter(v=>v.cargaId===c.id)){v.cargaId='';v.destinoPainel='AGUARDANDO ROTEAMENTO';}c.vendaIds=[];}for(const j of arr(s,'comunicacoes').filter(j=>(j.compraFornecedorId===o.id||j.cargaId===c?.id)&&['QUEUED','BLOCKED','FAILED'].includes(j.state))){j.state='CANCELLED';j.reason='PEDIDO CANCELADO';}result={id:o.id,warning:'Cancelamento registrado sem apagar o histórico. Se o fornecedor já recebeu o pedido, confirme o cancelamento com ele.'};
 }else if(b.action==='PALLETS_RELEASE'){
  if(!privileged(p)&&p.permissoes?.liberarPallets!==true)fail('Sem permissão para registrar a liberação.');const c=load();if(c.finalizadaEm)fail('Carga finalizada.');if(!String(c.regraPallets).startsWith('Solicitar'))fail('Esta carga não solicita liberação.');c.liberacaoPalletsFornecedor={evidencia:text(b.evidencia,'referência da autorização do fornecedor'),at,actor:p.user_id};const o=arr(s,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId);if(o)o.liberacaoPalletsFornecedor=structuredClone(c.liberacaoPalletsFornecedor);result={cargaId:c.id};
 }else if(b.action==='SUPPLIER_PREVIEW'){
  const o=purchase();o.espelhoConferido={snapshot:purchaseSnapshot(o),at,actor:p.user_id};result={id:o.id};
 }else if(b.action==='SUPPLIER_SEND'){
  const o=purchase();const commercialOnly=isProvisionalCommercialOrder(s,o);if(!commercialOnly)o.confirmacaoCapacidade=confirmCapacity(operationDriver(o.motoristaId,o.pesoKg,true),o.pesoKg);if(o.espelhoConferido?.snapshot!==purchaseSnapshot(o)||o.espelhoConferido?.actor!==p.user_id)fail('Abra e confira o espelho atualizado antes de enviar.');
  if(!['WHATSAPP','EMAIL','AMBOS'].includes(b.canal))fail('Selecione WhatsApp, e-mail ou ambos.');const f=byId(s,'fornecedores',o.fornecedorId,'Fornecedor');const buyer=byId(s,'unidades',o.unidadeId,'Unidade');const code=requireSupplierBuyerCode(f,buyer);if(o.codigoFornecedor!==code||o.cnpjComprador!==buyerCnpj(buyer))fail('O código do CNPJ comprador mudou. Edite o pedido e confira novamente o espelho antes de enviar.');
  const channels=b.canal==='AMBOS'?['WHATSAPP','EMAIL']:[b.canal];const destinations=channels.map(c=>c==='WHATSAPP'?phone(f.whatsapp||f.telefone):String(f.emailPedidos||f.email||'').trim());if(destinations.some((to,i)=>!to||channels[i]==='EMAIL'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)))fail('Cadastre os contatos dos canais selecionados no fornecedor.');
  s.comunicacoes??=[];channels.forEach((canal,i)=>{const key=o.id+':'+(o.revisao||0)+':FORNECEDOR:'+canal;const prior=s.comunicacoes.find(j=>j.key===key);if(prior){if(prior.state==='BLOCKED'&&String(prior.reason).startsWith('CAPACIDADE:'))Object.assign(prior,{state:'QUEUED',reason:'',snapshot:purchaseSnapshot(o),order:{...structuredClone(o),pedidoComercialSemLiberacao:commercialOnly}});return;}s.comunicacoes.push({id:key,key,kind:'FORNECEDOR',audience:'FORNECEDOR',canal,to:destinations[i],compraFornecedorId:o.id,cargaId:o.cargaId,reference:o.numero,snapshot:purchaseSnapshot(o),order:{...structuredClone(o),pedidoComercialSemLiberacao:commercialOnly},message:'FORTE ATACAREJO — Pedido '+o.numero+'. '+itemsText(o.itens)+'. Expedição: '+o.origem+'. Destino: '+o.destino+'. Motorista: '+(o.motorista||'A definir')+'. Placas: '+(o.placas.join(' / ')||'A definir')+(commercialOnly?'. Pedido comercial — não autoriza carregamento.':'')+'. Pagamento: '+o.pagamento+'. Pallets: '+o.regraPallets+' — '+o.palletQuantidade+'. Responda a esta mensagem informando o número oficial do pedido.',state:'QUEUED',createdAt:at});});o.status='ENVIO PENDENTE';result={id:o.id,queued:channels.length,jobIds:s.comunicacoes.filter(j=>j.compraFornecedorId===o.id&&channels.includes(j.canal)&&j.key===o.id+':'+(o.revisao||0)+':FORNECEDOR:'+j.canal).map(j=>j.id)};
 }else if(b.action==='CUSTOMER_CONSENT'){
  const c=byId(s,'clientes',b.clienteId,'Cliente');const evidence=text(b.evidencia,'evidência da autorização do cliente');c.whatsappAutorizado=b.autorizado===true;c.whatsappAutorizacao={actor:p.user_id,at,evidencia:evidence};for(const j of arr(s,'comunicacoes').filter(j=>j.clienteId===c.id&&['QUEUED','BLOCKED'].includes(j.state))){j.to=phone(c.whatsapp||c.telefone);j.state=c.whatsappAutorizado&&j.to?'QUEUED':'BLOCKED';j.reason=j.state==='BLOCKED'?'CONTATO OU AUTORIZAÇÃO PENDENTE':'';}result={id:c.id};
 }else if(b.action==='SALE_ADJUST'){
  const v=arr(s,'vendas').find(v=>v.id===b.vendaId&&v.status!=='CANCELADA')||fail('Venda não localizada.');const c=arr(s,'cargas').find(c=>c.id===v.cargaId);if(c?.finalizadaEm||v.status==='ENTREGUE')fail('Entrega finalizada não pode ser ajustada.');
  const group=arr(s,'vendas').filter(x=>(x.grupoPedidoId||x.id)===(v.grupoPedidoId||v.id)),ids=group.map(x=>x.id);if(arr(s,'boletosClientes').some(t=>(ids.includes(t.vendaId)||t.vendaId===v.grupoPedidoId)&&(t.nossoNumero||t.idCobranca))||arr(s,'contasReceber').some(t=>ids.includes(t.vendaId)&&t.idCobranca)||v.nf||v.numeroNF||v.chaveNfe||v.nfeId||c&&arr(s,'documentos').some(d=>d.cargaId===c.id&&['XML NF','PDF NF'].includes(d.categoria)))fail('Pedido com documento fiscal ou cobrança emitida exige revisão antes de alterar.');
  const qty=integer(b.qtd,'Quantidade ajustada');if(qty>=Number(v.qtd))fail('O ajuste para carregamento deve reduzir a quantidade.');const reason=text(b.motivo,'motivo do ajuste'),previous=itemsText(group),oldQty=v.qtd,weightPerUnit=num(v.pesoKg,'peso original')/oldQty;v.qtd=qty;v.pesoKg=qty*weightPerUnit;v.totalVenda=cents(qty*num(v.precoUnitario,'preço'));v.freteValor=cents(v.pesoKg/1000*Number(v.fretePorTon||0));v.totalGeral=cents(v.totalVenda+(v.freteIncluso?0:v.freteValor));v.ajustes=[...(v.ajustes||[]),{id,antes:oldQty,depois:qty,motivo:reason,actor:p.user_id,at}];
  for(const j of arr(s,'comunicacoes').filter(j=>j.vendaIds?.includes(v.id)&&['QUEUED','BLOCKED','FAILED'].includes(j.state))){j.state='CANCELLED';j.reason='SUBSTITUÍDA PELO PEDIDO AJUSTADO';}queueCustomer(s,group,'AJUSTE',id,at,previous);result={id:v.id,antes:oldQty,depois:qty,saldoPendente:0};
 }else if(b.action==='LOAD_SHIPMENT'){
  const c=load(),o=arr(s,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId);
  if(c.finalizadaEm||c.ordemRevisadaEm||c.ordemMotoristaEnviada)fail('Revise a ordem já preparada ou enviada antes de alterar a expedição.');
  const reason=text(b.motivo,'motivo da expedição'),source=c.itensPedido||o?.itens||c.itens||[];
  if(!b.itens?.length||b.itens.length!==source.length)fail('Confira todos os produtos do pedido original.');
  const seen=new Set(),itens=b.itens.map(i=>{const old=source.find(x=>x.produtoId===i.produtoId);if(!old||seen.has(i.produtoId))fail('Produtos da expedição divergentes do pedido.');seen.add(i.produtoId);const qtd=integer(i.qtd,'Quantidade a expedir');if(qtd>Number(old.qtd))fail('A expedição não pode superar a quantidade pedida.');return {...old,qtd,pesoKg:qtd*num(old.pesoKg,'peso pedido')/Number(old.qtd),total:cents(qtd*Number(old.custoUnitario||0))};});
  const pesoKg=itens.reduce((a,i)=>a+i.pesoKg,0),m=operationDriver(b.motoristaId||c.motoristaId,pesoKg);confirmCapacity(m,pesoKg);
  for(const i of itens){if(arr(s,'vendas').filter(v=>(c.vendaIds||[]).includes(v.id)&&v.produtoId===i.produtoId).reduce((a,v)=>a+Number(v.qtd||0),0)>i.qtd)fail('Ajuste as vendas vinculadas para caber na expedição.');}
  const before=structuredClone(c.itens),pesoPedidoKg=c.pesoPedidoKg||source.reduce((a,i)=>a+Number(i.pesoKg),0),qtdPedida=c.qtdPedida||source.reduce((a,i)=>a+Number(i.qtd),0);
  Object.assign(c,{...pallets(s,{...c,itens,palletQuantidadeAjustada:'',justificativaPallets:''},p,at),itensPedido:structuredClone(source),pesoPedidoKg,qtdPedida,itens,pesoKg,qtd:itens.reduce((a,i)=>a+i.qtd,0),confirmacaoCapacidade:capacityDecision,qtdSemDestino:Math.max(0,itens.reduce((a,i)=>a+i.qtd,0)-arr(s,'vendas').filter(v=>(c.vendaIds||[]).includes(v.id)).reduce((a,v)=>a+Number(v.qtd||0),0))});
  c.historicoOperacao=[...(c.historicoOperacao||[]),{id,acao:'EXPEDICAO_SEPARADA_DO_PEDIDO',antes:before,depois:structuredClone(itens),motivo:reason,actor:p.user_id,at}];result={cargaId:c.id,pesoKg:c.pesoKg,qtd:c.qtd,pesoPedidoKg,qtdPedida};
 }else if(b.action==='LOAD_ADJUST'){
  const c=load(),o=arr(s,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId);if(!o||c.finalizadaEm||c.ordemRevisadaEm||o.numeroPedidoFornecedor||o.envioComprovadoEm||arr(s,'comunicacoes').some(j=>j.compraFornecedorId===o.id&&['SENDING','SENT','DELIVERED','READ','UNCERTAIN'].includes(j.state))||arr(s,'documentos').some(d=>d.cargaId===c.id&&['XML NF','PDF NF'].includes(d.categoria)))fail('Compra enviada, confirmada ou faturada exige revisão com o fornecedor.');
  const reason=text(b.motivo,'motivo do ajuste');if(!b.itens?.length||b.itens.length!==o.itens.length||b.itens.some(i=>!o.itens.some(x=>x.produtoId===i.produtoId&&Number(i.qtd)<=x.qtd)))fail('Ajuste somente as quantidades dos produtos existentes.');const seen=new Set();const itens=b.itens.map(i=>{if(seen.has(i.produtoId))fail('Consolide os produtos.');seen.add(i.produtoId);const old=o.itens.find(x=>x.produtoId===i.produtoId),qtd=integer(i.qtd,'Quantidade ajustada'),price=num(old.custoUnitario,'custo original');return {...old,qtd,pesoKg:qtd*num(old.pesoKg,'peso original')/old.qtd,total:cents(qtd*price)};});for(const i of itens){const distributed=arr(s,'vendas').filter(v=>(c.vendaIds||[]).includes(v.id)&&v.produtoId===i.produtoId).reduce((a,v)=>a+Number(v.qtd),0);if(distributed>i.qtd)fail('Ajuste primeiro os pedidos dos clientes para caber na carga.');}const before=structuredClone(o.itens),pesoKg=itens.reduce((a,i)=>a+i.pesoKg,0);if(o.motoristaId)o.confirmacaoCapacidade=confirmCapacity(operationDriver(o.motoristaId,pesoKg),pesoKg);const updatedPallets=pallets(s,{...o,itens,palletQuantidadeAjustada:'',justificativaPallets:''},p,at),palletQuantidade=updatedPallets.palletQuantidade;Object.assign(o,{...updatedPallets,itens,pesoKg,qtd:itens.reduce((a,i)=>a+i.qtd,0),custoTotal:cents(itens.reduce((a,i)=>a+i.total,0)),palletQuantidade,pallets:palletQuantidade,status:'RASCUNHO — NÃO ENVIADO',espelhoConferido:null,revisao:(o.revisao||0)+1});Object.assign(c,{...updatedPallets,itens:structuredClone(itens),itensPedido:structuredClone(itens),pesoPedidoKg:pesoKg,qtdPedida:o.qtd,pesoKg,qtd:o.qtd,palletQuantidade,pallets:palletQuantidade});for(const j of arr(s,'comunicacoes').filter(j=>j.compraFornecedorId===o.id))j.state='CANCELLED';o.historico=[...(o.historico||[]),{id,acao:'AJUSTE DE QUANTIDADE',at,actor:p.user_id,motivo:reason}];c.ajustes=[...(c.ajustes||[]),{id,antes:before,depois:structuredClone(itens),motivo:reason,at,actor:p.user_id}];result={cargaId:c.id};
 }else if(b.action==='SUPPLIER_TERM'){
  if(!privileged(p)&&p.permissoes?.editarFornecedor!==true)fail('Seu perfil não pode alterar o prazo do fornecedor.');const f=byId(s,'fornecedores',b.fornecedorId,'Fornecedor');const term=text(b.pagamento,'prazo');if(!paymentDays(term).length)fail('Informe uma condição válida de pagamento.');f.prazosPagamento=paymentOptions([...(Array.isArray(f.prazosPagamento)?f.prazosPagamento:[f.prazosPagamento]),term]);result={id:f.id};
 }else if(b.action==='SUPPLIER_RECEIPT'){
  const o=purchase();if(!isProvisionalCommercialOrder(s,o))o.confirmacaoCapacidade=confirmCapacity(operationDriver(o.motoristaId,o.pesoKg,true),o.pesoKg);if(o.envioComprovadoEm)fail('Envio já registrado para este pedido.');const recipient=text(b.destinatario,'destinatário');if(!['WHATSAPP','EMAIL','PORTAL'].includes(b.canal))fail('Selecione o canal.');
  const d=arr(s,'documentos').find(d=>d.id===b.documentoId&&d.compraFornecedorId===o.id&&d.categoria==='COMPROVANTE ENVIO FORNECEDOR')||fail('Anexe o comprovante do envio ao pedido.');
  Object.assign(d,{validationStatus:'VALIDADO',conferente:p.nome,validadoEm:at});Object.assign(o,{status:'AGUARDANDO RETORNO DO FORNECEDOR',envioComprovadoEm:at,envioComprovadoPor:p.nome,canalEnvio:b.canal,destinatario:recipient,envioDocumentoId:d.id});const c=ensureLoad(s,o,id,at);d.cargaId=c.id;result={id:o.id,cargaId:c.id};
 }else if(b.action==='OFFICIAL_UNLINK'){
  if(!privileged(p))fail('Somente Master ou Administrador pode excluir o vínculo do número do fornecedor.');
  result=releaseOfficialNumber(s,{orderId:b.id,cargaId:b.cargaId,number:b.numeroPedidoFornecedor,reason:b.motivo,actor:p.user_id,at,id});
 }else if(b.action==='OFFICIAL_CONFIRM'){
  const o=purchase(),n=text(b.numeroPedidoFornecedor,'número oficial'),evidence=text(b.evidencia,'referência do documento ou retorno conferido');const prior=arr(s,'cargas').find(c=>c.id===o.cargaId||c.compraFornecedorId===o.id);if(prior?.finalizadaEm||prior?.status==='CANCELADA')fail('Carga encerrada ou cancelada.');if([o.numeroPedidoFornecedor,prior?.numeroPedidoFornecedor].some(v=>officialNumberKey(v)&&officialNumberKey(v)!==officialNumberKey(n)))fail('Exclua o vínculo anterior antes de alterar o número.');officialUnique(s,o.fornecedorId,n,prior?.id||o.cargaId,o.id);o.numeroPedidoFornecedor=n;o.evidenciaRetorno=evidence;o.confirmadoEm=at;o.confirmadoPor=p.nome;o.status='AGUARDANDO NOTAS FISCAIS';const c=ensureLoad(s,o,id,at);Object.assign(c,{numeroPedidoFornecedor:n,fase:'AGUARDANDO NOTAS FISCAIS',pedidoConfirmadoEm:at,pedidoConfirmadoPor:p.nome});result={id:o.id,cargaId:c.id};
 }else if(b.action==='SALE_CREATE'){
  if(b.osVendaId&&!external)checkLoadSaleProducts(s,b.osVendaId,b.itens);
  const customer=byId(s,'clientes',b.clienteId,'Cliente'),seller=external?{id:external.vendedorId||'',nome:external.vendedorNome||external.vendedor||'VENDEDOR EXTERNO'}:byId(s,'usuarios',b.vendedorId,'Vendedor');if(!b.itens?.length)fail('Inclua produtos.');if(!['PIX','DINHEIRO','TRANSFERÊNCIA','CARTÃO','BOLETO','A PRAZO'].includes(b.formaPagamento))fail('Selecione o recebimento.');const prazo=text(b.condicaoPagamento,'condição de pagamento'),destino=text(b.destino,'endereço ou obra'),rate=num(b.fretePorTon||0,'frete por tonelada',true);const group=id,number=next(s,'nextVendaSeq',`VEN-${at.slice(0,4)}-`,'vendas','numeroVenda');
  const rows=b.itens.map((i,index)=>{const prod=byId(s,'produtos',i.produtoId,'Produto');if(norm(i.marca)!==norm(prod.marca)||!prod.marca)fail('Selecione a marca antes do produto.');if(!isResaleProduct(prod))fail('Produto não classificado para revenda.');const qtd=integer(i.qtd,'Quantidade'),price=num(i.precoUnitario,'preço unitário'),expected=salePrice(s,customer.id,prod.id);if((expected<=0||cents(price)!==cents(expected))&&!privileged(p)&&p.permissoes?.editarPreco!==true)fail('Preço diferente do cadastro exige autorização.');const pesoKg=qtd*num(prod.pesoKg,'peso cadastrado');return {id:`${id}-${index}`,grupoPedidoId:group,numeroVenda:number,...customerPurchaseOrder(b.ordemCompraCliente,i.itemOrdemCompraCliente),clienteId:customer.id,cliente:customer.nome,clienteEmail:customer.email||'',clienteWhatsapp:customer.whatsapp||customer.telefone||'',vendedorId:seller.id,vendedorNome:seller.nome,produtoId:prod.id,produto:prod.nome,marca:prod.marca,unidadeMedida:prod.unidadeMedida||prod.unidade||'sacos',qtd,pesoKg,precoUnitario:price,totalVenda:cents(qtd*price),fretePorTon:rate,freteValor:cents(pesoKg/1000*rate),freteIncluso:!!b.freteIncluso,totalGeral:cents(qtd*price+(b.freteIncluso?0:pesoKg/1000*rate)),formaPagamento:b.formaPagamento,condicaoPagamento:prazo,destino,status:'APROVADO',origemComercial:'VR',workflowInterno:true,destinoPainel:'AGUARDANDO ROTEAMENTO',criadoEm:at,dataOperacao:at.slice(0,10)};});
  if(['BOLETO','A PRAZO'].includes(b.formaPagamento)){const total=rows.reduce((a,v)=>a+v.totalGeral,0),used=arr(s,'contasReceber').filter(x=>x.clienteId===customer.id&&!/LIQUIDADO|PAGO|RECEBIDO/.test(norm(x.status))).reduce((a,x)=>a+Number(x.saldoAberto??x.valor??0),0)+arr(s,'vendas').filter(v=>v.clienteId===customer.id&&!['CANCELADA','ENTREGUE'].includes(v.status)&&['BOLETO','A PRAZO'].includes(v.formaPagamento)&&!arr(s,'contasReceber').some(t=>t.vendaId===v.id)).reduce((a,v)=>a+Number(v.totalGeral||v.totalVenda||Number(v.qtd)*Number(v.precoUnitario)),0);if(total>Math.max(0,Number(customer.limiteCredito||0)-used))fail('Pedido excede o crédito disponível do cliente.');}
  if(external){rows.forEach(v=>Object.assign(v,{origemComercial:'VX',vendaExternaId:external.id}));Object.assign(external,{status:'EM ATENDIMENTO',vendaInternaId:group,destinoPainel:'CARGA DIRETA',aprovadaEm:at,aprovadaPor:p.user_id});}s.vendas=[...arr(s,'vendas'),...rows];queueCustomer(s,rows,'PEDIDO',id,at);result={id:group,numero:number};
 }else if(b.action==='LOAD_ASSIGN'){
  const c=load();if(c.finalizadaEm||c.fretePublicadaId||c.ordemEnviadaEm)fail('Carga já enviada ou finalizada: revise a operação antes de alterar motorista e condições.');
  const f=byId(s,'fornecedores',b.fornecedorId,'Fornecedor'),o=arr(s,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId);
  if(c.fornecedorId&&c.fornecedorId!==f.id)fail('Fornecedor diferente do pedido: revise a compra antes de alterar.');
  if(o&&supplierWasSent(s,o))fail('Pedido já enviado ao fornecedor: confirme a revisão antes de alterar motorista e condições.');
  if(b.prepararCadastro===true){
   const m=arr(s,'motoristas').find(x=>x.id===b.motoristaId);
   if(!m?.cadastroAdministrativoLiberado||m.documentosConferidos===true||m.bloqueadoGestor===true||/INATIVO|BLOQUEAD|RECUSAD|REPROVADO/.test(norm(m.statusCadastro)))fail('Motorista indisponível para preparação cadastral.');
   if(arr(s,'comunicacoes').some(j=>(j.cargaId===c.id||o&&j.compraFornecedorId===o.id)&&['SENDING','UNCERTAIN'].includes(j.state)))fail('Confira o envio em andamento antes de alterar motorista.');
   if(arr(s,'documentos').some(d=>d.cargaId===c.id&&d.validationStatus==='VALIDADO'&&['XML NF','PDF NF','COMPROVANTE FRETE'].includes(d.categoria)))fail('Carga com documento fiscal ou frete validado: revise antes de trocar o motorista.');
   const before={motoristaId:c.motoristaId,motorista:c.motorista,placas:c.placas,veiculoId:c.veiculoId};
   const history=[...(c.protocoloHistorico||[])];if(c.protocolo)history.push({valor:c.protocolo,motoristaId:c.protocoloMotoristaId,substituidoEm:at});
   const fields={motoristaId:m.id,motorista:m.nome,motoristaSnapshot:driverSnapshot({id:m.id,nome:m.nome,cpf:m.cpf,telefone:m.telefone}),veiculoId:'',vinculoFrotaId:'',transportadoraNome:'',placas:[],placa:'',proprietario:'',confirmacaoCapacidade:null,protocolo:'',protocoloMotoristaId:'',protocoloDataReferencia:'',protocoloGeradoEm:'',protocoloHistorico:history};
   Object.assign(c,fields,{ordemRevisadaEm:null,ordemRevisadaPor:null,fase:'MOTORISTA PREVISTO — DOCUMENTOS A CONFERIR'});
   c.historicoOperacao=[...(c.historicoOperacao||[]),{id,at,actor:p.user_id,antes:before,depois:{motoristaId:m.id,preparacaoCadastral:true}}];
   if(o){Object.assign(o,structuredClone(fields),{espelhoConferido:null,revisao:(o.revisao||0)+1});o.historico=[...(o.historico||[]),{id,at,actor:p.user_id,acao:'MOTORISTA PREVISTO — DOCUMENTOS A CONFERIR'}];}
   for(const j of arr(s,'comunicacoes').filter(j=>(j.cargaId===c.id||o&&j.compraFornecedorId===o.id)&&['QUEUED','BLOCKED','FAILED'].includes(j.state)&&['FORNECEDOR','MOTORISTA'].includes(j.audience)))Object.assign(j,{state:'CANCELLED',reason:'MOTORISTA ATUALIZADO'});
   result={cargaId:c.id,warning:'Motorista previsto salvo. Confira os documentos e o veículo antes de emitir a ordem.'};
  }else{
  const cargoFreight=o?.modalidadeFrete||c.modalidadeFrete||requireSupplierFreightMode(f);
  assertFreightSnapshot(b.modalidadeFrete,cargoFreight);
  const origin=text(b.origem,'local de carregamento');if(norm(origin)!==norm(c.localCarregamento||c.origem))assertSupplierExpedition(s,f.id,origin);if(norm(origin)!==norm(c.localCarregamento||c.origem)&&(c.itens||[]).some(i=>supplierLocationPrices(s,f.id,i.produtoId).length))fail('A expedição altera o custo: revise o pedido ao fornecedor antes de alterar o local da carga.');const destination=text(b.destino||c.destino,'destino'),m=operationDriver(b.motoristaId,c.pesoKg);
  confirmCapacity(m,c.pesoKg);
  const nextPallets=pallets(s,{...b,itens:c.itens},p,at);
  const unchangedPallets=c.regraPallets===nextPallets.regraPallets&&Number(c.palletQuantidade)===nextPallets.palletQuantidade;
  if(unchangedPallets){nextPallets.liberacaoPalletsFornecedor=c.liberacaoPalletsFornecedor||null;nextPallets.aprovacaoPallets=c.aprovacaoPallets||null;}
  if(arr(s,'documentos').some(d=>d.cargaId===c.id&&d.validationStatus==='VALIDADO'&&['XML NF','PDF NF','COMPROVANTE FRETE'].includes(d.categoria))&&(cargoFreight!==c.modalidadeFrete||!unchangedPallets))fail('Nota fiscal ou pagamento validado: revise os documentos antes de alterar frete ou pallets.');
  const buyer=byId(s,'unidades',c.unidadeId,'Unidade');const code=requireSupplierBuyerCode(f,buyer);if(b.codigoClienteFornecedor!==undefined&&String(b.codigoClienteFornecedor).trim()!==code)fail('O código deve corresponder ao CNPJ comprador. Corrija no cadastro do fornecedor.');

  const before={motoristaId:c.motoristaId,modalidadeFrete:c.modalidadeFrete,origem:c.localCarregamento||c.origem,regraPallets:c.regraPallets,palletQuantidade:c.palletQuantidade};
  const fields={...nextPallets,codigoFornecedor:code,fornecedorId:f.id,fornecedor:f.nome,fornecedorSnapshot:supplierSnapshot(f,buyer),cnpjComprador:buyerCnpj(buyer),motoristaId:m.id,motorista:m.nome,veiculoId:m.veiculoId||'',vinculoFrotaId:m.vinculoFrotaId||'',transportadoraNome:m.transportadoraNome||'',motoristaSnapshot:driverSnapshot(m),confirmacaoCapacidade:capacityDecision,placas:[m.placa1,m.placa2,m.placa3,m.placa4].filter(Boolean),placa:m.placa1,modalidadeFrete:cargoFreight,origem:origin,localCarregamento:origin,destino:destination,nfPalletsAplica:nextPallets.regraPallets!==PALLETS[1]};
  Object.assign(c,fields);if(c.modalidadeFrete==='CIF')Object.assign(c,{fretePorTon:0,freteValor:0,freteFonte:'COMBINADO',freteTarifaId:null});else if(before.modalidadeFrete==='CIF'){delete c.fretePorTon;delete c.freteValor;delete c.freteFonte;delete c.freteTarifaId;}
  c.ordemRevisadaEm=null;c.ordemRevisadaPor=null;c.fase='MOTORISTA E CONDIÇÕES DEFINIDOS — CONFERIR ORDEM';c.historicoOperacao=[...(c.historicoOperacao||[]),{id,at,actor:p.user_id,antes:before,depois:{motoristaId:m.id,modalidadeFrete:c.modalidadeFrete,origem:origin,regraPallets:c.regraPallets,palletQuantidade:c.palletQuantidade}}];
  if(o){Object.assign(o,fields,{espelhoConferido:null,revisao:(o.revisao||0)+1});o.historico=[...(o.historico||[]),{id,at,actor:p.user_id,acao:'MOTORISTA E CONDIÇÕES DEFINIDOS'}];for(const j of arr(s,'comunicacoes').filter(j=>j.compraFornecedorId===o.id&&['QUEUED','BLOCKED','FAILED'].includes(j.state)))Object.assign(j,{state:'CANCELLED',reason:'MOTORISTA OU CONDIÇÕES ATUALIZADOS'});}
  assignOrderProtocol(s,o,c,m,at);result={cargaId:c.id,codigoFornecedor:code,protocolo:c.protocolo};
  }
 }else if(b.action==='LOADING_SAVE'){
  const f=byId(s,'fornecedores',b.fornecedorId,'Fornecedor'),n=text(b.numeroPedidoFornecedor,'número oficial');const existing=arr(s,'cargas').filter(c=>c.status!=='CANCELADA'&&c.fornecedorId===f.id&&(b.cargaId?c.id===b.cargaId&&(!c.numeroPedidoFornecedor||norm(c.numeroPedidoFornecedor)===norm(n)):norm(c.numeroPedidoFornecedor)===norm(n)));if(existing.length>1)fail('Há múltiplas cargas para este número. Solicite conferência.');let c=existing[0];if(b.cargaId&&c?.id!==b.cargaId)fail('Pedido não corresponde à carga selecionada.');if(c?.finalizadaEm)fail('Carga já finalizada.');if(c&&(c.fretePublicadaId||c.ordemEnviadaEm)&&b.motoristaId!==c.motoristaId)fail('Ordem já enviada: revise o vínculo antes de alterar o motorista.');
  assertFreightSnapshot(b.modalidadeFrete,c?.modalidadeFrete||requireSupplierFreightMode(f));
  text(b.evidencia,'documento ou retorno conferido');
  const date=text(b.dataCarregamento,'data');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)fail('Data inválida.');
  if(!c){officialUnique(s,f.id,n);const u=byId(s,'unidades',b.unidadeId,'Unidade');if(!supplierTerms(s,f.id).some(t=>paymentKey(t)===paymentKey(b.pagamento)))fail('Cadastre o prazo do fornecedor.');const itens=purchaseItems(s,b,p,at);const o={id:id+'-compra',fornecedorId:f.id,fornecedor:f.nome,itens,pesoKg:itens.reduce((a,i)=>a+i.pesoKg,0),unidadeId:u.id,unidade:u.nome,origem:text(b.origem,'origem'),destino:text(b.destino,'destino'),destinoTipo:b.destinoTipo,pagamento:paymentLabel(b.pagamento),...paymentSchedule(b.pagamento,at),modalidadeFrete:requireSupplierFreightMode(f),numeroPedidoFornecedor:n,...pallets(s,b,p,at),nfPalletsAplica:b.regraPallets!==PALLETS[1]};if(!['GALPÃO','VENDA DIRETA','A DEFINIR'].includes(o.destinoTipo)||!['FOB','CIF'].includes(o.modalidadeFrete))fail('Selecione destino e modalidade.');o.motoristaSnapshot=null;o.codigoFornecedor=requireSupplierBuyerCode(f,u);o.cnpjComprador=buyerCnpj(u);o.fornecedorSnapshot=supplierSnapshot(f,u);o.modalidadeCompra=b.modalidadeCompra||'PADRAO';c=ensureLoad(s,o,id,at);c.pedidoExterno=true;}
  if(b.modalidadeFrete&&b.modalidadeFrete!==c.modalidadeFrete||b.origem&&b.origem!==(c.localCarregamento||c.origem))fail('Salve primeiro o motorista e as condições desta carga.');const linkedOrder=arr(s,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId||o.cargaId===c.id);if(linkedOrder?.numeroPedidoFornecedor&&officialNumberKey(linkedOrder.numeroPedidoFornecedor)!==officialNumberKey(n))fail('Exclua o vínculo anterior antes de alterar o número.');officialUnique(s,f.id,n,c.id,linkedOrder?.id);c.numeroPedidoFornecedor=n;if(linkedOrder)linkedOrder.numeroPedidoFornecedor=n;c.codigoFornecedor=requireSupplierBuyerCode(f,byId(s,'unidades',c.unidadeId,'Unidade'));c.cnpjComprador=buyerCnpj(byId(s,'unidades',c.unidadeId,'Unidade'));c.fornecedorSnapshot=supplierSnapshot(f,byId(s,'unidades',c.unidadeId,'Unidade'));if(palletReleaseNeeded(c))fail('Carregamento bloqueado: registre a liberação de pallets pelo fornecedor.');const m=operationDriver(b.motoristaId,c.pesoKg);confirmCapacity(m,c.pesoKg);Object.assign(c,{confirmacaoCapacidade:capacityDecision,motoristaSnapshot:driverSnapshot(m),motoristaId:m.id,motorista:m.nome,veiculoId:m.veiculoId||'',vinculoFrotaId:m.vinculoFrotaId||'',transportadoraNome:m.transportadoraNome||'',placas:[m.placa1,m.placa2,m.placa3,m.placa4].filter(Boolean),placa:m.placa1,dataCarregamento:date,evidenciaPedido:b.evidencia,origemPreenchimento:b.origemPreenchimento||'MANUAL',ordemRevisadaEm:at,ordemRevisadaPor:p.nome,fase:'ORDEM PREPARADA — ENVIO PENDENTE'});if(c.modalidadeFrete==='CIF')Object.assign(c,{fretePorTon:0,freteValor:0});assignOrderProtocol(s,arr(s,'comprasFornecedor').find(o=>o.id===c.compraFornecedorId),c,m,at);queueLoading(s,c,id,at);result={id:c.id,cargaId:c.id,protocolo:c.protocolo};
 }else if(b.action==='FREIGHT_SAVE'){
  if(!privileged(p)&&p.permissoes?.editarFrete!==true)fail('Sem autorização para registrar o frete interno.');
  const c=load();if(!c.ordemRevisadaEm||!c.numeroPedidoFornecedor)fail('Prepare a ordem antes da etapa financeira.');if(c.finalizadaEm)fail('Carga já finalizada.');
  if(arr(s,'documentos').some(d=>d.cargaId===c.id&&d.categoria==='COMPROVANTE FRETE'&&d.validationStatus==='VALIDADO'))fail('Frete com comprovante validado exige revisão financeira.');
  if(b.fretePorTon==null||String(b.fretePorTon).trim()==='')fail('Informe o valor combinado ou uma sugestão válida.');
  const rate=c.modalidadeFrete==='CIF'?0:num(b.fretePorTon,'frete por tonelada',true),before={fretePorTon:c.fretePorTon,freteValor:c.freteValor};
  Object.assign(c,{fretePorTon:rate,freteValor:cents(c.pesoKg/1000*rate),freteFonte:b.freteFonte||'COMBINADO',freteTarifaId:b.freteTarifaId||null,freteRegistradoEm:at,freteRegistradoPor:p.user_id});
  c.historicoFinanceiro=[...(c.historicoFinanceiro||[]),{id,at,actor:p.user_id,antes:before,fretePorTon:rate,freteValor:c.freteValor}];result={cargaId:c.id};
 }else if(b.action==='DRIVER_SEND'){
  const c=load(),j=queueDriverOrder(s,c,at,id);result={cargaId:c.id,jobIds:[j.id],state:j.state};
 }else if(b.action==='SALE_LINK'){
  const c=load(),rows=linkSales(s,c,[b.vendaId]);if(c.ordemRevisadaEm)queueCustomer(s,rows,'CARREGAMENTO',c.ordemRevisadaEm,at);result={cargaId:c.id};
 }else if(b.action==='DOCUMENT_ADD'){
  const c=b.cargaId?load():null,o=b.compraFornecedorId?arr(s,'comprasFornecedor').find(x=>x.id===b.compraFornecedorId):null;const sales=b.vendaId?arr(s,'vendas').filter(v=>v.id===b.vendaId||v.grupoPedidoId===b.vendaId):[];if(!c&&!o&&!sales.length)fail('Selecione a venda, pedido ou carga.');if(b.categoria==='BOLETO CLIENTE'){if(!c||c.finalizadaEm||!sales.length||sales.some(v=>v.status==='CANCELADA'||!(v.cargaId===c.id||!v.cargaId&&(c.vendaIds||[]).includes(v.id))||!v.clienteId||v.clienteId!==sales[0].clienteId))fail('Boleto deve pertencer a uma venda ativa do mesmo cliente e da mesma carga.');if(!privileged(p)&&p.permissoes?.faturamento!==true)fail('Sem autorização para anexar boletos de clientes.');}if(b.categoria==='COMPROVANTE FRETE'&&c?.modalidadeFrete==='CIF')fail('CIF não possui comprovante de frete separado.');if(!DOCUMENTS.includes(b.categoria))fail('Categoria inválida.');const path=text(b.path,'arquivo'),hash=text(b.hash,'hash do arquivo');if(!path.startsWith(p.empresa_id+'/')||!/^[a-f0-9]{64}$/.test(hash))fail('Arquivo inválido ou de outra empresa.');const existing=arr(s,'documentos').find(d=>d.cargaId===(c?.id||'')&&d.compraFornecedorId===(o?.id||'')&&d.vendaId===(b.vendaId||'')&&d.categoria===b.categoria&&d.hash===hash);if(existing)result={id:existing.id};else{const d={id,vendaId:b.vendaId||'',...(b.categoria==='BOLETO CLIENTE'?{clienteId:sales[0].clienteId}:{}),cargaId:c?.id||sales[0]?.cargaId||'',compraFornecedorId:o?.id||'',categoria:b.categoria,tipo:b.categoria,filename:text(b.filename,'nome do arquivo'),storageBucket:'forte-vendas-dossies',storagePath:path,hash,validationStatus:'RECEBIDO',identificacaoConfirmada:false,origem:'ANEXO MANUAL',receivedAt:at,usuario:p.nome};s.documentos=[...arr(s,'documentos'),d];result={id};}
 }else if(b.action==='PAYMENT_SYNC_RESULT'){
  result=receiptSyncResult(s,b,{at});
 }else if(b.action==='DOCUMENT_VALIDATE'){
  const c=load(),d=arr(s,'documentos').find(x=>x.id===b.documentoId&&x.cargaId===c.id)||fail('Documento não localizado nesta carga.');if(d.categoria==='COMPROVANTE FRETE'){if(p.perfil!=='MASTER')fail('Somente Master pode autorizar comprovante de frete no Financeiro.');d.validadoFinanceiroPor=p.user_id;}text(b.evidencia,'referência conferida');Object.assign(d,{validationStatus:'VALIDADO',identificacaoConfirmada:true,validadoEm:at,conferente:p.nome,evidencia:b.evidencia});if(d.categoria==='COMPROVANTE FRETE'){if(c.modalidadeFrete==='CIF')fail('CIF não possui comprovante de frete separado.');linkFreightReceipt(s,c,d,at);}result={id:d.id};
 }else if(b.action==='DRIVER_RECEIPT'){
  const c=load();if(palletReleaseNeeded(c))fail('Liberação de pallets pendente.');if(!c.ordemRevisadaEm||!c.numeroPedidoFornecedor)fail('Revise e grave a ordem primeiro.');const d=arr(s,'documentos').find(x=>x.id===b.documentoId&&x.cargaId===c.id&&x.categoria==='COMPROVANTE ENVIO MOTORISTA')||fail('Anexe comprovante de envio ao motorista.');Object.assign(d,{validationStatus:'VALIDADO',validadoEm:at,conferente:p.nome});Object.assign(c,{ordemMotoristaEnviada:true,ordemEnviadaEm:at,ordemDestinatario:text(b.destinatario,'destinatário'),ordemCanal:text(b.canal,'canal'),ordemDocumentoId:d.id,fase:'AGUARDANDO NOTAS FISCAIS'});result={cargaId:c.id};
 }else if(b.action==='LOAD_FINALIZE'){
  const c=load();if(palletReleaseNeeded(c))fail('Liberação de pallets pendente.');if(c.finalizadaEm)fail('Carga já finalizada.');if(!c.numeroPedidoFornecedor||!c.ordemMotoristaEnviada||!c.itens?.length)fail('Pedido, produtos e envio da ordem precisam estar confirmados.');const required=['XML NF','PDF NF','BOLETO FORNECEDOR','COMPROVANTE FRETE','NF PALLETS'];const pending=required.filter(t=>!['VALIDADO','NÃO SE APLICA'].includes(documentStatus(s,c,t)));if(pending.length)fail('Documentos pendentes de validação: '+pending.join(', '));if(c.destinoTipo==='A DEFINIR')fail('Defina a destinação da carga.');if(c.destinoTipo==='VENDA DIRETA'){for(const i of c.itens){if(arr(s,'vendas').filter(v=>(c.vendaIds||[]).includes(v.id)&&v.produtoId===i.produtoId).reduce((a,v)=>a+Number(v.qtd),0)!==i.qtd)fail('Distribua toda a quantidade por produto antes de finalizar.');}}
  if(c.destinoTipo==='VENDA DIRETA'&&documentStatus(s,c,'COMPROVANTE ENTREGA')!=='VALIDADO'){const groups=new Map();for(const v of arr(s,'vendas').filter(v=>(c.vendaIds||[]).includes(v.id))){const key=v.grupoPedidoId||v.id;groups.set(key,[...(groups.get(key)||[]),v]);}for(const rows of groups.values())queueCustomer(s,rows,'ENTREGA',c.id+':ENTREGA',at);c.fase='AGUARDANDO CONFIRMAÇÃO DE ENTREGA';result={cargaId:c.id,warning:'Solicitação de confirmação preparada. A carga aguarda o Sim/Não do cliente ou comprovante de entrega validado.'};}else{
  if(c.destinoTipo==='GALPÃO'&&!arr(s,'estoqueMov').some(m=>m.cargaId===c.id||m.referencia===c.codigo&&String(m.tipo).startsWith('ENTRADA')))s.estoqueMov=[...arr(s,'estoqueMov'),...c.itens.map((i,index)=>({id:id+'-'+index,cargaId:c.id,produtoId:i.produtoId,produto:i.produto,marca:i.marca,unidade:c.unidade,tipo:'ENTRADA - COMPRA FORTE / CARGA',qtd:i.qtd,quantidade:i.qtd,custoUnitario:i.custoUnitario,data:at.slice(0,10),dataHora:at,criadoEm:at,usuario:p.nome,origem:'FINALIZAÇÃO DE CARGA',referencia:c.codigo}))];
  Object.assign(c,{status:'AZUL',fase:'FINALIZADA',finalizadaEm:at,finalizadaPor:p.nome});const groups=new Map();for(const v of arr(s,'vendas').filter(v=>(c.vendaIds||[]).includes(v.id))){const key=v.grupoPedidoId||v.id;groups.set(key,[...(groups.get(key)||[]),v]);}result={cargaId:c.id};}
 }else fail('Ação inválida.');
 if(capacityDecision)result.capacidade=capacityDecision;
 // Delivery is recomputed only from a real finalization, delivery receipt and actual billing receipts.
 s.vendas=arr(s,'vendas').map(v=>{const c=arr(s,'cargas').find(c=>c.id===v.cargaId);if(v.status==='CANCELADA'||!c?.finalizadaEm||documentStatus(s,c,'COMPROVANTE ENTREGA')!=='VALIDADO')return v;const group=arr(s,'vendas').filter(x=>(x.grupoPedidoId||x.id)===(v.grupoPedidoId||v.id));const ids=group.map(x=>x.id);const total=group.reduce((a,x)=>a+Number(x.totalGeral||x.totalVenda||Number(x.qtd)*Number(x.precoUnitario)),0);const issued=arr(s,'boletosClientes').filter(t=>(ids.includes(t.vendaId)||t.vendaId===v.grupoPedidoId)&&(t.nossoNumero||t.idCobranca)&&['EMITIDO','REGISTRADO','LIQUIDADO','PAGO'].includes(norm(t.status)));const billing=v.formaPagamento!=='BOLETO'||(issued.length>0&&cents(issued.reduce((a,t)=>a+Number(t.valor||0),0))>=cents(total));return billing?{...v,status:'ENTREGUE',entregueEm:v.entregueEm||at}:v;});
 s.auditoria=[...arr(s,'auditoria'),{id:id+'-aud',acao:requestedAction,detalhe:JSON.stringify(result),usuario:p.nome,userId:p.user_id,dataHora:at}];s.workflowEvents=[...arr(s,'workflowEvents'),{requestId:key,request,actor:p.user_id,action:requestedAction,result,at}];return {state:s,result};
}

export function matchingSupplierInvoices(state,cargaId,xmlSources){
 const digits=v=>String(v||'').replace(/\D/g,'');
 const ref=v=>String(v||'').trim().toUpperCase();
 const osRef=v=>{const m=ref(v).match(/^OS[-\s]?(\d{3,12})$/);return m?'OS-'+m[1].padStart(6,'0'):'';};
 const productKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 const distinct=xs=>[...new Set(xs.filter(Boolean))];
 const purchases=arr(state,'comprasFornecedor');
 const all=arr(state,'cargas').map(c=>{
  const o=purchases.find(o=>o.id===c.compraFornecedorId||o.cargaId===c.id);
  const supplier=arr(state,'fornecedores').find(f=>f.id===(c.fornecedorId||o?.fornecedorId));
  const os=distinct([o?.numero,c.numeroOS].map(osRef));
  const official=distinct([o?.numeroPedidoFornecedor,c.numeroPedidoFornecedor].map(officialNumberKey));
  return {id:c.id,order:o,load:c,issuer:digits(o?.fornecedorSnapshot?.cnpj||c.fornecedorSnapshot?.cnpj||supplier?.cnpj),buyer:digits(o?.cnpjComprador||c.cnpjComprador||arr(state,'unidades').find(u=>u.id===c.unidadeId)?.cnpj),os,official};
 });
 function itemsMatch(c,m){
  const expected=c.order?.itens?.length?c.order.itens:c.load.itensPedido?.length?c.load.itensPedido:c.load.itens;
  if(!Array.isArray(expected)||!expected.length||!Array.isArray(m.items)||!m.items.length)return false;
  const wanted=new Map();
  for(const line of expected){
   const p=arr(state,'produtos').find(x=>x.id===line.produtoId),q=Number(line.qtd);
   if(!p||!Number.isFinite(q)||q<=0)return false;
   if(!wanted.has(p.id))wanted.set(p.id,{q:0,names:distinct([line.produto,p.nome,p.nomeExatoContador].map(productKey)),unit:productKey(line.unidadeMedida||p.unidadeMedida||p.unidade)});
   wanted.get(p.id).q+=q;
  }
  const actual=new Map();
  const unit=v=>['SC','SACO','SACOS'].includes(v)?'SC':v;
  for(const line of m.items){
   const matches=[...wanted].filter(([,p])=>p.names.includes(productKey(line.description))&&unit(p.unit)===unit(productKey(line.unit)));
   if(matches.length!==1||!Number.isFinite(Number(line.quantity))||Number(line.quantity)<=0)return false;
   const id=matches[0][0];actual.set(id,(actual.get(id)||0)+Number(line.quantity));
  }
  return [...wanted].every(([id,p])=>actual.get(id)===p.q);
 }
 return xmlSources.filter(src=>{
  const m=src.metadata||{},raw=distinct((m.order_references||[]).map(ref));
  const os=distinct([...(m.customer_order_references||[]),...raw].map(osRef));
  const official=distinct([...(m.supplier_order_references||[]),...raw].filter(v=>!osRef(v)).map(officialNumberKey));
  if(src.kind!=='XML_NFE'||src.allowed!==true||!src.dossier_id||!/^[0-9]{44}$/.test(m.key||'')||m.protocol?.status!=='100'||os.length>1||official.length>1||(!os.length&&!official.length))return false;
  if((m.issues||[]).some(x=>/^(CHAVE_INVALIDA|CNPJ_INVALIDO|CNPJ_DESTINATARIO_NAO_CADASTRADO|IDENTIDADE_XML_DIVERGENTE|PROTOCOLO_AUTORIZACAO_DIVERGENTE|PRODUTOS_QUANTIDADES_OU_CODIGOS_INVALIDOS|VALORES_PRODUTOS_DIVERGENTES|DUPLICATAS_DIVERGENTES)$/.test(x)))return false;
  const matches=all.filter(c=>c.issuer.length===14&&c.buyer.length===14&&c.issuer===digits(m.issuer_cnpj)&&c.buyer===digits(m.recipient_cnpj)&&(os.length?c.os.includes(os[0])&&(!official.length||!c.official.length||c.official.every(n=>n===official[0])):c.official.includes(official[0])));
  if(matches.length!==1||matches[0].id!==cargaId||matches[0].load.status==='CANCELADA'||matches[0].load.finalizadaEm)return false;
  const c=matches[0];
  if(official.length&&all.some(other=>other.id!==c.id&&other.official.includes(official[0])))return false;
  // Current parser supplies items. Legacy references with no items remain compatible only if no new typed metadata is present.
  if(Array.isArray(m.items)||Array.isArray(m.customer_order_references)||Array.isArray(m.supplier_order_references)){if(!itemsMatch(c,m))return false;}
  const total=c.order?.itens?.reduce((sum,l)=>sum+Number(l.total),0);
  if(Number.isFinite(total)&&total>0&&Number.isSafeInteger(m.total_cents)&&Math.round(total*100)!==m.total_cents)return false;
  return true;
 });
}
