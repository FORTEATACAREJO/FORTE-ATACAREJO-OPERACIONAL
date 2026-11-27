import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const ordemFicticia = Object.freeze({
  os: 'OS-TESTE-001',
  fornecedor: 'CIPLAN',
  filial: 'Caldas Novas/GO',
  itens: [{ codigoFornecedor: '900000081', quantidade: 50 }],
  frete: 'CIF',
  prazo: 'D014',
});

export const consultarPedidoSimulado = {
  type: 'function',
  name: 'consultar_pedido_simulado',
  description: 'Consulta exclusivamente a OS fictícia OS-TESTE-001 em homologação.',
  parameters: {
    type: 'object',
    properties: { os: { type: 'string', enum: ['OS-TESTE-001'] } },
    required: ['os'],
    additionalProperties: false,
  },
};

export function consultar({ os }) {
  if (os !== ordemFicticia.os) throw new Error('OS indisponível em homologação.');
  return {
    ambiente: 'homologacao',
    pedido: structuredClone(ordemFicticia),
    numeroPedidoFornecedor: '0000000001',
    protocoloFornecedor: 'SO-TESTE-001',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const resultado = JSON.parse(JSON.stringify(consultar({ os: 'OS-TESTE-001' })));
  assert.equal(resultado.ambiente, 'homologacao');
  assert.equal(resultado.pedido.fornecedor, 'CIPLAN');
  assert.equal(resultado.numeroPedidoFornecedor, '0000000001');
  assert.equal(resultado.protocoloFornecedor, 'SO-TESTE-001');
  assert.throws(() => consultar({ os: 'OS 001' }), /indisponível/);
  console.log('OS fictícia consultada e retorno serializado com os zeros à esquerda.');
}
