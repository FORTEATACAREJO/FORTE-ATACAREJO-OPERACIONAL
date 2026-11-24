import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierFreightMode,requireSupplierFreightMode,assertFreightSnapshot} from '../supabase/functions/orders-workflow/supplier-freight-mode.mjs';
import {applyWorkflow} from '../supabase/functions/orders-workflow/domain.mjs';

const profile={user_id:'master',empresa_id:'e',nome:'Master',perfil:'MASTER',ativo:true,status_aprovacao:'APROVADO'};
const setup=()=>({settings:{},unidades:[{id:'u',nome:'Forte',cnpj:'11111111000191'}],fornecedores:[{id:'f',nome:'CIPLAN',codigosPorCnpj:{'11111111000191':'FORTE-1'},condicaoPagamento:'14 DIAS'}],produtos:[{id:'p',fornecedorId:'f',nome:'Cimento',marca:'CIPLAN',pesoKg:50,precoNegociado:29,palletQtd:40}],motoristas:[{id:'m',nome:'Cleuber',placa1:'ABC1D23',capacidadeMaximaKg:40000}],cargas:[],vendas:[],documentos:[]});
const purchase={action:'SUPPLIER_CREATE',fornecedorId:'f',unidadeId:'u',pagamento:'14 DIAS',motoristaId:'m',itens:[{produtoId:'p',qtd:800}],origem:'Fabrica',destino:'Obra',destinoTipo:'GALPÃO',modalidadeFrete:'FOB',regraPallets:'Sem pallets',palletQuantidade:0};
let serial=0;
function workflow(s,body){serial++;return applyWorkflow(s,{...body,requestId:'frete-fornecedor-'+serial},profile,{id:'ev'+serial,at:'2026-11-22T12:00:00Z'}).state;}

test('a modalidade só é válida como CIF/FOB no cadastro do fornecedor',()=>{
 assert.equal(supplierFreightMode({modalidadeFrete:' cif '}),'CIF');
 assert.equal(supplierFreightMode({modalidadeFrete:'FOB'}),'FOB');
 assert.equal(supplierFreightMode({modalidadeFrete:'qualquer'}),'');
 assert.throws(()=>requireSupplierFreightMode({}),/cadastro do fornecedor/);
 assert.throws(()=>assertFreightSnapshot('CIF','FOB'),/diverge/);
});

test('nova compra sem modalidade cadastrada no fornecedor fica bloqueada',()=>{
 const s=setup();
 assert.throws(()=>workflow(s,purchase),/Configure CIF ou FOB no cadastro do fornecedor/);
});

test('pedido ignora modalidade enviada diferente e preserva o cadastro como fonte',()=>{
 const s=setup();s.fornecedores[0].modalidadeFrete='CIF';
 assert.throws(()=>workflow(s,purchase),/diverge/);
 const next=workflow(s,{...purchase,modalidadeFrete:'CIF'});
 assert.equal(next.comprasFornecedor[0].modalidadeFrete,'CIF');
 assert.equal(next.cargas[0].modalidadeFrete,'CIF');
 assert.equal(next.comprasFornecedor[0].fornecedorSnapshot.modalidadeFrete,'CIF');
});

test('alteração posterior do cadastro não muda carga antiga',()=>{
 const s=setup();s.fornecedores[0].modalidadeFrete='FOB';
 const first=workflow(s,purchase);
 first.fornecedores[0].modalidadeFrete='CIF';
 const carga=first.cargas[0];
 const selected=workflow(first,{action:'LOAD_ASSIGN',cargaId:carga.id,fornecedorId:'f',motoristaId:'m',origem:'Fabrica',destino:'Obra',modalidadeFrete:'FOB',regraPallets:'Sem pallets',palletQuantidade:0});
 assert.equal(selected.cargas[0].modalidadeFrete,'FOB');
 assert.equal(selected.comprasFornecedor[0].modalidadeFrete,'FOB');
 assert.throws(()=>workflow(selected,{action:'LOAD_ASSIGN',cargaId:carga.id,fornecedorId:'f',motoristaId:'m',origem:'Fabrica',destino:'Obra',modalidadeFrete:'CIF',regraPallets:'Sem pallets',palletQuantidade:0}),/diverge/);
});
