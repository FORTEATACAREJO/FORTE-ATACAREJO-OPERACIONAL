import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {
  NOME_EXIBICAO_PRETENDIDO,
  REFS,
  classificarProjeto,
  decidirOperacao,
} from '../tools/migracao-frete/classificar-projeto.mjs';
import {
  CENSO_FRETE_20261109,
  ensaiarRestauracaoContagens,
  hashEdge,
  relatorio,
  validarSelo,
} from '../tools/migracao-frete/censo-frete-20261109.mjs';
import {importarIdempotente} from '../tools/migracao-frete/importar-idempotente.mjs';
import {ensaiarRestauracao, planoImportacao} from '../tools/migracao-frete/plano-importacao.mjs';

const origemFrete = {ref: REFS.freteLegado, name: 'FORTE MC 6'};
const alvoOperacional = {ref: REFS.operacional, name: 'FORTE ATACAREJO OPERACIONAL'};
const gates = {backupFisico: true, aprovacaoHumana: true, rollbackEnsaiado: true, conciliacaoValidada: true};
const motorista = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'Motorista Exemplo',
  cpf: '111.222.333-44',
  telefone: '(34) 99999-0000',
  cnh_registro: '12345678901',
  proprietario_nome: 'Transportadora',
  chave_pix: 'pix-key',
  titular_pix: 'Transportadora',
};
const fonte = {
  motoristas: [motorista],
  veiculos_motorista: [{id: '22222222-2222-2222-2222-222222222222', motorista_id: motorista.id, placa: 'abc1d23', capacidade_efetiva_t: 12}],
  motorista_veiculo_vinculos: [{id: '33333333-3333-3333-3333-333333333333', motorista_id: motorista.id, veiculo_id: '22222222-2222-2222-2222-222222222222'}],
  rotas: [{id: '44444444-4444-4444-4444-444444444444', nome: 'Rota exemplo', origem_cidade: 'Uberaba', origem_uf: 'MG', destinos: [{cidade: 'Araxa'}], ativa: true}],
  documentos_motorista: [{id: '55555555-5555-5555-5555-555555555555', motorista_id: motorista.id, tipo: 'cnh', arquivo_path: 'cadastro/cnh'}],
  documentos_veiculo: [{id: '66666666-6666-6666-6666-666666666666', veiculo_id: '22222222-2222-2222-2222-222222222222', tipo: 'crlv', arquivo_path: 'cadastro/crlv'}],
  usuarios_app: [{user_id: '77777777-7777-7777-7777-777777777777', perfil: 'MOTORISTA', status_aprovacao: 'APROVADO'}],
};

test('o cartao FORTE MC 6 continua sendo o Frete legado', () => {
  const classe = classificarProjeto(origemFrete);
  assert.equal(classe.papel, 'frete_legado');
  assert.equal(classe.rotuloMc6, true);
  assert.equal(classe.usoComoMc6, 'proibido');
  assert.equal(classe.rotuloNaoDefineIdentidade, true);
  assert.equal(decidirOperacao('iniciar_schema_mc6', origemFrete).motivo, 'ref_e_frete_legado');
  assert.equal(decidirOperacao('usar_como_mc6', origemFrete).permitido, false);
  assert.equal(decidirOperacao('apagar', origemFrete).motivo, 'corte_nao_autorizado');
  assert.equal(decidirOperacao('pausar', origemFrete).permitido, false);
  assert.equal(decidirOperacao('criar_projeto_mc6', {}).motivo, 'custo_de_10_usd_sem_aceite');
  const renome = decidirOperacao('renomear_exibicao', origemFrete);
  assert.equal(renome.permitido, false);
  assert.equal(renome.motivo, 'mcp_sem_projects_write');
  assert.equal(renome.nomePretendido, NOME_EXIBICAO_PRETENDIDO);
  assert.equal(renome.ferramentasMcp.includes('list_projects'), true);
  assert.equal(renome.ferramentasMcp.includes('update_project'), false);
  assert.deepEqual(renome.comandos, []);
  assert.equal(decidirOperacao('apagar', {ref: REFS.fiscal, name: 'FORTE FISCAL'}).motivo, 'fiscal_isolado');
});

test('importacao idempotente fica em memoria e recusa o banco legado como destino', () => {
  const ensaio = importarIdempotente({fonte, origem: origemFrete, alvo: alvoOperacional, dryRun: true, gates, bucketUnicoComObjetos: 'motorista-documentos'});
  assert.equal(ensaio.aplicado, false);
  assert.equal(ensaio.inseridos, 0);
  assert.deepEqual(ensaio.comandosRemotos, []);
  assert.equal(ensaio.resumo.porEntidade.rotas.inserir, 1);
  assert.equal(ensaio.resumo.porEntidade.documentos_motorista.inserir, 1);
  assert.equal(ensaio.resumo.porEntidade.documentos_veiculo.inserir, 1);
  assert.equal(ensaio.resumo.porEntidade.veiculos_motorista.inserir, 1);
  const primeira = importarIdempotente({fonte, origem: origemFrete, alvo: alvoOperacional, dryRun: false, gates, bucketUnicoComObjetos: 'motorista-documentos'});
  assert.equal(primeira.aplicado, true);
  assert.equal(primeira.escopo, 'memoria');
  assert.equal(primeira.inseridos, 7);
  assert.equal(primeira.destino.motoristas.length, 1);
  assert.equal(primeira.destino.documentos_motorista[0].registro.copiar_bytes, false);
  assert.equal(primeira.destino.documentos_motorista[0].registro.bucket, 'motorista-documentos');
  const segunda = importarIdempotente({fonte, destino: primeira.destino, origem: origemFrete, alvo: alvoOperacional, dryRun: false, gates, bucketUnicoComObjetos: 'motorista-documentos'});
  assert.equal(segunda.aplicado, true);
  assert.equal(segunda.inseridos, 0);
  assert.equal(segunda.resumo.porEntidade.motoristas.ignorar_igual, 1);
  assert.equal(segunda.destino.motoristas.length, 1);
  const noLegado = importarIdempotente({fonte, origem: origemFrete, alvo: origemFrete, dryRun: false, gates});
  assert.equal(noLegado.aplicado, false);
  assert.equal(noLegado.bloqueios.includes('alvo_nao_operacional'), true);
  const noFiscal = importarIdempotente({fonte, origem: origemFrete, alvo: {ref: REFS.fiscal, name: 'FORTE FISCAL'}, dryRun: false, gates});
  assert.equal(noFiscal.aplicado, false);
  const semGates = importarIdempotente({fonte, origem: origemFrete, alvo: alvoOperacional, dryRun: false});
  assert.equal(semGates.aplicado, false);
  assert.equal(semGates.bloqueios.includes('gates'), true);
});

