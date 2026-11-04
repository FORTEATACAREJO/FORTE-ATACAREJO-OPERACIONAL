export function budgetForReview(budget) {
  if (!budget?.id || !budget.numeroOrcamento) return null;
  if (!['ORÇAMENTO', 'PARCIALMENTE ATENDIDO'].includes(budget.status)) return null;
  const source = budget.itensSaldo ?? (budget.status === 'ORÇAMENTO' ? budget.itens : null);
  if (!Array.isArray(source) || !source.length) return null;
  const items = source.map((item, index) => ({
    index,
    produtoId: String(item.produtoId || ''),
    produto: String(item.produto || item.nome || ''),
    quantidade: Number(item.qtd),
  }));
  if (items.some(item => !item.produtoId || !Number.isSafeInteger(item.quantidade) || item.quantidade <= 0)) return null;
  return {
    id: budget.id,
    numero: budget.numeroOrcamento,
    data: budget.dataOperacao || budget.data || '',
    unidade: budget.unidade || '',
    cliente: budget.cliente || '',
    clienteId: budget.clienteId || '',
    items,
  };
}

export async function reviewVersion(budget) {
  const bytes = new TextEncoder().encode(JSON.stringify(budget));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function reviewedItems(budget, quantities, reason) {
  if (!Array.isArray(quantities) || quantities.length !== budget.items.length) {
    throw Error('Informe a quantidade conferida de cada item.');
  }
  const items = budget.items.map((item, index) => {
    const value = quantities[index];
    if (!Number.isSafeInteger(value) || value < 0 || value > item.quantidade) {
      throw Error('A quantidade conferida deve estar entre zero e o saldo do item.');
    }
    return {...item, quantidadeConferida: value};
  });
  if (!items.some(item => item.quantidadeConferida > 0)) throw Error('Confirme pelo menos um item.');
  const justification = typeof reason === 'string' ? reason.trim() : '';
  if (justification.length > 500) throw Error('Use até 500 caracteres na justificativa.');
  if (items.some(item => item.quantidadeConferida !== item.quantidade) && !justification) {
    throw Error('Justifique a diferença de quantidade.');
  }
  return { items, justificativa: justification };
}
