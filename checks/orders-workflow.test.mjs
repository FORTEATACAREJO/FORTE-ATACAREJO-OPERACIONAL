import {capacityCheck,supplierDispatchCapacity} from '../supabase/functions/orders-workflow/capacity.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyWorkflow,matchingSupplierInvoices,supplierProducts,documentStatus,isResaleProduct,supplierCost,supplierExpeditions} from '../supabase/functions/orders-workflow/domain.mjs';
const p={user_id:'actor',empresa_id:'e',nome:'Admin',perfil:'MASTER',ativo:true,status_aprovacao:'APROVADO'};
const base=()=>({settings:{},unidades:[{id:'u',nome:'Filial',cnpj:'11111111000191'}],fornecedores:[{id:'f',nome:'CSN',modalidadeFrete:'FOB',codigosPorCnpj:{'11111111000191':'COD-TESTE'},condicaoPagamento:'14 DIAS'},{id:'g',nome:'CIPLAN',modalidadeFrete:'CIF',codigosPorCnpj:{'11111111000191':'COD-TESTE'},condicaoPagamento:'14 DIAS'}],produtos:[{id:'p',nome:'Cimento CSN',marca:'CSN',pesoKg:50,precoNegociado:22,palletQtd:50,precoTabela:34},{id:'q',nome:'Ciplan',marca:'CIPLAN',pesoKg:50,precoNegociado:22,palletQtd:50,precoTabela:34}],locais:[{id:'l',nome:'Arcos',ativo:true}],custosFornecedor:[{fornecedorId:'f',produtoId:'p',condicaoPagamento:'14 DIAS',custoUnitario:22}],motoristas:[{id:'m',nome:'Motorista',placa1:'ABC1D23',capacidadeMaximaKg:40000}],usuarios:[{id:'v',nome:'Vendedor'}],clientes:[{id:'c',nome:'Cliente',limiteCredito:100000}],cargas:[],vendas:[],documentos:[]});
const supplier={action:'SUPPLIER_CREATE',fornecedorId:'f',unidadeId:'u',pagamento:'14 DIAS',motoristaId:'m',itens:[{produtoId:'p',qtd:800}],regraPallets:'Sem pallets',palletQuantidade:0,origem:'Arcos',destino:'Galpão',destinoTipo:'GALPÃO',modalidadeFrete:'FOB'};
let seq=0;const execute=(s,b,actor=p)=>applyWorkflow(s,{...b,requestId:b.requestId||'r'+(++seq)},actor,{id:'id'+seq,at:'2026-10-09T02:00:00Z'});
function confirmed(){let o=execute(base(),supplier),s=o.state;const id=s.comprasFornecedor[0].id;s=execute(s,{action:'OFFICIAL_CONFIRM',id,numeroPedidoFornecedor:'123',evidencia:'Pedido portal 123'}).state;return s;}
test('fornecedor só exibe produtos vinculados, nunca de outra marca',()=>assert.deepEqual(supplierProducts(base(),'f').map(p=>p.id),['p']));
test('finalidade, classificação, inatividade e revenda falsa bloqueiam compra e venda comercial',()=>{
 for(const patch of [{finalidade:'USO E CONSUMO'},{purpose:'IMOBILIZADO'},{classificacao:'USO E CONSUMO'},{destinacao:'IMOBILIZADO'},{ativo:false},{revenda:false}]){
  const s=base();Object.assign(s.produtos[0],patch);assert.equal(isResaleProduct(s.produtos[0]),false);assert.deepEqual(supplierProducts(s,'f'),[]);assert.throws(()=>execute(s,supplier),/não vinculado/);assert.throws(()=>execute(s,sale),/não classificado|inativo/);
 }
 assert.equal(isResaleProduct(null),false);assert.equal(isResaleProduct({nome:'Cimento'}),true);
});
test('rascunho cria dossiê sem afirmar envio; retorno oficial reutiliza uma linha única',()=>{let s=execute(base(),supplier).state;assert.equal(s.cargas.length,1);assert.match(s.comprasFornecedor[0].status,/NÃO ENVIADO/);const b={action:'OFFICIAL_CONFIRM',id:s.comprasFornecedor[0].id,numeroPedidoFornecedor:'123',evidencia:'PDF'};s=execute(s,b).state;const loadId=s.cargas[0].id;s=execute(s,b).state;assert.equal(s.cargas.length,1);assert.equal(s.cargas[0].id,loadId);});
test('reenvio idempotente retorna mesmo resultado, mas reutilização com payload diferente bloqueia',()=>{const b={...supplier,requestId:'retry'};const out=execute(base(),b);const again=execute(out.state,b);assert(again.replayed);assert.equal(again.state.comprasFornecedor.length,1);assert.throws(()=>execute(out.state,{...b,destino:'Outro'}),/outra operação/);});
test('produto incompatível, excesso de peso e custo alterado sem permissão bloqueiam',()=>{assert.throws(()=>execute(base(),{...supplier,itens:[{produtoId:'q',qtd:1}]}),/não vinculado/);assert.throws(()=>execute(base(),{...supplier,itens:[{produtoId:'p',qtd:801}]}),/capacidade/);assert.throws(()=>execute(base(),{...supplier,itens:[{produtoId:'p',qtd:800,custoUnitario:23}]},{...p,perfil:'VENDEDOR_INTERNO'}),/Preço negociado mudou/);});
test('rascunho permite solicitar pallets; ordem exige autorização do fornecedor',()=>{let s=execute(base(),{...supplier,regraPallets:'Solicitar pallets com liberação do vendedor'},{...p,perfil:'VENDEDOR_INTERNO'}).state;const o=s.comprasFornecedor[0],c=s.cargas[0];assert.equal(o.liberacaoPalletsFornecedor,null);s=execute(s,{action:'OFFICIAL_CONFIRM',id:o.id,numeroPedidoFornecedor:'123',evidencia:'PDF'}).state;const b={...supplier,action:'LOADING_SAVE',cargaId:c.id,numeroPedidoFornecedor:'123',dataCarregamento:'2026-10-10',evidencia:'PDF'};assert.throws(()=>execute(s,b),/liberação/);assert.throws(()=>execute(s,{action:'PALLETS_RELEASE',cargaId:c.id,evidencia:'Fornecedor autorizou'},{...p,perfil:'VENDEDOR_INTERNO'}),/permissão/);s=execute(s,{action:'PALLETS_RELEASE',cargaId:c.id,evidencia:'Fornecedor autorizou em mensagem 123'}).state;s=execute(s,b).state;assert(s.cargas[0].ordemRevisadaEm);});
test('mesmo número oficial de outro pedido não duplica carga',()=>{let s=confirmed();s=execute(s,supplier).state;assert.throws(()=>execute(s,{action:'OFFICIAL_CONFIRM',id:s.comprasFornecedor[1].id,numeroPedidoFornecedor:'123',evidencia:'PDF'}),/outra carga/);});
test('envio exige arquivo comprovante e cria imediatamente o dossiê; nova confirmação reutiliza linha',()=>{let s=execute(base(),supplier).state;const id=s.comprasFornecedor[0].id;assert.throws(()=>execute(s,{action:'SUPPLIER_RECEIPT',id,canal:'WHATSAPP',destinatario:'55'}),/comprovante/);s.documentos=[{id:'d',compraFornecedorId:id,categoria:'COMPROVANTE ENVIO FORNECEDOR'}];s=execute(s,{action:'SUPPLIER_RECEIPT',id,canal:'WHATSAPP',destinatario:'55',documentoId:'d'}).state;assert.equal(s.cargas.length,1);const load=s.cargas[0].id;s=execute(s,{action:'OFFICIAL_CONFIRM',id,numeroPedidoFornecedor:'123',evidencia:'PDF'}).state;assert.equal(s.cargas[0].id,load);assert.equal(s.documentos[0].cargaId,load);});
const sale={action:'SALE_CREATE',clienteId:'c',vendedorId:'v',itens:[{produtoId:'p',marca:'CSN',qtd:800,precoUnitario:34}],formaPagamento:'PIX',condicaoPagamento:'À VISTA',destino:'Obra',fretePorTon:140};
test('venda interna nasce aprovada, frete por tonelada só é cobrado quando não incluso',()=>{let s=execute(base(),sale).state;assert.equal(s.vendas[0].status,'APROVADO');assert.equal(s.vendas[0].freteValor,5600);assert.equal(s.vendas[0].totalGeral,32800);s=execute(base(),{...sale,freteIncluso:true}).state;assert.equal(s.vendas[0].totalGeral,27200);assert.equal(s.boletosClientes,undefined);});
test('preço zero, marca errada e crédito insuficiente bloqueiam',()=>{assert.throws(()=>execute(base(),{...sale,itens:[{...sale.itens[0],precoUnitario:0}]}),/preço/);assert.throws(()=>execute(base(),{...sale,itens:[{...sale.itens[0],marca:'CIPLAN'}]}),/marca/);const s=base();s.clientes[0].limiteCredito=100;assert.throws(()=>execute(s,{...sale,formaPagamento:'BOLETO'}),/crédito/);});
test('pedido manual externo cria só uma carga, revisões da ordem reutilizam mesma linha',()=>{const b={...supplier,action:'LOADING_SAVE',numeroPedidoFornecedor:'789',dataCarregamento:'2026-10-09',evidencia:'Portal 789',fretePorTon:140};let s=execute(base(),b).state;assert.equal(s.cargas.length,1);assert.equal(s.cargas[0].codigo,'OS-000001');assert.equal(s.cargas[0].numeroOS,'OS-000001');assert.equal(s.cargas[0].freteValor,undefined);const id=s.cargas[0].id;s=execute(s,{action:'FREIGHT_SAVE',cargaId:id,fretePorTon:140}).state;assert.equal(s.cargas[0].freteValor,5600);s=execute(s,{...b,cargaId:id}).state;assert.equal(s.cargas.length,1);assert.equal(s.cargas[0].id,id);assert.equal(s.cargas[0].numeroOS,'OS-000001');assert(!s.cargas[0].ordemMotoristaEnviada);});
test('vínculo da venda controla quantidades por produto e recusa outra carga',()=>{let s=confirmed();s=execute(s,sale).state;const c=s.cargas[0].id,v=s.vendas[0].grupoPedidoId;s=execute(s,{action:'SALE_LINK',cargaId:c,vendaId:v}).state;assert.equal(s.cargas[0].vendaIds.length,1);s=execute(s,{...sale,itens:[{...sale.itens[0],qtd:1}]}).state;assert.throws(()=>execute(s,{action:'SALE_LINK',cargaId:c,vendaId:s.vendas.at(-1).grupoPedidoId}),/maior/);});
test('recebido não é validado; carga FOB não finaliza sem comprovante de frete',()=>{const s=confirmed(),c=s.cargas[0];s.documentos=[{id:'doc',cargaId:c.id,categoria:'COMPROVANTE FRETE',validationStatus:'RECEBIDO'}];assert.equal(documentStatus(s,c,'COMPROVANTE FRETE'),'RECEBIDO — CONFERIR');c.ordemMotoristaEnviada=true;assert.throws(()=>execute(s,{action:'LOAD_FINALIZE',cargaId:c.id}),/Documentos pendentes/);});
test('entrega exige finalização real e cobrança real, não fila de boleto',()=>{let s=confirmed();s=execute(s,{...sale,formaPagamento:'BOLETO'}).state;const c=s.cargas[0];s=execute(s,{action:'SALE_LINK',cargaId:c.id,vendaId:s.vendas[0].grupoPedidoId}).state;const cc=s.cargas[0];cc.ordemMotoristaEnviada=true;cc.destinoTipo='VENDA DIRETA';cc.nfPalletsAplica=false;s.documentos=['XML NF','PDF NF','BOLETO FORNECEDOR','COMPROVANTE FRETE','COMPROVANTE ENTREGA'].map((t,index)=>({id:'d'+index,cargaId:c.id,categoria:t,validationStatus:'VALIDADO'}));s.boletosClientes=[{id:'b',vendaId:s.vendas[0].id,status:'AGUARDANDO EMISSÃO API'}];s=execute(s,{action:'LOAD_FINALIZE',cargaId:c.id}).state;assert.equal(s.vendas[0].status,'APROVADO');s.boletosClientes[0].nossoNumero='real';s.boletosClientes[0].status='EMITIDO';s.boletosClientes[0].valor=s.vendas[0].totalGeral;s=execute(s,{action:'DOCUMENT_VALIDATE',cargaId:c.id,documentoId:'d0',evidencia:'XML 123'}).state;assert.equal(s.vendas[0].status,'ENTREGUE');assert.equal(s.estoqueMov,undefined);});
test('perfil motorista, cadastro pendente e senha temporária não operam',()=>{for(const patch of [{perfil:'MOTORISTA'},{status_aprovacao:'PENDENTE'},{trocar_senha:true}])assert.throws(()=>execute(base(),supplier,{...p,...patch}),/aprovado/);});
test('arquivo de outra empresa não entra no dossiê',()=>assert.throws(()=>execute(confirmed(),{action:'DOCUMENT_ADD',cargaId:confirmed().cargas[0].id,categoria:'XML NF',path:'outra/file.xml',hash:'a'.repeat(64),filename:'NF.xml'}),/não localizada|outra empresa/));

