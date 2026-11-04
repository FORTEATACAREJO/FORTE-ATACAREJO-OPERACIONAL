import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {budgetForReview, reviewedItems, reviewVersion} from '../supabase/functions/cff-conferencias/domain.mjs';

test('CFF uses the pending balance and requires justification for a quantity change', async () => {
  const original = {id:'vb-1',numeroOrcamento:'ORC-1',status:'PARCIALMENTE ATENDIDO',
    itens:[{produtoId:'p',qtd:100}],itensSaldo:[{produtoId:'p',qtd:60}],
    chavePixMotorista:'privado',pagamentos:[{valor:10}]};
  const review = budgetForReview(original);
  assert.equal(review.items[0].quantidade,60);
  assert(!('chavePixMotorista' in review));
  assert(!('pagamentos' in review));
  assert.equal(budgetForReview({...original,itensSaldo:undefined}),null);
  assert.equal(budgetForReview({...original,status:'CONCLUÍDA'}),null);
  assert.throws(() => reviewedItems(review,[100],'diferença'),/saldo/);
  assert.throws(() => reviewedItems(review,[59],''),/Justifique/);
  assert.equal(reviewedItems(review,[59],'divergência identificada').items[0].quantidadeConferida,59);
  assert.notEqual(await reviewVersion(review),await reviewVersion(budgetForReview({...original,itensSaldo:[{produtoId:'p',qtd:59}]})));
});

test('CFF history is write-once, guarded by the current commercial version and inaccessible to browser roles', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.fc_empresas (id uuid primary key);
      create table public.fc_app_state (empresa_id uuid primary key, updated_at timestamptz, estado jsonb);
      grant select,update on public.fc_app_state to service_role;
    `);
    await db.exec(await readFile('supabase/migrations/20261104143619_cff_conferencias.sql','utf8'));
    const company = '00000000-0000-4000-8000-000000000001';
    const author = '00000000-0000-4000-8000-000000000002';
    const revision = '2026-11-04T14:00:00.123456Z';
    await db.query('insert into public.fc_empresas values ($1)',[company]);
    await db.query('insert into public.fc_app_state values ($1,$2,$3)',[company,revision,{reservas:60}]);
    const record = (version=revision) => db.query(
      'select public.fc_cff_registrar($1,$2,$3,$4,$5,$6) as review',
      [company,version,'vb-1','a'.repeat(64),{conferida:58},author],
    );
    for (const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      await assert.rejects(record,/permission denied/);
      await assert.rejects(db.query('select * from public.fc_cff_conferencias'),/permission denied/);
    }
    await db.exec('set role service_role');
    assert.equal((await record('2026-11-04T14:00:00.123455Z')).rows[0].review,null);
    assert.equal((await record()).rows[0].review.conferencia.conferida,58);
    await assert.rejects(record,/duplicate key/);
    await assert.rejects(db.query('delete from public.fc_cff_conferencias'),/permission denied/);
    assert.deepEqual((await db.query('select estado from public.fc_app_state')).rows[0].estado,{reservas:60});
  } finally { await db.close(); }
});
