import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyWorkflow} from '../supabase/functions/orders-workflow/domain.mjs';

const actor={user_id:'master',empresa_id:'e',nome:'MASTER',perfil:'MASTER',ativo:true,status_aprovacao:'APROVADO'};
const state=()=>({
 settings:{},unidades:[{id:'u',nome:'Filial',cnpj:'11111111000191'}],
 fornecedores:[{id:'f',nome:'CIPLAN',modalidadeFrete:'CIF',codigosPorCnpj:{'11111111000191':'242489'},condicaoPagamento:'14 DIAS'}],
 produtos:[{id:'p',nome:'Cimento 50kg',marca:'CIPLAN',pesoKg:50,precoNegociado:30,palletQtd:40}],
 custosFornecedor:[{fornecedorId:'f',produtoId:'p',condicaoPagamento:'14 DIAS',custoUnitario:30}],
 motoristas:[],cargas:[],comprasFornecedor:[],vendas:[],documentos:[]
});
const purchase={action:'SUPPLIER_CREATE',fornecedorId:'f',unidadeId:'u',pagamento:'14 DIAS',
 motoristId:'',motoristaId:'',itens:[{produtoId:'p',qtd:100}],
 regraPallets:'Sem pallets',palletQuantidade:0,origem:'Arcos',destino:'Galpão',
 destinoTipo:'GALPÃO',modalidadeFrete:'CIF'};
let number=0;
const commit=(s,body,at='2026-11-23T20:00:00.000Z')=>{
 const n=++number;
 return applyWorkflow(s,{...body,requestId:'os-test-'+n},actor,{id:'audit-os-'+n,at});
};

test('primeiro pedido recebe OS-000001, novos pedidos seguem sem reiniciar por ano',()=>{
 let s=state();
 const a=commit(s,purchase);s=a.state;
 assert.equal(a.result.numero,'OS-000001');
 assert.equal(s.comprasFornecedor[0].numero,'OS-000001');
 assert.equal(s.cargas[0].numeroOS,'OS-000001');
 assert.match(s.cargas[0].codigo,/^FC-000001$/);
 const b=commit(s,purchase,'2026-12-31T23:50:00.000Z');s=b.state;
 assert.equal(b.result.numero,'OS-000002');
 const c=commit(s,purchase,'2027-01-01T00:01:00.000Z');s=c.state;
 assert.equal(c.result.numero,'OS-000003');
 assert.equal(s.settings.nextOsSeq,4);
 assert.equal(s.comprasFornecedor.length,3);
 assert.equal(new Set(s.comprasFornecedor.map(x=>x.numero)).size,3);
});
test('editar a OS não gera outra sequência; cancelar mantém o número ocupado',()=>{
 let s=commit(state(),purchase).state;
 const id=s.comprasFornecedor[0].id;
 const edit=commit(s,{...purchase,action:'SUPPLIER_EDIT',id,motivo:'Atualização da quantidade'});
 s=edit.state;
 assert.equal(s.comprasFornecedor[0].numero,'OS-000001');
 assert.equal(s.settings.nextOsSeq,2);
 const canceled=commit(s,{action:'SUPPLIER_CANCEL',id,motivo:'Negociação cancelada'});
 s=canceled.state;
 assert.equal(s.comprasFornecedor[0].numero,'OS-000001');
 assert.equal(s.comprasFornecedor[0].status,'CANCELADO');
 const next=commit(s,purchase);
 assert.equal(next.result.numero,'OS-000002');
});
test('registros COMP antigos mantêm referência; importação OS existente respeita maior número',()=>{
 const s=state();
 s.comprasFornecedor=[{id:'antigo',numero:'COMP-2026-000041',status:'CANCELADO'},{id:'importado',numero:'OS-000012',status:'CANCELADO'}];
 s.settings.nextOsSeq=2;
 const a=commit(s,purchase);
 assert.equal(a.result.numero,'OS-000013');
 assert.equal(a.state.comprasFornecedor[0].numero,'COMP-2026-000041');
 assert.equal(a.state.comprasFornecedor[1].numero,'OS-000012');
 assert.equal(a.state.settings.nextOsSeq,14);
});
test('PDF e interface mostram NOSSA OS separada do número confirmado da indústria',()=>{
 const document=readFileSync(new URL('../supabase/functions/order-communications/order-document.mjs',import.meta.url),'utf8');
 const UI=readFileSync(new URL('../apps/web/src/OrdersWorkspace.jsx',import.meta.url),'utf8');
 assert.match(document,/NOSSA OS · PEDIDO INTERNO/);
 assert.match(document,/Pedido fornecedor:/);
 assert.match(UI,/Nossa OS:/);
 assert.match(UI,/Pedido da indústria:/);
 assert.match(UI,/body\.action==='SUPPLIER_CREATE'&&out\.numero/);
});