test('pallets usam quantidade cadastrada, arredondam automaticamente e ignoram valor manual',()=>{const s=execute(base(),{...supplier,regraPallets:'Com pallets',palletQuantidade:999,capacityConfirmation:capacityCheck(base().motoristas[0],5050).snapshot,itens:[{produtoId:'p',qtd:101}]}).state;assert.equal(s.comprasFornecedor[0].palletQuantidade,3);assert.equal(s.comprasFornecedor[0].nfPalletsAplica,true);const missing=base();delete missing.produtos[0].palletQtd;assert.throws(()=>execute(missing,{...supplier,regraPallets:'Com pallets'}),/quantidade por pallet/);});
test('custo vem exclusivamente do produto e falta de preço negociado bloqueia inclusive administrador',()=>{const s=base();s.produtos[0].precoNegociado=25;assert.equal(execute(s,supplier).state.comprasFornecedor[0].itens[0].custoUnitario,25);delete s.produtos[0].precoNegociado;assert.throws(()=>execute(s,supplier),/preço negociado/);assert.throws(()=>execute(base(),{...supplier,itens:[{produtoId:'p',qtd:800,custoUnitario:1}]}),/Preço negociado mudou/);});

import {filterOrders,driverSnapshot,mayReadDriverPayment} from '../supabase/functions/orders-workflow/complements.mjs';
test('CSN Direto e Fibra usam preços próprios sem substituição por preço padrão',()=>{const s=base();Object.assign(s.produtos[0],{precoNegociadoCsnDireto:21,precoNegociadoCsnFibra:24});for(const [mode,cost] of [['PADRAO',22],['CSN_DIRETO',21],['CSN_FIBRA',24]])assert.equal(execute(s,{...supplier,modalidadeCompra:mode}).state.comprasFornecedor[0].itens[0].custoUnitario,cost);delete s.produtos[0].precoNegociadoCsnFibra;assert.throws(()=>execute(s,{...supplier,modalidadeCompra:'CSN_FIBRA'}),/preço negociado/);assert.throws(()=>execute(s,{...supplier,modalidadeCompra:'INVALIDO'}),/inválida/);assert.throws(()=>execute(s,{...supplier,fornecedorId:'g',modalidadeCompra:'CSN_DIRETO',itens:[{produtoId:'q',qtd:10}]}),/somente para CSN/);});
test('800 sacos de 50 kg calculam 20 pallets de 40; 801 e valores inválidos bloqueiam',()=>{const s=base();s.produtos[0].palletQtd=40;const o=execute(s,{...supplier,regraPallets:'Com pallets'}).state.comprasFornecedor[0];assert.equal(o.pesoKg,40000);assert.equal(o.palletQuantidade,20);for(const qtd of [801,'abc',NaN,Infinity,0,-1,1.1])assert.throws(()=>execute(s,{...supplier,itens:[{produtoId:'p',qtd}]}));});
test('ajuste manual de pallets exige justificativa e preserva sugestão',()=>{assert.throws(()=>execute(base(),{...supplier,regraPallets:'Com pallets',palletQuantidadeAjustada:20}),/justificativa/);const o=execute(base(),{...supplier,regraPallets:'Com pallets',palletQuantidadeAjustada:20,justificativaPallets:'Fornecedor exige embalagens adicionais'}).state.comprasFornecedor[0];assert.equal(o.palletQuantidade,20);assert.equal(o.palletQuantidadeSugerida,16);assert.throws(()=>execute(base(),{...supplier,palletQuantidadeAjustada:1,justificativaPallets:'x'}),/quantidade zero/);});
test('edição conserva pedido e dossiê, guarda histórico e invalida envio pendente',()=>{let s=execute(base(),supplier).state;const o=s.comprasFornecedor[0],c=s.cargas[0];s.comunicacoes=[{id:'queue',compraFornecedorId:o.id,state:'QUEUED'}];s=execute(s,{...supplier,action:'SUPPLIER_EDIT',id:o.id,motivo:'Ajuste do destino',destino:'Outra obra',capacityConfirmation:capacityCheck(base().motoristas[0],38000).snapshot,itens:[{produtoId:'p',qtd:760}]}).state;assert.equal(s.comprasFornecedor.length,1);assert.equal(s.cargas.length,1);assert.equal(s.cargas[0].id,c.id);assert.equal(s.comprasFornecedor[0].numero,o.numero);assert.equal(s.comprasFornecedor[0].historico.at(-1).acao,'EDIÇÃO');assert.equal(s.comunicacoes[0].state,'CANCELLED');assert.equal(s.cargas[0].localCarregamento,'Arcos');assert.equal(s.cargas[0].qtdSemDestino,760);s.comunicacoes[0].state='SENT';assert.throws(()=>execute(s,{...supplier,action:'SUPPLIER_EDIT',id:o.id,motivo:'x'}),/não pode ser editado/);});
test('cancelamento preserva registro e auditabilidade, impede envio e novo número reutilizado',()=>{let s=execute(base(),supplier).state;const o=s.comprasFornecedor[0];s.comunicacoes=[{id:'queue',compraFornecedorId:o.id,state:'BLOCKED'}];s=execute(s,{action:'SUPPLIER_CANCEL',id:o.id,motivo:'Compra cancelada'}).state;assert.equal(s.comprasFornecedor[0].status,'CANCELADO');assert.equal(s.comprasFornecedor[0].historico.at(-1).acao,'CANCELAMENTO');assert.equal(s.cargas[0].status,'CANCELADA');assert.equal(s.comunicacoes[0].state,'CANCELLED');assert.throws(()=>execute(s,{action:'SUPPLIER_PREVIEW',id:o.id}),/não localizado/);s=execute(s,supplier).state;assert.notEqual(s.comprasFornecedor[1].numero,o.numero);});
test('snapshot de identidade preserva dados anteriores sem copiar Pix privado',()=>{const s=base();Object.assign(s.motoristas[0],{cnhNumero:'999',rntrc:'RN1',cpf:'123',chavePix:'PRIVADO'});const out=execute(s,supplier).state;out.motoristas[0].cnhNumero='OUTRO';assert.equal(out.comprasFornecedor[0].motoristaSnapshot.cnhNumero,'999');assert.equal(out.comprasFornecedor[0].motoristaSnapshot.chavePix,undefined);assert.equal(driverSnapshot(s.motoristas[0]).chavePix,undefined);assert.equal(mayReadDriverPayment({...p,perfil:'VENDEDOR_INTERNO',permissoes:{}}),false);assert.equal(mayReadDriverPayment(p),true);});
test('filtros combinados ignoram acentos e formatação da placa e CPF',()=>{const o=execute(base(),supplier).state.comprasFornecedor[0];assert.equal(filterOrders([o],{query:'ABC-1D23',status:o.status,from:'2026-10-01',to:'2026-10-10'}).length,1);assert.equal(filterOrders([o],{query:'ABC1D23',from:'2026-10-10'}).length,0);assert.equal(filterOrders([o],{query:'Címento CSN'}).length,1);});


