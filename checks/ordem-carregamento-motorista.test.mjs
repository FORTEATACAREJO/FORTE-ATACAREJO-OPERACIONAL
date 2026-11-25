import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {purchaseReport} from '../apps/web/src/orders-reports.js';
import {driverOrderSnapshot,driverDispatchCheck} from '../supabase/functions/orders-workflow/driver-dispatch.mjs';
import {capacityCheck} from '../supabase/functions/orders-workflow/capacity.mjs';

const load=()=>({
 id:'load-1',codigo:'FC-000001',numeroOS:'OS-000001',protocolo:'PROTO-EXEMPLO',
 numeroPedidoFornecedor:'IND-7788',fornecedor:'CIPLAN CIMENTOS',unidade:'Filial Caldas Novas / GO',
 localCarregamento:'Fábrica CIPLAN — DF',destino:'Caldas Novas / GO',
 motoristaId:'m',motorista:'MOTORISTA MODELO',placas:['ABC1D23'],
 veiculoId:'vehicle-1',vinculoFrotaId:'link-1',transportadoraNome:'TRANSPORTADORA MODELO',
 motoristaSnapshot:{cpf:'00000000000',cnhNumero:'12345678901',rntrc:'RNTRC-EXEMPLO',capacidadeMaximaKg:40000,freteVeiculoId:''},
 itens:[
  {produto:'CIMENTO CIPLAN CP II-Z-32 50 KG',qtd:760,pesoKg:38000,custoUnitario:29,total:22040},
  {produto:'CIMENTO CIPLAN EXTRA FORTE 40 KG',qtd:50,pesoKg:2000,custoUnitario:27,total:1350}
 ],pesoKg:40000,regraPallets:'Sem pallets',palletQuantidade:0,
 ordemRevisadaEm:'2026-11-23T20:35:00.000Z',criadaEm:'2026-11-23T19:00:00.000Z',
 dataCarregamento:'2026-12-01',fretePorTon:140,freteValor:5600,
 chavePix:'pix-teste-nunca-divulgar',pagamento:'7/14/21 dias'
});

test('ordem do motorista A4 de uma página com referência da indústria e OS separadas',()=>{
 const doc=purchaseReport(load(),true),raw=doc.output();
 assert.equal(doc.getNumberOfPages(),1);
 for(const text of ['ORDEM DE CARREGAMENTO','MOTORISTA','OS-000001','IND-7788',
   'FORNECEDOR E LOCAL DE RETIRADA','MOTORISTA E VE','CIMENTO CIPLAN','760','50 KG','40.000 kg',
   'SEM','CONFIRMA']){}
 assert.match(raw,/ORDEM DE CARREGAMENTO/);
 assert.match(raw,/OS-000001/);
 assert(!raw.includes('FC-000001'));
 assert.match(raw,/IND-7788/);
 assert.match(raw,/CIPLAN CIMENTOS/);
 assert.match(raw,/ABC1D23/);
 assert.match(raw,/760/);
 assert.match(raw,/CIMENTO CIPLAN/);
 assert.match(raw,/TOTAL DA CARGA/);
});
test('ordem do motorista não expõe preços, Pix, condições de pagamento ou data prevista',()=>{
 const raw=purchaseReport(load(),true).output();
 for(const forbidden of ['R$','22.040','5600','pix-teste-nunca-divulgar','7/14/21 dias','01/12/2026',
 'PREÇO UNITÁRIO','VALOR DO FRETE','CHAVE PIX','BOLETO']){
  assert(!raw.includes(forbidden),'Dados financeiros/previstos foram indevidamente expostos: '+forbidden);
 }
});
test('não gera ordem do motorista sem número de pedido confirmado pela indústria',()=>{
 const x=load();x.numeroPedidoFornecedor='';
 assert.throws(()=>purchaseReport(x,true),/número oficial/);
});
test('itens extensos permanecem visíveis em páginas adicionais, sem dados de preço',()=>{
 const x=load();
 x.itens=Array.from({length:18},(_,i)=>({
  produto:'CIMENTO CIPLAN LOTE '+String(i+1).padStart(2,'0')+' 50 KG',
  qtd:40,pesoKg:2000,custoUnitario:25,total:1000
 }));
 x.pesoKg=36000;
 const pdf=purchaseReport(x,true),raw=pdf.output();
 assert(pdf.getNumberOfPages()>1);
 for(let i=1;i<=18;i++)assert(raw.includes('LOTE '+String(i).padStart(2,'0')));
 assert(!raw.includes('R$'));
});
test('snapshot do WhatsApp contém OS, placa vinculada e detalhes sem nenhum preço',()=>{
 const c=load(),j=driverOrderSnapshot(c);
 assert.equal(j.numeroOS,'OS-000001');
 assert.equal(j.numeroPedidoFornecedor,'IND-7788');
 assert.equal(j.veiculoId,'vehicle-1');
 assert.equal(j.vinculoFrotaId,'link-1');
 assert.equal(j.transportadoraNome,'TRANSPORTADORA MODELO');
 assert.equal(j.placas[0],'ABC1D23');
 assert(!JSON.stringify(j).includes('chavePix'));
 assert(!JSON.stringify(j).includes('custoUnitario'));
 assert(!JSON.stringify(j).includes('freteValor'));
 assert(!JSON.stringify(j).includes('pagamento'));
 assert(!JSON.stringify(j).includes('dataCarregamento'));
});
test('motorista vinculado pode enviar com placa do veículo, não placa histórica em seu cadastro',()=>{
 const c=load();
 const m={id:'m',nome:c.motorista,statusCadastro:'APROVADO',ativo:true,
   whatsapp:'64999999999',placa1:'PLACAANTIGA',capacidadeMaximaKg:20000};
 c.confirmacaoCapacidade={snapshot:capacityCheck({
   ...m,placa1:'ABC1D23',freteVeiculoId:'',capacidadeMaximaKg:40000,
   capacidadeAlvoKg:40000
 },c.pesoKg).snapshot};
 const state={cargas:[c],motoristas:[m]};
 const j={cargaId:c.id,snapshot:JSON.stringify(driverOrderSnapshot(c)),to:'5564999999999'};
 assert.equal(driverDispatchCheck(state,j),c);
 c.placas=['PLACAALTERADA'];
 assert.throws(()=>driverDispatchCheck(state,j),/Ordem, motorista ou WhatsApp alterado/);
});
test('botão de PDF e envio ao motorista exige pedido oficial e ordem revisada',()=>{
 const workspace=readFileSync(new URL('../apps/web/src/OrdersWorkspace.jsx',import.meta.url),'utf8');
 const operations=readFileSync(new URL('../apps/web/src/OrderOperations.jsx',import.meta.url),'utf8');
 const api=readFileSync(new URL('../supabase/functions/order-communications/index.ts',import.meta.url),'utf8');
 assert.match(workspace,/Gerar ordem de carregamento \(PDF\)/);
 assert.match(operations,/Enviar ordem ao motorista/);
 assert.match(operations,/!order\.numeroPedidoFornecedor\|\|!order\.ordemRevisadaEm/);
 assert.match(api,/verifyDriverVehicleLink\(/);
 assert.match(api,/\.from\('fc_frota_vinculos'\)/);
});