test('conflito e origem menor nao apagam o que ja foi guardado', () => {
  const primeira = importarIdempotente({fonte, origem: origemFrete, alvo: alvoOperacional, dryRun: false, gates, bucketUnicoComObjetos: 'motorista-documentos'});
  const alterada = structuredClone(fonte);
  alterada.rotas[0].nome = 'Rota alterada';
  const conflito = importarIdempotente({fonte: alterada, destino: primeira.destino, origem: origemFrete, alvo: alvoOperacional, dryRun: false, gates, bucketUnicoComObjetos: 'motorista-documentos'});
  assert.equal(conflito.aplicado, false);
  assert.equal(conflito.destino.rotas.length, 1);
  assert.equal(conflito.destino.rotas[0].registro.nome, 'Rota exemplo');
  const menor = structuredClone(fonte);
  delete menor.documentos_veiculo;
  const preservada = importarIdempotente({fonte: menor, destino: primeira.destino, origem: origemFrete, alvo: alvoOperacional, dryRun: false, gates, bucketUnicoComObjetos: 'motorista-documentos'});
  assert.equal(preservada.destino.documentos_veiculo.length, 1);
});

test('colunas reais de rota e arquivo entram no plano sem copiar bytes', () => {
  const plano = planoImportacao({fonte, empresaId: 'empresa-id', bucketUnicoComObjetos: 'motorista-documentos'});
  const rota = plano.itens.find(item => item.entidade === 'rotas').registro;
  assert.equal(rota.origem, 'Uberaba/MG');
  assert.equal(rota.destino, 'Araxa');
  assert.equal(rota.ativa, true);
  const documento = plano.itens.find(item => item.entidade === 'documentos_motorista').registro;
  assert.equal(documento.storage_path, 'cadastro/cnh');
  assert.equal(documento.copiar_bytes, false);
  const fiel = ensaiarRestauracao(fonte, structuredClone(fonte));
  assert.equal(fiel.equivalente, true);
  const semVeiculo = structuredClone(fonte);
  semVeiculo.documentos_veiculo = [];
  assert.equal(ensaiarRestauracao(fonte, semVeiculo).equivalente, false);
});

test('selo da releitura prova que a migracao nao ocorreu e que o backup fisico falta', () => {
  const selo = validarSelo();
  assert.equal(selo.valido, true);
  assert.equal(selo.backupRestauravel, false);
  const resumo = relatorio();
  assert.equal(resumo.migracaoExecutada, false);
  assert.equal(resumo.rotuloFrete, 'FORTE MC 6');
  assert.equal(resumo.classificacaoFrete, 'frete_legado');
  assert.equal(resumo.operacionalFrete.fc_motoristas, 0);
  assert.equal(resumo.operacionalFrete.fc_veiculos, 0);
  assert.equal(resumo.alemDaPartida.documentos_veiculo, 5);
  assert.equal(resumo.edgeSha256, hashEdge());
  const copia = structuredClone(CENSO_FRETE_20261109.frete.contagens);
  assert.equal(ensaiarRestauracaoContagens(CENSO_FRETE_20261109.frete.contagens, copia).equivalente, true);
  delete copia.motoristas;
  assert.equal(ensaiarRestauracaoContagens(CENSO_FRETE_20261109.frete.contagens, copia).equivalente, false);
  const texto = JSON.stringify(CENSO_FRETE_20261109);
  assert.equal(/@[a-z0-9.-]+\.[a-z]{2,}|\d{3}\.\d{3}\.\d{3}-\d{2}|service_role|sb_secret/i.test(texto), false);
  assert.equal(texto.includes('arquivo_path'), false);
  const saida = execFileSync(process.execPath, ['tools/migracao-frete/relatorio-censo.mjs'], {encoding: 'utf8'});
  const impresso = JSON.parse(saida);
  assert.equal(impresso.migracaoExecutada, false);
  assert.equal(impresso.backupRestauravel, false);
  assert.equal(impresso.seloValido, true);
});

test('o inventario publico repete o bloqueio do rotulo e nao afirma backup restauravel', () => {
  const evidencia = readFileSync(new URL('../docs/EVIDENCIA_FRETE_LEGADO_NAO_MC6_20261109.md', import.meta.url), 'utf8');
  assert.match(evidencia, new RegExp(REFS.freteLegado));
  assert.match(evidencia, /FORTE FRETE \(LEGADO - NÃO APAGAR\)/);
  assert.match(evidencia, /backup fisico nao foi exportado/i);
  assert.match(evidencia, /fc_motoristas=0/);
  assert.equal(/@[a-z0-9.-]+\.[a-z]{2,}|\d{3}\.\d{3}\.\d{3}-\d{2}|service_role/i.test(evidencia), false);
});
