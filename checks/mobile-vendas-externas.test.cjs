const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');

const source = stripTypeScriptTypes(readFileSync(
  'supabase/functions/mobile-vendas-externas/index.ts', 'utf8',
)).replace(/^import .*;\n/gm, '');

function setup({ allowed = true, conflict = false, writeError = false } = {}) {
  let handler;
  let committed = 0;
  let filter;
  let savedVersion;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'seller' } } }) },
    rpc: async () => ({ data: { allowed, role: 'VENDEDOR EXTERNO' } }),
    from(table) {
      const profile = { ativo: true, status_aprovacao: 'APROVADO', empresa_id: 'company' };
      const row = { versao: 7, estado: {
        clientes: [{ id: 'client', vendedorId: 'auth-seller', nome: 'Cliente' }],
        produtos: [{ id: 'product', nome: 'Cimento', precoTabela: 34 }],
      } };
      let writing = false;
      const query = {
        select: () => query,
        eq(key, value) {
          if (key === 'versao') filter = value;
          return query;
        },
        maybeSingle: () => query,
        update(value) { writing = true; savedVersion = value.versao; return query; },
        then(resolve) {
          if (!writing) return resolve({ data: table === 'fc_perfis' ? profile : table === 'access_requests' ? [] : row });
          if (writeError) return resolve({ error: { message: 'failed' } });
          if (conflict) return resolve({ data: [] });
          committed++;
          return resolve({ data: [{ empresa_id: 'company' }] });
        },
      };
      return query;
    },
  };
  vm.runInNewContext(source, {
    Deno: { env: { get: () => '' }, serve: callback => { handler = callback; } },
    createClient: () => client, Response, crypto: webcrypto,
  });
  return {
    send: (qtd = 2) => handler(new Request('https://fixture.test', {
      method: 'POST',
      body: JSON.stringify({ acao: 'CRIAR_PROPOSTA', clienteId: 'client', produtoId: 'product', qtd }),
    })),
    get committed() { return committed; },
    get filter() { return filter; },
    get savedVersion() { return savedVersion; },
  };
}

test('external proposal only succeeds after a write at the version it read', async () => {
  const app = setup();
  const result = await app.send();
  assert.equal(result.status, 200);
  assert.equal((await result.json()).total, 68);
  assert.equal(app.filter, 7);
  assert.equal(app.savedVersion, 8);
  assert.equal(app.committed, 1);
});

test('permission, invalid quantity, conflict and write error never acknowledge a proposal', async () => {
  for (const [options, quantity] of [
    [{ allowed: false }, 2], [{}, 'abc'], [{ conflict: true }, 2], [{ writeError: true }, 2],
  ]) {
    const app = setup(options);
    assert.equal((await app.send(quantity)).status, 400);
    assert.equal(app.committed, 0);
  }
});