test('capacidade: abaixo exige Sim específico; igual permite e excesso nunca admite confirmação',()=>{
 const original=base(),partial={...supplier,itens:[{produtoId:'p',qtd:760}]};
 for(const capacityConfirmation of [undefined,false,true,'SIM'])assert.throws(()=>execute(original,{...partial,capacityConfirmation}),/Confirme Sim ou Não/);
 assert.equal(original.cargas.length,0);
 const check=capacityCheck(original.motoristas[0],38000);assert.equal(check.remaining,2000);
 const saved=execute(original,{...partial,capacityConfirmation:check.snapshot});
 assert.equal(saved.state.cargas[0].pesoKg,38000);assert.equal(saved.result.capacidade.actor,p.user_id);
 assert.equal(execute(base(),supplier).state.cargas[0].pesoKg,40000);
 assert.throws(()=>execute(base(),{...supplier,itens:[{produtoId:'p',qtd:801}],capacityConfirmation:check.snapshot}),/acima da capacidade/);
});
test('capacidade: confirmações antigas não valem após trocar peso, veículo ou capacidade',()=>{
 const partial={...supplier,itens:[{produtoId:'p',qtd:760}]},capacityConfirmation=capacityCheck(base().motoristas[0],38000).snapshot;
 assert.throws(()=>execute(base(),{...partial,itens:[{produtoId:'p',qtd:750}],capacityConfirmation}),/Confirme/);
 for(const patch of [{capacidadeMaximaKg:42000},{freteVeiculoId:'novo-conjunto'},{placa2:'NOVA002'}]){const s=base();Object.assign(s.motoristas[0],patch);assert.throws(()=>execute(s,{...partial,capacityConfirmation}),/Confirme/);}
});
test('capacidade: envio reconfere limite atual mesmo após gravar e conferir espelho',()=>{
 let s=execute(base(),supplier).state;const id=s.comprasFornecedor[0].id;
 s.fornecedores[0].emailPedidos='fornecedor@example.invalid';s=execute(s,{action:'SUPPLIER_PREVIEW',id}).state;
 s.motoristas[0].capacidadeMaximaKg=39000;assert.throws(()=>execute(s,{action:'SUPPLIER_SEND',id,canal:'EMAIL'}),/acima da capacidade/);assert.equal(s.comunicacoes?.length||0,0);
 s.motoristas[0].capacidadeMaximaKg=42000;assert.throws(()=>execute(s,{action:'SUPPLIER_SEND',id,canal:'EMAIL'}),/Confirme/);
 const capacityConfirmation=capacityCheck(s.motoristas[0],40000).snapshot;
 s=execute(s,{action:'SUPPLIER_SEND',id,canal:'EMAIL',capacityConfirmation}).state;
 assert.equal(s.comunicacoes[0].state,'QUEUED');assert.equal(supplierDispatchCapacity(s,s.comunicacoes[0]).remaining,2000);
 s.motoristas[0].capacidadeMaximaKg=39000;assert.throws(()=>supplierDispatchCapacity(s,s.comunicacoes[0]),/acima da capacidade/);
 s.motoristas[0].capacidadeMaximaKg=43000;assert.throws(()=>supplierDispatchCapacity(s,s.comunicacoes[0]),/Confirme/);
});
test('capacidade: ajuste parcial exige decisão e envio bloqueado volta à fila após nova conferência',()=>{
 let s=execute(base(),supplier).state;const c=s.cargas[0],o=s.comprasFornecedor[0];
 const adjustment={action:'LOAD_ADJUST',cargaId:c.id,itens:[{produtoId:'p',qtd:760}],motivo:'Teste capacidade'};
 assert.throws(()=>execute(s,adjustment),/Confirme/);
 s=execute(s,{...adjustment,capacityConfirmation:capacityCheck(s.motoristas[0],38000).snapshot}).state;
 s.fornecedores[0].emailPedidos='fornecedor@example.invalid';s=execute(s,{action:'SUPPLIER_PREVIEW',id:o.id}).state;
 const send={action:'SUPPLIER_SEND',id:o.id,canal:'EMAIL',capacityConfirmation:capacityCheck(s.motoristas[0],38000).snapshot};
 s=execute(s,send).state;s.comunicacoes[0].state='BLOCKED';s.comunicacoes[0].reason='CAPACIDADE: mudou';
 s.motoristas[0].capacidadeMaximaKg=42000;
 s=execute(s,{...send,capacityConfirmation:capacityCheck(s.motoristas[0],38000).snapshot}).state;
 assert.equal(s.comunicacoes.length,1);assert.equal(s.comunicacoes[0].state,'QUEUED');assert.equal(supplierDispatchCapacity(s,s.comunicacoes[0]).max,42000);
});

