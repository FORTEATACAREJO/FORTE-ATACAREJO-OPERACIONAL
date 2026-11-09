import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUDITORIA_CONSOLIDACAO, servicosPorCorte, servicosQuePodemDesligarAgora} from '../tools/consolidacao/matriz-legados.mjs';

const matriz = readFileSync(new URL('../docs/MATRIZ_MIGRACAO_LEGADOS_20261109.md', import.meta.url), 'utf8');
const backup = readFileSync(new URL('../docs/PLANO_BACKUP_RECONCILIACAO_FRETE_20261109.md', import.meta.url), 'utf8');
const texto = `${JSON.stringify(AUDITORIA_CONSOLIDACAO)}\n${matriz}\n${backup}`;

test('inventario cobre os sete repositorios e separa o que este agente nao conseguiu ler', () => {
  const nomes = AUDITORIA_CONSOLIDACAO.repositorios.map(repo => repo.nome);
  assert.deepEqual(nomes, ['FORTE-VENDAS', 'FORTEFISCAL', 'FORTE-FRETE', 'FORTE-FINANCEIRO', 'FORTE-VENDA-EXTERNA', 'FORTE-CARGA-DIRETA', 'SITE-FORTE-ATACAREJO']);
  assert.equal(AUDITORIA_CONSOLIDACAO.repositorios.find(repo => repo.nome === 'FORTEFISCAL').papel, 'definitivo_independente');
  assert.equal(AUDITORIA_CONSOLIDACAO.repositorios.filter(repo => repo.leituraNestaSessao).length, 5);
  assert.equal(AUDITORIA_CONSOLIDACAO.mc6.criado, false);
  assert.equal(AUDITORIA_CONSOLIDACAO.mc6.visibilidadeExigida, 'privada');
  assert.equal(AUDITORIA_CONSOLIDACAO.mc6.cadPublicado, false);
});

test('onze servicos Render permanecem no ar e nenhum corte esta autorizado', () => {
  assert.equal(AUDITORIA_CONSOLIDACAO.render.servicos.length, 11);
  assert.equal(AUDITORIA_CONSOLIDACAO.render.modo, 'leitura');
  assert.deepEqual(servicosQuePodemDesligarAgora(), []);
  assert.equal(servicosPorCorte('api_separada').length, 3);
  assert.equal(servicosPorCorte('frontend_operacional').length, 1);
  assert.equal(servicosPorCorte('frontend_legado').length, 5);
  assert.equal(servicosPorCorte('fiscal_independente').length, 2);
  assert.equal(AUDITORIA_CONSOLIDACAO.render.servicos.filter(servico => servico.autoDeploy).length, 9);
  assert.equal(AUDITORIA_CONSOLIDACAO.supabase.consultaVivaNestaSessao, false);
  assert.equal(AUDITORIA_CONSOLIDACAO.supabase.partidaEhAceite, false);
  assert.equal(AUDITORIA_CONSOLIDACAO.supabase.fiscalIndependente, true);
  assert.deepEqual(AUDITORIA_CONSOLIDACAO.supabase.bancosEmpresariaisAlvo, ['operacional', 'fiscal']);
});

test('documentos publicos repetem a matriz e nao carregam segredo nem dado pessoal', () => {
  for (const repo of AUDITORIA_CONSOLIDACAO.repositorios) assert.equal(matriz.includes(repo.nome), true);
  for (const servico of AUDITORIA_CONSOLIDACAO.render.servicos) assert.equal(matriz.includes(servico.nome), true);
  for (const bloqueio of AUDITORIA_CONSOLIDACAO.bloqueios) {
    assert.equal(matriz.includes(bloqueio.id), true);
    assert.equal(backup.includes(bloqueio.id), true);
  }
  assert.match(backup, /contagem de partida/i);
  assert.match(matriz, /Nenhum serviço pode ser desligado/);
  assert.equal(/@[a-z0-9.-]+\.[a-z]{2,}|service_role|sb_secret|sb_publishable|\d{3}\.\d{3}\.\d{3}-\d{2}/i.test(texto), false);
});
