import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolBase,assignOrderProtocol} from '../supabase/functions/orders-workflow/order-protocol.mjs';
import {applyWorkflow} from '../supabase/functions/orders-workflow/domain.mjs';

test('Cleuber Júnior em 22/11/2027 gera Cleuberjunior221127',()=>{
 assert.equal(protocolBase('Cleuber Júnior','2027-11-22'),'Cleuberjunior221127');
 assert.equal(protocolBase('CLEUBER  JUNIOR','2027-11-22T14:00:00Z'),'Cleuberjunior221127');
 assert.equal(protocolBase('  Cleuber-Junior  ','2027-11-22'),'Cleuberjunior221127');
 assert.throws(()=>protocolBase('Cleuber Junior','2027-02-30'),/Data inválida/);
});

test('protocolo é único por carga e preserva histórico na troca de motorista',()=>{
 const s={cargas:[]};
 const first={id:'c1',criadaEm:'2027-11-22T12:00:00Z'};
 const second={id:'c2',criadaEm:'2027-11-22T12:00:00Z'};
 s.cargas.push(first,second);
 const driver={id:'m1',nome:'Cleuber Junior'};
 assert.equal(assignOrderProtocol(s,null,first,driver,'2027-11-22T12:01:00Z'),'Cleuberjunior221127');
 assert.equal(assignOrderProtocol(s,null,second,driver,'2027-11-22T12:02:00Z'),'Cleuberjunior221127-02');
 assert.equal(assignOrderProtocol(s,null,first,driver,'2027-11-22T13:00:00Z'),'Cleuberjunior221127');
 assert.equal(assignOrderProtocol(s,null,first,{id:'m2',nome:'João da Silva'},'2027-11-22T13:10:00Z'),'Joaodasilva221127');
 assert.deepEqual(first.protocoloHistorico.map(h=>h.valor),['Cleuberjunior221127']);
 const third={id:'c3',criadaEm:'2027-11-22T12:00:00Z'};s.cargas.push(third);
 assert.equal(assignOrderProtocol(s,null,third,driver,'2027-11-22T14:00:00Z'),'Cleuberjunior221127-03');
 first.ordemEnviadaEm='2027-11-22T15:00:00Z';
 assert.throws(()=>assignOrderProtocol(s,null,first,driver,'2027-11-22T16:00:00Z'),/não pode ser alterado/);
});

const actor={user_id:'master',empresa_id:'e',nome:'MASTER',perfil:'MASTER',ativo:true,status_aprovacao:'APROVADO'};
const data=()=>({
 settings:{},unidades:[{id:'u',nome:'Filial',cnpj:'11111111000191'}],
 fornecedores:[{id:'f',nome:'CSN',codigosPorCnpj:{'11111111000191':'COD-TESTE'},condicaoPagamento:'14 DIAS'}],
 produtos:[{id:'p',nome:'Cimento 50kg',marca:'CSN',pesoKg:50,precoNegociado:22,palletQtd:40}],
 locais:[{id:'l',nome:'Arcos',ativo:true}],
 custosFornecedor:[{fornecedorId:'f',produtoId:'p',condicaoPagamento:'14 DIAS',custoUnitario:22}],
 motoristas:[{id:'m',nome:'Cleuber Júnior',placa1:'ABC1D23',capacidadeMaximaKg:40000}],
 usuarios:[],clientes:[],cargas:[],comprasFornecedor:[],vendas:[],documentos:[]
});
const purchase={action:'SUPPLIER_CREATE',fornecedorId:'f',unidadeId:'u',pagamento:'14 DIAS',motoristaId:'m',itens:[{produtoId:'p',qtd:200}],regraPallets:'Sem pallets',palletQuantidade:0,origem:'Arcos',destino:'Galpão',destinoTipo:'GALPÃO',modalidadeFrete:'FOB'};
let sequence=0;
const run=(s,payload)=>applyWorkflow(s,{...payload,requestId:'proto-test-'+(++sequence)},actor,{id:'event-'+sequence,at:'2027-11-22T12:00:00Z'}).state;

test('novo pedido cria um protocolo visível no pedido e no dossiê',()=>{
 let s=run(data(),purchase);
 assert.equal(s.comprasFornecedor[0].protocolo,'Cleuberjunior221127');
 assert.equal(s.cargas[0].protocolo,'Cleuberjunior221127');
 s=run(s,purchase);
 assert.equal(s.comprasFornecedor[1].protocolo,'Cleuberjunior221127-02');
 assert.equal(s.cargas[1].protocolo,'Cleuberjunior221127-02');
});

test('compra sem motorista mantém identificador interno e recebe protocolo na atribuição',()=>{
 let s=run(data(),{...purchase,motoristaId:''});
 assert.equal(s.cargas.length,1);
 assert.equal(s.cargas[0].protocolo,undefined);
 const c=s.cargas[0];
 s=run(s,{action:'LOAD_ASSIGN',cargaId:c.id,fornecedorId:'f',modalidadeFrete:'FOB',origem:'Arcos',destino:'Galpão',motoristaId:'m',regraPallets:'Sem pallets',palletQuantidade:0});
 assert.equal(s.cargas[0].protocolo,'Cleuberjunior221127');
 assert.equal(s.comprasFornecedor[0].protocolo,'Cleuberjunior221127');
});