test('frete interno exige ordem pronta e autorização, preserva valor ao revisar ordem e bloqueia pagamento validado',()=>{
 const b={...supplier,action:'LOADING_SAVE',numeroPedidoFornecedor:'FIN-123',dataCarregamento:'2026-10-09',evidencia:'Portal'};
 let s=execute(base(),supplier).state;const c=s.cargas[0];assert.throws(()=>execute(s,{action:'FREIGHT_SAVE',cargaId:c.id,fretePorTon:100}),/Prepare a ordem/);
 s=execute(s,{...b,cargaId:c.id}).state;assert.equal(s.cargas[0].freteValor,undefined);
 const financial={action:'FREIGHT_SAVE',cargaId:c.id,fretePorTon:100};assert.throws(()=>execute(s,financial,{...p,perfil:'VENDEDOR_INTERNO'}),/autorização/);
 s=execute(s,financial).state;assert.equal(s.cargas[0].freteValor,4000);assert.equal(s.cargas[0].historicoFinanceiro.length,1);
 s=execute(s,{...b,cargaId:c.id,fretePorTon:999}).state;assert.equal(s.cargas[0].freteValor,4000);
 s.documentos=[{cargaId:c.id,categoria:'COMPROVANTE FRETE',validationStatus:'VALIDADO'}];assert.throws(()=>execute(s,{...financial,fretePorTon:110}),/revisão financeira/);
});

