import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {permitirCorte} from '../tools/migracao-frete/normalizar-legado.mjs';
import {
  ENTIDADES,
  aplicarProducao,
  avaliarProntidao,
  chaveEstavel,
  ensaiarRestauracao,
  hashRegistro,
  planoImportacao,
  resumoPlano,
  validarManifestoBackup,
} from '../tools/migracao-frete/plano-importacao.mjs';

const motorista = {
  id: 'uuid-legado',
  nome: 'Motorista Exemplo',
  cpf: '111.222.333-44',
  telefone: '(34) 99999-0000',
  cnh_registro: '12345678901',
  proprietario_nome: 'Transportadora',
  chave_pix: 'pix-key',
  titular_pix: 'Transportadora',
};
const fonteApta = {
  motoristas: [motorista],
  veiculos_motorista: [{id: 'v1', motorista_id: 'uuid-legado', placa: 'abc1d23', capacidade_efetiva_t: 48.5}],
  rotas: [{id: 'r1', nome: 'Rota exemplo', origem: 'Origem', destino: 'Destino'}],
  documentos_motorista: [{id: 'd1', motorista_id: 'uuid-legado', tipo: 'cnh_frente', bucket: 'documentos', storage_path: 'legado/cnh-frente'}],
  usuarios_app: [{id: 'auth-1', user_id: 'auth-1', perfil: 'MOTORISTA', status_aprovacao: 'APROVADO', email: 'oculto@example.com', password: 'nao-copiar', cpf: '111.222.333-44'}],
};

function sha(valor) {
  return createHash('sha256').update(valor).digest('hex');
}

function manifestoValido(extra = {}) {
  const dados = {};
  for (const entidade of ENTIDADES) dados[entidade] = {contagem: 0, sha256: sha(entidade)};
  return {
    schema: {sha256: sha('schema')},
    dados,
    auth: {contagem: 4, sha256: sha('auth')},
    storage: {objetos: 1, manifesto_sha256: sha('storage')},
    edge: {nomes: ['driver-directory'], sha256: sha('edge')},
    restauracao: {ambiente: 'isolado', contagens_conferidas: true, hashes_iguais: true},
    ...extra,
  };
}

test('chave estavel e hash nao dependem da ordem dos campos', () => {
  assert.equal(chaveEstavel('motoristas', ' uuid-legado '), 'forte-frete:motoristas:uuid-legado');
  assert.equal(chaveEstavel('outra', '1'), null);
  assert.equal(chaveEstavel('rotas', ''), null);
  assert.equal(hashRegistro({b: 1, a: {d: 2, c: 3}}), hashRegistro({a: {c: 3, d: 2}, b: 1}));
});

test('lote da partida incompleto e contabilizado sem inventar dados nem aceitar corte', () => {
  const fonte = {
    motoristas: Array.from({length: 23}, (_, indice) => ({id: `m-${indice}`})),
    veiculos_motorista: [{id: 'v-1'}, {id: 'v-2'}],
    rotas: Array.from({length: 5}, (_, indice) => ({id: `r-${indice}`})),
    documentos_motorista: [{id: 'd-1'}],
    usuarios_app: Array.from({length: 4}, (_, indice) => ({id: `u-${indice}`})),
  };
  const plano = planoImportacao({fonte, empresaId: 'empresa-id'});
  const resumo = resumoPlano(plano);
  assert.equal(plano.executavel, false);
  assert.equal(plano.reconciliacao.aceite, false);
  assert.equal(plano.reconciliacao.papelDaPartida, 'contagem_de_partida');
  assert.equal(resumo.porEntidade.motoristas.total, 23);
  assert.equal(resumo.porEntidade.motoristas.inserir, 0);
  assert.equal(resumo.porEntidade.veiculos_motorista.total, 2);
  assert.equal(resumo.porEntidade.rotas.pendente, 5);
  assert.equal(resumo.porEntidade.documentos_motorista.pendente, 1);
  assert.equal(resumo.porEntidade.usuarios_app.pendente, 4);
  for (const entidade of ENTIDADES) assert.equal(plano.reconciliacao.entidades[entidade].fonteConferePartida, true);
  const texto = JSON.stringify(resumo);
  assert.equal(texto.includes('11122233344'), false);
  assert.equal(texto.includes('Motorista Exemplo'), false);
});

test('registro apto entra inativo, preserva vinculos e nao copia segredo de acesso', () => {
  const plano = planoImportacao({fonte: fonteApta, empresaId: 'empresa-id'});
  const porEntidade = Object.fromEntries(ENTIDADES.map(entidade => [entidade, plano.itens.filter(item => item.entidade === entidade)]));
  assert.equal(porEntidade.motoristas[0].acao, 'inserir');
  assert.equal(porEntidade.motoristas[0].registro.ativo, false);
  assert.equal(porEntidade.motoristas[0].registro.chave_estavel, 'forte-frete:motoristas:uuid-legado');
  assert.equal(porEntidade.veiculos_motorista[0].registro.placa, 'ABC1D23');
  assert.equal(porEntidade.veiculos_motorista[0].registro.ativo, false);
  assert.equal(porEntidade.documentos_motorista[0].registro.copiar_bytes, false);
  assert.equal(porEntidade.usuarios_app[0].registro.conceder_acesso, false);
  const usuario = JSON.stringify(porEntidade.usuarios_app[0].registro);
  assert.equal(usuario.includes('oculto@example.com'), false);
  assert.equal(usuario.includes('nao-copiar'), false);
  assert.equal(usuario.includes('11122233344'), false);
  const divergente = planoImportacao({fonte: {usuarios_app: [{id: 'local-1', user_id: 'auth-1', perfil: 'MOTORISTA', email: 'oculto@example.com', password: 'nao-copiar'}]}, empresaId: 'empresa-id'});
  const usuarioDivergente = divergente.itens[0];
  assert.equal(usuarioDivergente.acao, 'rejeitar_incompleto');
  assert.equal(usuarioDivergente.registro, null);
  assert.equal(JSON.stringify(usuarioDivergente).includes('nao-copiar'), false);
  assert.equal(JSON.stringify(resumoPlano(plano)).includes('11122233344'), false);
});

