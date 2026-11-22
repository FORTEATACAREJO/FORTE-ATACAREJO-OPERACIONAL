import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PALLETS} from '../supabase/functions/orders-workflow/domain.mjs';
import {SUPPLIER_PALLET_OPTIONS,validSupplierPalletPreference,supplierPalletRule} from '../apps/web/src/supplier-pallet-preferences.mjs';

test('cadastro oferece exatamente as tres preferencias de paletes', () => {
  assert.deepEqual(SUPPLIER_PALLET_OPTIONS.map(x => x.label), [
    'Sem paletes', 'Com paletes', 'Com paletes solicitado ao vendedor',
  ]);
  assert.equal(new Set(SUPPLIER_PALLET_OPTIONS.map(x => x.value)).size, 3);
  for (const option of SUPPLIER_PALLET_OPTIONS) {
    assert.ok(PALLETS.includes(option.orderRule));
    assert.ok(validSupplierPalletPreference(option.value));
    assert.equal(supplierPalletRule({condicaoPaletes: option.value}), option.orderRule);
  }
});

test('fornecedores antigos nao ganham preferencia presumida', () => {
  assert.equal(supplierPalletRule({id: 'fornecedor-antigo', nome: 'Fornecedor'}), null);
  assert.equal(supplierPalletRule(null), null);
  assert.ok(validSupplierPalletPreference(undefined));
  assert.ok(validSupplierPalletPreference(''));
  assert.equal(validSupplierPalletPreference('PALLETS_INVENTADOS'), false);
  assert.equal(supplierPalletRule({condicaoPaletes: 'PALLETS_INVENTADOS'}), null);
});

test('tela de cadastro salva condicao e pedido utiliza a regra cadastrada', () => {
  const app = readFileSync('apps/web/src/App.jsx', 'utf8');
  const orders = readFileSync('apps/web/src/OrdersWorkspace.jsx', 'utf8');
  assert.match(app, /\["condicaoPaletes", "CONDIÇÃO DE PALETES"\]/);
  assert.match(app, /type === "fornecedores" && k === "condicaoPaletes"/);
  assert.match(app, /validSupplierPalletPreference\(obj\.condicaoPaletes\)/);
  assert.match(orders, /supplierPalletRule\(f\)/);
  assert.match(orders, /regraPallets:preferenciaPaletes\|\|PALLETS\[1\]/);
});