test('RF06: pedido de 800 sacos em conjunto 38t exige aviso e preserva 800 ao expedir 760',()=>{
 const original=base();original.motoristas[0].capacidadeMaximaKg=38000;
 const confirmation=capacityCheck(original.motoristas[0],40000,{request:true});assert.equal(confirmation.above,true);
 assert.throws(()=>execute(original,supplier),/acima da capacidade/);
 let state=execute(original,{...supplier,capacityConfirmation:confirmation.snapshot}).state;
 const order=structuredClone(state.comprasFornecedor[0]),load=state.cargas[0];assert.equal(order.qtd,800);assert.equal(load.pesoKg,40000);
 assert.throws(()=>execute(state,{...supplier,action:'LOAD_ASSIGN',cargaId:load.id,motoristaId:'m'}),/capacidade/);
 state=execute(state,{action:'LOAD_SHIPMENT',cargaId:load.id,motoristaId:'m',itens:[{produtoId:'p',qtd:760}],motivo:'Quantidade ajustada à capacidade aprovada'}).state;
 assert.deepEqual(state.comprasFornecedor[0],order);assert.equal(state.cargas[0].qtdPedida,800);assert.equal(state.cargas[0].pesoPedidoKg,40000);assert.equal(state.cargas[0].qtd,760);assert.equal(state.cargas[0].pesoKg,38000);
 assert.throws(()=>execute(state,{action:'LOAD_SHIPMENT',cargaId:load.id,motoristaId:'m',itens:[{produtoId:'p',qtd:801}],motivo:'Excesso não permitido'}),/superar/);
 assert.throws(()=>capacityCheck(original.motoristas[0],40000),/acima da capacidade/);
});