test('mesma chave nao sobrescreve e cpf ja ocupado bloqueia outra inclusao', () => {
  const primeiro = planoImportacao({fonte: fonteApta, empresaId: 'empresa-id'});
  const motoristaItem = primeiro.itens.find(item => item.entidade === 'motoristas');
  const igual = planoImportacao({
    fonte: fonteApta,
    destino: {motoristas: [{chave_estavel: motoristaItem.chaveEstavel, conteudo_hash: motoristaItem.conteudoHash, cpf: '11122233344'}]},
    empresaId: 'empresa-id',
  });
  assert.equal(igual.itens.find(item => item.entidade === 'motoristas').acao, 'ignorar_igual');
  const conflito = planoImportacao({
    fonte: fonteApta,
    destino: {motoristas: [{chave_estavel: motoristaItem.chaveEstavel, conteudo_hash: sha('outro'), cpf: '11122233344'}]},
    empresaId: 'empresa-id',
  });
  const itemConflito = conflito.itens.find(item => item.entidade === 'motoristas');
  assert.equal(itemConflito.acao, 'conflito_sem_sobrescrita');
  assert.equal(itemConflito.registro, null);
  assert.equal(itemConflito.preservaDestino, true);
  const natural = planoImportacao({
    fonte: fonteApta,
    destino: {motoristas: [{chave_estavel: 'forte-frete:motoristas:outro', conteudo_hash: sha('outro'), cpf: '111.222.333-44'}]},
    empresaId: 'empresa-id',
  });
  assert.equal(natural.itens.find(item => item.entidade === 'motoristas').acao, 'conflito_chave_natural');
});

test('duplicidade, vinculo quebrado e documento sem arquivo nao geram insert', () => {
  const plano = planoImportacao({
    fonte: {
      motoristas: [{id: 'm-1', nome: 'A'}, {id: 'm-1', nome: 'B'}],
      veiculos_motorista: [{id: 'v-1', motorista_id: 'ausente', placa: 'AAA1A11'}],
      documentos_motorista: [{id: 'd-1', motorista_id: 'm-1', tipo: 'cnh_frente', bucket: 'documentos'}],
    },
    empresaId: 'empresa-id',
  });
  const motoristas = plano.itens.filter(item => item.entidade === 'motoristas');
  assert.equal(motoristas[1].acao, 'duplicado_na_fonte');
  assert.equal(plano.itens.find(item => item.entidade === 'veiculos_motorista').acao, 'vinculo_ausente');
  const documento = plano.itens.find(item => item.entidade === 'documentos_motorista');
  assert.equal(documento.acao, 'rejeitar_incompleto');
  assert.equal(documento.registro, null);
  assert.ok(documento.camposPendentes.includes('storage_path'));
});

test('ensaio de restauracao confere identidade e falha sem apagar a origem', () => {
  const fiel = ensaiarRestauracao(fonteApta, structuredClone(fonteApta));
  assert.equal(fiel.equivalente, true);
  const semDocumento = structuredClone(fonteApta);
  semDocumento.documentos_motorista = [];
  const faltou = ensaiarRestauracao(fonteApta, semDocumento);
  assert.equal(faltou.equivalente, false);
  assert.deepEqual(faltou.faltantes, ['forte-frete:documentos_motorista:d1']);
  const alterado = structuredClone(fonteApta);
  alterado.rotas[0].nome = 'Rota alterada';
  assert.equal(ensaiarRestauracao(fonteApta, alterado).divergentes.includes('forte-frete:rotas:r1'), true);
});

test('manifesto exige schema, dados, auth, storage, edge e restauracao isolada', () => {
  assert.equal(validarManifestoBackup(manifestoValido()).valido, true);
  assert.equal(validarManifestoBackup(manifestoValido({restauracao: {ambiente: 'producao', contagens_conferidas: true, hashes_iguais: true}})).valido, false);
  const comEmail = manifestoValido();
  comEmail.auth.observacao = 'oculto@example.com';
  assert.equal(validarManifestoBackup(comEmail).erros.includes('dado_sensivel'), true);
});

test('homologacao simulada nao autoriza producao nem dispensa o gate de corte', () => {
  const fonte = {motoristas: [{id: 'm-1'}]};
  const plano = planoImportacao({fonte, empresaId: 'empresa-id'});
  const ensaio = ensaiarRestauracao(fonte, structuredClone(fonte));
  const avaliacao = avaliarProntidao({plano, manifesto: manifestoValido(), ensaio, aprovacaoHumana: true, pendenciasRevisadas: true});
  assert.equal(avaliacao.prontoParaHomologacao, true);
  assert.equal(avaliacao.aplicaProducao, false);
  assert.equal(permitirCorte({backupFonteValidado: true, backupDestinoValidado: true, restauracaoTestada: true, conciliacaoValidada: true, aprovacaoHumana: false}), false);
  const bloqueada = avaliarProntidao({plano, manifesto: manifestoValido(), ensaio, aprovacaoHumana: false, pendenciasRevisadas: true});
  assert.equal(bloqueada.prontoParaHomologacao, false);
  assert.ok(bloqueada.bloqueios.includes('aprovacao_humana'));
  assert.deepEqual(aplicarProducao({comando: 'delete from motoristas'}), {aplicado: false, motivo: 'bloqueado_sem_aceite_de_corte', comandos: []});
});
