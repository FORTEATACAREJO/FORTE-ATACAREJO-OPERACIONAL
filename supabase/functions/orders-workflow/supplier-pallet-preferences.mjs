// Preferência comercial do fornecedor. As quatro regras de pedidos permanecem inalteradas.
export const SUPPLIER_PALLET_OPTIONS = Object.freeze([
  {value: 'SEM_PALETES', label: 'Sem paletes', orderRule: 'Sem pallets'},
  {value: 'COM_PALETES', label: 'Com paletes', orderRule: 'Com pallets'},
  {value: 'COM_PALETES_SOLICITADOS_AO_VENDEDOR', label: 'Com paletes solicitado ao vendedor', orderRule: 'Solicitar pallets com liberação do vendedor'},
]);

export function validSupplierPalletPreference(value) {
  return value === '' || value == null || SUPPLIER_PALLET_OPTIONS.some(option => option.value === value);
}

export function supplierPalletRule(supplier) {
  return SUPPLIER_PALLET_OPTIONS.find(option => option.value === supplier?.condicaoPaletes)?.orderRule || null;
}