test('pedido usa o catálogo, custo e condição de paletes do fornecedor',()=>{
 const data=base();
 data.fornecedores[0].produtosNegociados=[{produtoId:'p',custoUnitario:26.75}];
 data.fornecedores[0].condicaoPaletes='COM_PALETES';
 assert.throws(()=>execute(data,supplier),/condição de paletes/);
 const order=execute(data,{...supplier,regraPallets:undefined}).state.comprasFornecedor[0];
 assert.equal(order.regraPallets,'Com pallets');
 assert.equal(order.palletQuantidade,16);
 assert.equal(order.custoTotal,21400);
 assert.throws(()=>execute(data,{...supplier,regraPallets:undefined,itens:[{produtoId:'q',qtd:1}]}),/não vinculado/);
});


test('issue 11: condição composta é registrada, salva, reaberta e editada sem perder vencimentos',()=>{
 let s=base();s.fornecedores[0].prazosPagamento=['7/14/21'];
 s=execute(s,{action:'SUPPLIER_TERM',fornecedorId:'f',pagamento:'7,14,21 dias'}).state;
 assert.deepEqual(s.fornecedores[0].prazosPagamento,['7/14/21 dias']);
 s=execute(s,{...supplier,pagamento:'7/14/21 dias'}).state;
 const order=s.comprasFornecedor[0];assert.equal(order.pagamento,'7/14/21 dias');
 assert.deepEqual(order.vencimentosPagamento,[{dias:7,vencimento:'2026-10-15'},{dias:14,vencimento:'2026-10-22'},{dias:21,vencimento:'2026-10-29'}]);
 assert.deepEqual(s.cargas[0].vencimentosPagamento,order.vencimentosPagamento);
 s=JSON.parse(JSON.stringify(s));s.fornecedores[0].prazosPagamento=['28 dias'];
 s=execute(s,{...supplier,action:'SUPPLIER_EDIT',id:order.id,pagamento:order.pagamento,motivo:'Teste de reabertura',destino:'Outro galpão'}).state;
 assert.equal(s.comprasFornecedor[0].pagamento,order.pagamento);assert.deepEqual(s.comprasFornecedor[0].vencimentosPagamento,order.vencimentosPagamento);
 assert.equal(s.cargas[0].condicaoFornecedor,order.pagamento);
});

test('preço por expedição: mesmo produto, dois locais, sem alterar o preço geral de outros fornecedores',()=>{
 const s=base();
 s.fornecedores[0].produtosNegociados=[{produtoId:'p',custoUnitario:22}];
 s.fornecedores[1].produtosNegociados=[{produtoId:'q',custoUnitario:28.9275}];
 s.locais.push({id:'sob',nome:'Sobradinho',ativo:true},{id:'ede',nome:'Edealina',ativo:true});
 s.fornecedores[0].cotacoesPorLocal=[
  {produtoId:'p',unidadeId:'u',cnpjComprador:'11111111000191',localCarregamentoId:'sob',precoUnitarioExibido:27.21,dataCotacao:'2026-11-24'},
  {produtoId:'p',unidadeId:'u',cnpjComprador:'11111111000191',localCarregamentoId:'ede',precoUnitarioExibido:27.54,dataCotacao:'2026-11-24'}
 ];
 assert.equal(supplierCost(s,'f','p','PADRAO','Sobradinho','u'),27.21);
 assert.equal(supplierCost(s,'f','p','PADRAO','Edealina','u'),27.54);
 assert.equal(supplierCost(s,'f','p','PADRAO','Arcos','u'),undefined);
 assert.equal(supplierCost(s,'f','p','PADRAO','Sobradinho','outra'),undefined);
 assert.equal(supplierCost(s,'g','q','PADRAO','Arcos','u'),28.9275);
 const a=execute(s,{...supplier,origem:'Sobradinho'}).state.comprasFornecedor[0];
 const b=execute(s,{...supplier,origem:'Edealina'}).state.comprasFornecedor[0];
 assert.equal(a.itens[0].custoUnitario,27.21);
 assert.equal(b.itens[0].custoUnitario,27.54);
 assert.throws(()=>execute(s,{...supplier,origem:'Arcos'}),/expedição/);
 assert.throws(()=>execute(s,{...supplier,origem:'Sobradinho',itens:[{produtoId:'p',qtd:800,custoUnitario:27.2101}]}),/Preço negociado mudou/);
});

test('expedições vinculadas: fornecedor geral mantém o preço, local alheio bloqueia',()=>{
 const s=base();
 s.locais.push({id:'l2',nome:'Pedro Leopoldo',ativo:true},{id:'l3',nome:'Sobradinho',ativo:true});
 s.fornecedores[0].expedicoes=['l','l2'];
 s.fornecedores[0].produtosNegociados=[{produtoId:'p',custoUnitario:22}];
 assert.deepEqual(supplierExpeditions(s,'f').map(l=>l.id),['l','l2']);
 assert.equal(supplierCost(s,'f','p','PADRAO','Arcos','u'),22);
 assert.equal(supplierCost(s,'f','p','PADRAO','Pedro Leopoldo','u'),22);
 assert.equal(supplierCost(s,'f','p','PADRAO','Sobradinho','u'),undefined);
 assert.equal(execute(s,{...supplier,origem:'Pedro Leopoldo'}).state.comprasFornecedor[0].itens[0].custoUnitario,22);
 assert.throws(()=>execute(s,{...supplier,origem:'Sobradinho'}),/expedição cadastrada/);
});

