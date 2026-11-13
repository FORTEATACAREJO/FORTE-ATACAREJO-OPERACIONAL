/** Sistemas Forte Tech — normalização de conciliação de cartões (pré-homologação).
 * Somente metadados de transação e valores, nunca PAN, CVV, PIN, trilha, tokens nem dados brutos.
 * Adapters reais no servidor devem validar autorização, assinatura, escopo, vínculo de empresa
 * e idempotência antes de persistir resultados. Não executa pagamentos ou baixas automáticas.
 */
export function cents(value, allowNegative=false) {
 if(typeof value!=="string"||!(/^-?(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/).test(value))throw new Error("Valor monetário deve ser texto decimal de até 2 casas");
 const minus=value.startsWith("-"),n=minus?value.slice(1):value;
 const [whole,fraction=""]=n.split(".");
 const total=BigInt(whole)*100n+BigInt((fraction+"00").slice(0,2));
 if(minus&&!allowNegative)throw new Error("Não é permitido valor negativo");
 if(total>999999999999999999n)throw new Error("Valor fora do limite");
 return minus?-total:total;
}

export function money(n){const v=BigInt(n),abs=v<0n?-v:v;return (v<0n?"-":"")+(abs/100n).toString()+"."+(abs%100n).toString().padStart(2,"0")}

export function isoDate(v){if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+"T00:00:00.000Z"))||new Date(v+"T00:00:00.000Z").toISOString().slice(0,10)!==v)throw new Error("Data inválida");return v}

export function normalizeCardSale(x,companyId,merchantId){
 if(!x||x.company_id!==companyId||x.merchant_profile_id!==merchantId)throw Error("Empresa ou estabelecimento credenciado incompatível");
 const allowed=["company_id","merchant_profile_id","provider_sale_reference","provider_nsu","sale_on","modality","installments","card_brand","capture_channel","gross_brl"];
 if(Object.keys(x).some(k=>!allowed.includes(k)))throw Error("Dados sensíveis ou campos desconhecidos são proibidos");
 if(typeof x.provider_sale_reference!=="string"||x.provider_sale_reference.length<4||x.provider_sale_reference.length>180||/^\d{13,19}$/.test(x.provider_sale_reference))throw Error("Referência da adquirente inválida");
 if(x.provider_nsu!==undefined&&(typeof x.provider_nsu!=="string"||x.provider_nsu.length>36))throw Error("NSU inválido");
 if(!["CREDITO","DEBITO","PRE_PAGO","VALE_BENEFICIO"].includes(x.modality))throw Error("Modalidade inválida");
 if(!Number.isInteger(x.installments)||x.installments<1||x.installments>36||(x.modality==="DEBITO"&&x.installments!==1))throw Error("Parcelas inválidas");
 if(!["NAO_CONFIRMADO","POS","TEF","ECOMMERCE","LINK_PAGAMENTO"].includes(x.capture_channel))throw Error("Canal inválido");
 if(x.card_brand!==undefined&&(typeof x.card_brand!=="string"||x.card_brand.length>40||!/^[\p{L}\p{N} _.-]+$/u.test(x.card_brand)))throw Error("Bandeira inválida");
 const gross=cents(x.gross_brl);
 if(gross<=0n)throw Error("Valor bruto deve ser positivo");
 return {company_id:companyId,merchant_profile_id:merchantId,provider_sale_reference:x.provider_sale_reference,
   provider_nsu:x.provider_nsu??null,sale_on:isoDate(x.sale_on),modality:x.modality,installments:x.installments,
   card_brand:x.card_brand??null,gross_brl:money(gross),capture_channel:x.capture_channel,
   state:"AGUARDANDO_HOMOLOGACAO"};
}

export function normalizeReceivable(x,companyId,saleId){
 if(!x||x.company_id!==companyId||x.sale_id!==saleId)throw Error("Parcela de outra empresa ou venda");
 const allowed=["company_id","sale_id","installment_number","due_on","gross_brl","acquiring_fee_brl","anticipation_fee_brl","adjustment_brl"];
 if(Object.keys(x).some(k=>!allowed.includes(k)))throw Error("Dados financeiros desconhecidos");
 if(!Number.isInteger(x.installment_number)||x.installment_number<1||x.installment_number>36)throw Error("Número da parcela inválido");
 const gross=cents(x.gross_brl),fee=cents(x.acquiring_fee_brl??"0.00"),anticipation=cents(x.anticipation_fee_brl??"0.00"),adj=cents(x.adjustment_brl??"0.00",true);
 const net=gross-fee-anticipation+adj;
 if(gross<=0n||net<0n)throw Error("Líquido de cartão inválido");
 return {company_id:companyId,sale_id:saleId,installment_number:x.installment_number,due_on:isoDate(x.due_on),
   gross_brl:money(gross),acquiring_fee_brl:money(fee),anticipation_fee_brl:money(anticipation),
   adjustment_brl:money(adj),expected_net_brl:money(net),reconciliation_state:"NAO_CONCILIADO"};
}

export function cardDepositCandidate(settlement,bankEntry){
 if(!settlement||!bankEntry||settlement.company_id!==bankEntry.company_id)throw Error("Empresas não correspondem");
 const amount=cents(settlement.net_brl),bank=cents(bankEntry.amount_brl,true);
 return {possible_match:amount>0n&&bank===amount,requires_human_review:true,recorded:false};
}
