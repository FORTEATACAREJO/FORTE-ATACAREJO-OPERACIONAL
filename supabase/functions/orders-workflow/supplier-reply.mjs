// Consome apenas metadados já validados pelo receptor de cada canal.
export function matchSupplierReply({channel, sender, body, replyTo, orderVersion, sentOrders}) {
 if (!['EMAIL', 'WHATSAPP'].includes(channel) || !sender || typeof body !== 'string' || body.length > 16000) return null;
 const lines = body.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('>'));
 // Dados encaminhados ou citações podem conter números de uma compra anterior.
 if (lines.some(line => /^\s*(?:>|[- ]*(?:mensagem encaminhada|forwarded message|original message)|(?:em|on)\s.+(?:escreveu|wrote):)\s*/i.test(line))) return null;
 const numbers = lines.flatMap(line => {
  const match = line.match(/^\s*(?:N[º°o.]?\s+da\s+ordem\s+SAP|pedido\s+do\s+fornecedor|n[uú]mero\s+do\s+pedido)\s*:\s*([A-Z0-9][A-Z0-9./-]{0,49})\s*$/iu);
  return match ? [match[1]] : [];
 });
 const currentText = lines.join('\n');
 const references = [...new Set(currentText.toUpperCase().match(/\bOS-\d+\b/g) || [])];
 if (numbers.length !== 1 || references.length > 1 || (!replyTo && references.length !== 1)) return null;
 if (!/^\s*(?:pedido confirmado|ordem criada|pedido registrado)[.!]?\s*$/imu.test(currentText)) return null;
 const candidates = sentOrders.filter(order =>
  order.channel === channel && order.recipient === sender &&
  (!replyTo || order.messageId === replyTo) &&
  (!references.length || order.os === references[0])
 );
 if (candidates.length !== 1) return null;
 const order = candidates[0];
 if (!order.purchaseId || !order.sentVersion || order.sentVersion !== orderVersion || order.officialNumber) return null;
 return {purchaseId: order.purchaseId, number: numbers[0]};
}