test('motorista administrativamente liberado permite rascunho e envio comercial, mas não expedição',()=>{
 const s=base();Object.assign(s.motoristas[0],{ativo:false,statusCadastro:'PENDENTE_DOCUMENTOS',cadastroAdministrativoLiberado:true,documentosConferidos:false});
 const saved=execute(s,supplier).state;const order=saved.comprasFornecedor[0];
 assert.equal(order.motoristaId,'m');assert.equal(order.protocolo,'');assert.deepEqual(order.placas,[]);
 assert.throws(()=>execute(saved,{action:'SUPPLIER_SEND',id:order.id,canal:'EMAIL'}),/espelho/);
 saved.fornecedores[0].emailPedidos='teste@example.invalid';
 const reviewed=execute(saved,{action:'SUPPLIER_PREVIEW',id:order.id}).state;
 const sent=execute(reviewed,{action:'SUPPLIER_SEND',id:order.id,canal:'EMAIL'}).state;
 assert.equal(sent.comunicacoes[0].state,'QUEUED');
 assert.equal(sent.comunicacoes[0].order.pedidoComercialSemLiberacao,true);
 assert.match(sent.comunicacoes[0].message,/não autoriza carregamento/);
 assert.equal(supplierDispatchCapacity(sent,sent.comunicacoes[0]).commercialOnly,true);
 assert.equal(sent.cargas[0].ordemRevisadaEm,undefined);
 const altered=structuredClone(sent);altered.comprasFornecedor[0].destino='Outro';assert.throws(()=>supplierDispatchCapacity(altered,altered.comunicacoes[0]),/alterado/);
 const prepared=execute(saved,{action:'LOAD_ASSIGN',prepararCadastro:true,cargaId:saved.cargas[0].id,fornecedorId:'f',motoristaId:'m'}).state;
 assert.equal(prepared.cargas[0].motoristaId,'m');assert.equal(prepared.cargas[0].ordemRevisadaEm,null);assert.deepEqual(prepared.cargas[0].placas,[]);assert.equal(prepared.comprasFornecedor[0].numero,order.numero);assert.equal(prepared.motoristas[0].documentosConferidos,false);
 const blocked=structuredClone(sent);blocked.motoristas[0].statusCadastro='INATIVO';assert.throws(()=>supplierDispatchCapacity(blocked,blocked.comunicacoes[0]));
 assert.throws(()=>execute(saved,{action:'LOAD_ASSIGN',cargaId:saved.cargas[0].id,motoristaId:'m',origem:'Arcos',destino:'Galpão'}),/aguarda aprovação|não localizado ou inativo/);
 s.motoristas[0].statusCadastro='INATIVO';assert.throws(()=>execute(s,supplier),/aguarda aprovação|não localizado ou inativo/);
});
test('aprovação individual admite data ausente quando responsável confirma CNH vigente, mas não admite CNH vencida',()=>{
 const s=base();const review={action:'DRIVER_REVIEW',motoristaId:'m',cpf:'52998224725',cnhNumero:'01234567890',cnhCategoria:'AE',telefone:'34999999999',aprovar:true,documentosConferidos:true,confirmacaoResponsavel:true,referenciaConferencia:'CNH original vigente conferida'};
 const saved=execute(s,review).state;assert.equal(saved.motoristas[0].ativo,true);
 assert.throws(()=>execute(s,{...review,cnhValidade:'2025-10-08'}),/vencida/);
 assert.throws(()=>execute(s,{...review,documentosConferidos:false}),/conferência/);
});

test('avisos cadastrais informam falta de telefone e CNH vencida sem excluir motorista do rascunho',async()=>{
 const {driverRegistrationWarnings,isDriverDraftSelectable}=await import('../apps/web/src/pedidos-ft-drivers.mjs');
 const m={id:'m',nome:'Motorista',ativo:false,statusCadastro:'PENDENTE_DOCUMENTOS',cadastroAdministrativoLiberado:true,cpf:'52998224725',cnhNumero:'01234567890',cnhCategoria:'AE',cnhValidade:'2025-01-01'};
 const warnings=driverRegistrationWarnings(m,'2026-11-24');
 assert(warnings.some(w=>w.includes('vencida')));assert(warnings.some(w=>w.includes('Telefone')));
 assert(isDriverDraftSelectable(m));
 assert(!driverRegistrationWarnings({...m,cnhValidade:''},'2026-11-24').some(w=>w.includes('validade')));
});

 test('ordem de compra externa fica por venda e item sem substituir a OS da carga',()=>{
 const initial=confirmed();initial.clientes.push({id:'c2',nome:'Outra construtora',limiteCredito:100000});
 const one=execute(initial,{...sale,ordemCompraCliente:'000OC-128',itens:[{...sale.itens[0],qtd:10,itemOrdemCompraCliente:'7'}]}).state;
 const two=execute(one,{...sale,clienteId:'c2',ordemCompraCliente:'OC-999',itens:[{...sale.itens[0],qtd:5}]}).state;
 assert.equal(two.vendas[0].ordemCompraCliente,'000OC-128');assert.equal(two.vendas[0].itemOrdemCompraCliente,7);assert.equal(two.vendas[1].ordemCompraCliente,'OC-999');assert.equal(two.vendas[1].itemOrdemCompraCliente,null);
 const linked=execute(execute(two,{action:'SALE_LINK',cargaId:two.cargas[0].id,vendaId:two.vendas[0].grupoPedidoId}).state,{action:'SALE_LINK',cargaId:two.cargas[0].id,vendaId:two.vendas[1].grupoPedidoId}).state;
 assert.equal(linked.cargas[0].numeroOS,initial.cargas[0].numeroOS);assert.equal(linked.vendas[0].ordemCompraCliente,'000OC-128');assert.equal(linked.vendas[1].ordemCompraCliente,'OC-999');
 assert.throws(()=>execute(initial,{...sale,ordemCompraCliente:'1234567890123456'}),/15 caracteres/);
 assert.throws(()=>execute(initial,{...sale,itens:[{...sale.itens[0],itemOrdemCompraCliente:'2'}]}),/ordem correspondente/);
 });

