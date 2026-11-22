// A modalidade CIF/FOB pertence ao cadastro do fornecedor; pedidos guardam snapshot.
export const MODALIDADES_FRETE = Object.freeze(['CIF','FOB']);
export function supplierFreightMode(f){
 const value=String(f?.modalidadeFrete||'').trim().toUpperCase();
 return MODALIDADES_FRETE.includes(value)?value:'';
}
export function requireSupplierFreightMode(f){
 const mode=supplierFreightMode(f);
 if(!mode)throw new Error('Configure CIF ou FOB no cadastro do fornecedor antes de registrar o pedido.');
 return mode;
}
export function assertFreightSnapshot(requested,expected){
 if(expected&&requested&&String(requested).toUpperCase()!==expected)
  throw new Error('Modalidade CIF/FOB diverge do fornecedor ou da condição registrada no pedido. Confira o cadastro do fornecedor.');
 return expected;
}
