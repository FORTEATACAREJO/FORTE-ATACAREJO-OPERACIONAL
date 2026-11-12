/** Sistemas Forte Tech — conectores de integração, núcleo neutro (somente pré-homologação).
 * Nenhum conector externo é habilitado, nenhum segredo deve ser salvo no navegador ou repositório.
 * Adapter de banco deve verificar assinatura, expiração de consentimento, escopo,
 * deduplicação e mTLS/OAuth próprios do provedor ANTES de importar lançamentos.
 * Modelo de IA deve receber apenas dados minimizados após autorização explícita,
 * e jamais executar pagamentos, emitir documentos ou aprovar tributos.
 */

export function decimalToCents(value) {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Valor monetário inválido: exija centavos decimais como string");
  }
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, decimal = ""] = unsigned.split(".");
  const cents = BigInt(integer) * 100n + BigInt((decimal + "00").slice(0, 2));
  if (cents === 0n || cents > 999999999999999999n) throw new Error("Valor fora dos limites permitidos");
  return (negative ? -cents : cents).toString();
}

export function normalizeBankStatement(input, expectedCompanyId, expectedAccountId) {
  if (!input || input.company_id !== expectedCompanyId || input.bank_account_id !== expectedAccountId)
    throw new Error("Conta ou empresa incompatível");
  if (input.currency !== "BRL") throw new Error("Moeda não suportada");
  if (typeof input.external_id !== "string" || input.external_id.trim().length < 4 || input.external_id.length > 180)
    throw new Error("Identificador de lançamento inválido");
  if (typeof input.booked_on !== "string" || !/^\d{4}-\d\d-\d\d$/.test(input.booked_on)
    || new Date(input.booked_on + "T00:00:00Z").toISOString().slice(0,10)!==input.booked_on)
    throw new Error("Data do lançamento inválida");
  const amount_cents=decimalToCents(input.amount_decimal);
  return Object.freeze({
    company_id:expectedCompanyId, bank_account_id:expectedAccountId,
    provider_transaction_ref:input.external_id.trim(),
    booked_on:input.booked_on, amount_cents,
    reconciliation_state:"NAO_CONCILIADO", currency:"BRL"
  });
}

export function prepareAiRequestMetadata(input, expectedCompanyId) {
  const allowed=new Set(["REVISAR_CADASTRO","SUGERIR_CLASSIFICACAO","EXPLICAR_REGRA","SUGERIR_CONCILIACAO"]);
  if (!input || input.company_id!==expectedCompanyId || !allowed.has(input.task_type)
    || typeof input.agent_id!=="string" || !/^[0-9a-f-]{36}$/i.test(input.agent_id)
    || typeof input.requested_by!=="string" || !/^[0-9a-f-]{36}$/i.test(input.requested_by))
    throw new Error("Metadados inválidos ou de outra empresa");
  // Reject arbitrary prompts, documents, customer data, or implicit model payloads.
  const keys=Object.keys(input);
  if(keys.some(k=>!["company_id","task_type","agent_id","requested_by"].includes(k)))
    throw new Error("Dados brutos não podem ser enviados à fila de IA");
  return Object.freeze({
    company_id:expectedCompanyId, task_type:input.task_type, agent_id:input.agent_id,
    requested_by:input.requested_by, record_kind:"EMPRESA",
    state:"AGUARDANDO_CONFIGURACAO",external_request_sent:false
  });
}

export function verifyReadyForExternalProvider(connection, consent) {
  if(!connection || connection.environment!=="PRODUCTION" || connection.status!=="ATIVO"
     || connection.credential_status!=="CONFIGURADO" || connection.data_transfer_enabled!==true
     || !consent || consent.valid!==true || consent.company_id!==connection.company_id
     || !Array.isArray(consent.scopes) || !consent.scopes.every(s=>connection.requested_scopes.includes(s))
     || !connection.id)
    throw new Error("Integração não autorizada/homologada: acesso externo bloqueado");
  return true;
}