test('vínculo automático exige XML autorizado, CNPJs e referência inequívoca',()=>{
 const s={fornecedores:[{id:'f',cnpj:'11111111000191'}],unidades:[{id:'u',cnpj:'22222222000191'}],cargas:[{id:'c',fornecedorId:'f',unidadeId:'u',numeroOS:'OS-000001'}]};
 const src={id:'x',kind:'XML_NFE',allowed:true,dossier_id:'d',metadata:{key:'1'.repeat(44),issuer_cnpj:'11111111000191',recipient_cnpj:'22222222000191',order_references:['OS-000001'],protocol:{status:'100'}}};
 assert.equal(matchingSupplierInvoices(s,'c',[src]).length,1);
 assert.equal(matchingSupplierInvoices(s,'c',[{...src,metadata:{...src.metadata,recipient_cnpj:'33333333000191'}}]).length,0);
 assert.equal(matchingSupplierInvoices({...s,cargas:[...s.cargas,{...s.cargas[0],id:'other'}]},'c',[src]).length,0);
});

test('anexar vários boletos do cliente preserva venda e rejeita venda de outra carga',()=>{
 let s=confirmed();s=execute(s,sale).state;
 const c=s.cargas[0].id,v=s.vendas[0].grupoPedidoId;
 const body={action:'DOCUMENT_ADD',cargaId:c,vendaId:v,categoria:'BOLETO CLIENTE',path:'e/1.pdf',hash:'a'.repeat(64),filename:'1.pdf'};
 assert.throws(()=>execute(s,body),/mesmo cliente e da mesma carga/);
 s=execute(s,{action:'SALE_LINK',cargaId:c,vendaId:v}).state;
 s=execute(s,body).state;
 s=execute(s,{...body,path:'e/2.pdf',hash:'b'.repeat(64),filename:'2.pdf'}).state;
 assert.equal(s.documentos.filter(x=>x.categoria==='BOLETO CLIENTE').length,2);
 assert(s.documentos.every(x=>x.clienteId==='c'&&x.cargaId===c&&x.vendaId===v&&x.validationStatus==='RECEBIDO'));
});


test('OS no rodapé e xPed permitem encontrar a compra ainda sem número oficial, sem misturar cargas',()=>{
 const s={fornecedores:[{id:'f',cnpj:'00057240000122'}],unidades:[{id:'u',cnpj:'49832961000232'}],produtos:[{id:'cp',nome:'CIMENTO CP II Z 32 50 KG',nomeExatoContador:'CIMENTO CIPLAN USO GERAL 50KG'},{id:'ac',nome:'ARGAMASSA AC2 CIPLAN 20 KG',nomeExatoContador:'ARGAMASSA COLANTE ACII 20 KG'}],cargas:[{id:'c',fornecedorId:'f',unidadeId:'u',numeroOS:'OS-000002',compraFornecedorId:'o'},{id:'other',fornecedorId:'f',unidadeId:'u',numeroOS:'OS-000001'}],comprasFornecedor:[{id:'o',cargaId:'c',numero:'OS-000002',itens:[{produtoId:'cp',qtd:760,unidadeMedida:'SACO',total:21984.90},{produtoId:'ac',qtd:100,unidadeMedida:'SACO',total:1514.30}]}]};
 const metadata={key:'1'.repeat(44),issuer_cnpj:'00057240000122',recipient_cnpj:'49832961000232',order_references:['OS-000002','41561380'],customer_order_references:['OS-000002'],supplier_order_references:['41561380'],protocol:{status:'100'},items:[{description:'ARGAMASSA COLANTE ACII 20 KG',quantity:100,unit:'SC'},{description:'CIMENTO CIPLAN USO GERAL 50KG',quantity:760,unit:'SC'}],total_cents:2349920};
 const src={id:'xml',kind:'XML_NFE',allowed:true,dossier_id:'d',metadata};
 const match=(state=s,patch={})=>matchingSupplierInvoices(state,'c',[{...src,metadata:{...metadata,...patch}}]).length;
 assert.equal(match(),1);
 assert.equal(matchingSupplierInvoices(s,'other',[src]).length,0);
 assert.equal(match(s,{items:[metadata.items[0],{...metadata.items[1],quantity:759}]}),0);
 assert.equal(match(s,{total_cents:2349921}),0);
 assert.equal(match(s,{recipient_cnpj:'49832961000151'}),0);
 assert.equal(match(s,{customer_order_references:['OS-000001']}),0);
 assert.equal(match({...s,cargas:s.cargas.map(c=>c.id==='other'?{...c,numeroPedidoFornecedor:'41561380'}:c)}),0);
 assert.equal(match({...s,cargas:s.cargas.map(c=>c.id==='c'?{...c,numeroPedidoFornecedor:'99999'}:c)}),0);
});
