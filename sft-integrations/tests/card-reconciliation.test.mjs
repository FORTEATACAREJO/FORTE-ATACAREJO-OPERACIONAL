import test from "node:test";
import assert from "node:assert/strict";
import { cents, money, normalizeCardSale, normalizeReceivable, cardDepositCandidate } from "../../sft-preview/card-reconciliation-adapter.mjs";
const company="11111111-1111-4111-8111-111111111111";
const merchant="22222222-2222-4222-8222-222222222222";
const saleId="33333333-3333-4333-8333-333333333333";
const sample={company_id:company,merchant_profile_id:merchant,provider_sale_reference:"SALE-12345",provider_nsu:"NSU-100",sale_on:"2026-11-12",modality:"CREDITO",installments:3,card_brand:"VISA",capture_channel:"POS",gross_brl:"100.00"};
test("centavos exatos com decimal string",()=>{
 assert.equal(cents("100.00"),10000n);
 assert.equal(money(9641n),"96.41");
 assert.throws(()=>cents("1.999"),/monetário/);
});
test("venda isolada por empresa e credenciadora",()=>{
 assert.equal(normalizeCardSale(sample,company,merchant).gross_brl,"100.00");
 assert.throws(()=>normalizeCardSale({...sample,company_id:saleId},company,merchant),/incompatível/);
});
test("débito não parcela e referência do cartão não deve ser PAN",()=>{
 assert.throws(()=>normalizeCardSale({...sample,modality:"DEBITO",installments:3},company,merchant),/Parcelas/);
 assert.throws(()=>normalizeCardSale({...sample,provider_sale_reference:"4111111111111111"},company,merchant),/Referência/);
});
test("não aceita CVV/PAN nem datas inválidas",()=>{
 assert.throws(()=>normalizeCardSale({...sample,cvv:"123"},company,merchant),/Dados sensíveis/);
 assert.throws(()=>normalizeCardSale({...sample,sale_on:"2026-02-30"},company,merchant),/Data/);
});
test("apuração de taxas/antecipações é decimal, não float",()=>{
 const p={company_id:company,sale_id:saleId,installment_number:1,due_on:"2026-12-12",gross_brl:"100.00",acquiring_fee_brl:"2.49",anticipation_fee_brl:"1.00",adjustment_brl:"-0.10"};
 assert.equal(normalizeReceivable(p,company,saleId).expected_net_brl,"96.41");
 assert.throws(()=>normalizeReceivable({...p,company_id:merchant},company,saleId),/outra empresa/);
 assert.throws(()=>normalizeReceivable({...p,acquiring_fee_brl:"99.999"},company,saleId),/monetário/);
 assert.throws(()=>normalizeReceivable({...p,anticipation_fee_brl:"200.00"},company,saleId),/Líquido/);
});
test("conciliação é sugestão, nunca baixa automática",()=>{
 const c=cardDepositCandidate({company_id:company,net_brl:"96.41"},{company_id:company,amount_brl:"96.41"});
 assert.equal(c.possible_match,true);
 assert.equal(c.requires_human_review,true);
 assert.equal(c.recorded,false);
 assert.throws(()=>cardDepositCandidate({company_id:company,net_brl:"96.41"},{company_id:merchant,amount_brl:"96.41"}),/Empresas/);
});