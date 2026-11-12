import test from "node:test";
import assert from "node:assert/strict";
import { decimalToCents, normalizeBankStatement, prepareAiRequestMetadata, verifyReadyForExternalProvider } from "../../sft-preview/integration-adapters.mjs";
const company="11111111-1111-4111-8111-111111111111";
const account="22222222-2222-4222-8222-222222222222";
const agent="33333333-3333-4333-8333-333333333333";
const user="44444444-4444-4444-8444-444444444444";
test("decimais bancários conservam centavos",()=>{
 assert.equal(decimalToCents("1.20"),"120");
 assert.equal(decimalToCents("-0.01"),"-1");
 assert.throws(()=>decimalToCents("1.234"),/inválido/);
 assert.throws(()=>decimalToCents("0"),/limites/);
});
test("normaliza sem lançar conciliação automática",()=>{
 const row=normalizeBankStatement({company_id:company,bank_account_id:account,external_id:"ref-00001",booked_on:"2026-11-12",amount_decimal:"4.99",currency:"BRL"},company,account);
 assert.equal(row.amount_cents,"499");
 assert.equal(row.reconciliation_state,"NAO_CONCILIADO");
});
test("rejeita conta cruzada de outra empresa",()=>{
 assert.throws(()=>normalizeBankStatement({company_id:"999",bank_account_id:account,external_id:"ref-00001",booked_on:"2026-11-12",amount_decimal:"4.99",currency:"BRL"},company,account),/incompatível/);
});
test("rejeita moeda e datas inconsistentes",()=>{
 assert.throws(()=>normalizeBankStatement({company_id:company,bank_account_id:account,external_id:"ref-00001",booked_on:"2026-11-12",amount_decimal:"4.99",currency:"USD"},company,account),/Moeda/);
 assert.throws(()=>normalizeBankStatement({company_id:company,bank_account_id:account,external_id:"ref-00001",booked_on:"2026-02-30",amount_decimal:"4.99",currency:"BRL"},company,account));
});
test("fila de IA admite só metadados, não prompts",()=>{
 const input={company_id:company,agent_id:agent,requested_by:user,task_type:"REVISAR_CADASTRO"};
 const req=prepareAiRequestMetadata(input,company);
 assert.equal(req.external_request_sent,false);
 assert.equal(req.state,"AGUARDANDO_CONFIGURACAO");
 assert.throws(()=>prepareAiRequestMetadata({...input,prompt:"dados sigilosos"},company),/Dados brutos/);
});
test("gateway externo permanece bloqueado sem credenciais, consentimento e produção",()=>{
 const config={id:account,company_id:company,environment:"SANDBOX",status:"RASCUNHO",credential_status:"NAO_CONFIGURADO",data_transfer_enabled:false,requested_scopes:[]};
 assert.throws(()=>verifyReadyForExternalProvider(config,{valid:true,company_id:company,scopes:[]}),/bloqueado/);
});
