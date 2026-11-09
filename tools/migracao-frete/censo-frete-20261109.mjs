// Selo de metadados lido em 2026-11-09. Nao contem linhas, caminhos de arquivo,
// e-mail, documento, senha nem corpo de Edge Function.
import {createHash} from 'node:crypto';
import {REFS} from './classificar-projeto.mjs';

const EDGE = Object.freeze([
  ['first-access', 5, false, '5758e0f70d2af5fa5b513c72d19006d131447cbb34d5869856d215a8290fff7f'],
  ['login-cpf', 10, false, '0170a2197c584d68881dfd32ea4b7c04384e30fd577d0f68730155ce3cced93c'],
  ['aceitar-carga', 4, true, '3dbc3dc9ac232262eac9c5cd46772ae4c4334404adedf45471077e837713f8ac'],
  ['motorista-viagem', 2, true, '184825631fbbd5a5c24b1a4efd9b0bfc41e22814210be12f2e7b544843179a47'],
  ['recover-password-email', 7, false, '39273dbdb4fa565cff16df7f721f8bd869466a9c175109215aa881ea788d9fa7'],
  ['bootstrap-master-once', 2, true, '21e37032991c26f4d44988b16711d6bdec70b25a0db90b7dfb40819b10402284'],
  ['register-user', 5, false, '20fcb3bb6fe045bd5794d13adb1f591e8e293d4367b408100be2fc12c1a9afe8'],
  ['set-password', 6, true, '1f8e2109560221681376f1bd3a8714867d8243805b0f76eb635c6972c50979a2'],
  ['register-driver-invite', 5, false, 'd7e8a938441e882dfbbadab1e818cdcbfd5779570d6d4d4736081ebc87027148'],
  ['access-standard', 13, false, '5a8b970274097ef687f5b7890010bb34f6dd33b090f1526f882dbcddb0b8d336'],
  ['forte-notifications', 4, false, '58af24cc4a4aed12c936d05f836f532840b5fa9ffa55906be282fba140af7d30'],
  ['vendas-frete-bridge', 15, false, '27715637b34894200d1e1df0513e679c02abaa98fe9b195112070c881b82e923'],
  ['driver-directory', 4, false, '4c4be406bf0a00ad111403ee9da458f41c28fa0d92cc0528cdcc38a0d8d52be8'],
  ['driver-onboarding', 9, false, '62c608de2fab89b579e1d1827adf40be178e9bd411af71bf1cba6b09dcdea8c4'],
  ['access-invites', 4, false, '93942b7b6cec3bbe45ab26f065b3c786a4b8802fee96436c7d0c2eb236deeae9'],
  ['integration-vault', 2, false, '12e02097759dc92a72c33d186e156dd1f75fe3d2bff371b25a4370c9725d5445'],
  ['account-deletion-review', 1, true, '15676cda58952aaf59743315a52ccdfdeeefb55dc940988abe24203cf922eb1b'],
  ['registration-dossier', 2, false, 'e4c5d2a057536159cc6a27758b05baf216b0ee44a3a9dd8993c690933066650d'],
  ['vehicle-registry', 1, false, 'e018bbdfff0d27758ed301f39e38ed75325e821fd036c07fb87011fbbfe5ce31'],
].map(([slug, version, verifyJwt, sha256]) => Object.freeze({slug, version, verifyJwt, sha256})));

function sha256Texto(valor) {
  return createHash('sha256').update(valor).digest('hex');
}

export const CENSO_FRETE_20261109 = Object.freeze({
  lidoEm: '2026-11-09',
  metodo: 'list_projects e SQL agregado, sem SELECT de linhas',
  escrita: false,
  projetos: Object.freeze([
    Object.freeze({
      ref: REFS.fiscal,
      nomeExibicao: 'FORTE FISCAL',
      classificacao: 'fiscal',
      regiao: 'sa-east-1',
      status: 'ACTIVE_HEALTHY',
      criadoEm: '2026-09-03T13:25:56.25665Z',
      linhasConsultadas: false,
    }),
    Object.freeze({
      ref: REFS.freteLegado,
      nomeExibicao: 'FORTE MC 6',
      classificacao: 'frete_legado',
      regiao: 'sa-east-1',
      status: 'ACTIVE_HEALTHY',
      criadoEm: '2026-09-20T17:02:34.33027Z',
      linhasConsultadas: false,
    }),
    Object.freeze({
      ref: REFS.operacional,
      nomeExibicao: 'FORTE ATACAREJO OPERACIONAL',
      classificacao: 'operacional',
      regiao: 'sa-east-1',
      status: 'ACTIVE_HEALTHY',
      criadoEm: '2026-09-14T12:22:40.058383Z',
      linhasConsultadas: false,
    }),
  ]),
  frete: Object.freeze({
    tabelasPublicas: 38,
    colunasPublicas: 414,
    schemaMd5: 'bb73c5b8146db6935ec5fda430bdada1',
    schemaSha256: '15ba07e0d16e62ade8c165517d48881af199101b1130f084e1e43184ab065f01',
    migrations: 56,
    authUsers: 4,
    edge: EDGE,
    storage: Object.freeze({
      objetos: 6,
      bytes: 15708136,
      buckets: Object.freeze([
        Object.freeze({id: 'forte-frete-cadastros', publico: false, objetos: 0}),
        Object.freeze({id: 'motorista-documentos', publico: false, objetos: 6}),
        Object.freeze({id: 'vendas-ordens-frete', publico: false, objetos: 0}),
      ]),
      caminhosExportados: false,
    }),
    contagens: Object.freeze({
      access_audit: 23,
      access_invites: 12,
      access_notifications: 9,
      access_recovery_requests: 0,
      access_requests: 3,
      cargas: 0,
      chaves_pix_frete: 1,
      configuracoes: 1,
      convites_motorista: 1,
      documentos_motorista: 1,
      documentos_veiculo: 5,
      driver_onboarding: 1,
      favorecidos_frete: 1,
      forte_legal_acceptance_events: 2,
      forte_legal_term_versions: 1,
      forte_notice_reads: 0,
      forte_push_subscriptions: 1,
      frete_alertas: 0,
      frete_atendimento: 0,
      frete_ofertas_auditoria: 0,
      frete_tarifas: 0,
      historico_motoristas_veiculo: 0,
      integracao_forte_vendas: 0,
      interesses_carga: 0,
      motorista_rotas: 0,
      motorista_veiculo_vinculos: 2,
      motoristas: 23,
      notificacoes_whatsapp: 0,
      ordens_carregamento: 0,
      password_recovery_limits: 52,
      registration_dossiers: 1,
      rotas: 5,
      usuarios_app: 4,
      vehicle_link_requests: 0,
      vehicle_registration_drafts: 0,
      veiculos_motorista: 2,
      vendas_ordens: 0,
      viagens: 0,
    }),
  }),
  operacional: Object.freeze({
    tabelasPublicas: 84,
    migrations: 66,
    authUsers: 3,
    buckets: 5,
    objetosStorage: 261,
    edgeFunctions: 26,
    fc_motoristas: 0,
    fc_veiculos: 0,
    fc_motorista_veiculos: 0,
    fc_documentos: 0,
  }),
  mc6: Object.freeze({
    projetoSupabaseNovo: false,
    repositorioPrivado: false,
    podeComecarSemSupabase: true,
    custoMensalUsdCitado: 10,
    autorizado: false,
  }),
  backupFisico: Object.freeze({
    exportado: false,
    motivo: 'Sem token da Management API e com o repositorio publico, nao houve pg_dump, download de Storage nem export de Auth.',
  }),
  migracaoExecutada: false,
});

export function hashEdge(edge = CENSO_FRETE_20261109.frete.edge) {
  return sha256Texto(edge.map(item => `${item.slug}:${item.version}:${item.sha256}`).join('\n'));
}

export function hashContagens(contagens) {
  const texto = Object.keys(contagens).sort().map(tabela => `${tabela}:${contagens[tabela]}`).join('\n');
  return sha256Texto(texto);
}

export function ensaiarRestauracaoContagens(origem = {}, copia = {}) {
  const faltantes = [];
  const divergentes = [];
  const extras = [];
  for (const [tabela, linhas] of Object.entries(origem)) {
    if (!(tabela in copia)) faltantes.push(tabela);
    else if (copia[tabela] !== linhas) divergentes.push(tabela);
  }
  for (const tabela of Object.keys(copia)) if (!(tabela in origem)) extras.push(tabela);
  return {
    equivalente: faltantes.length === 0 && divergentes.length === 0 && extras.length === 0,
    faltantes,
    divergentes,
    extras,
  };
}

export function validarSelo(censo = CENSO_FRETE_20261109) {
  const erros = [];
  const frete = censo.projetos?.find(item => item.ref === REFS.freteLegado);
  const operacional = censo.projetos?.find(item => item.ref === REFS.operacional);
  const fiscal = censo.projetos?.find(item => item.ref === REFS.fiscal);
  if (censo.projetos?.length !== 3) erros.push('projetos');
  if (!frete || frete.classificacao !== 'frete_legado' || frete.nomeExibicao !== 'FORTE MC 6') erros.push('rotulo_frete');
  if (frete?.criadoEm !== '2026-09-20T17:02:34.33027Z') erros.push('frete_nao_e_projeto_novo');
  if (!operacional || operacional.classificacao !== 'operacional') erros.push('operacional');
  if (!fiscal || fiscal.classificacao !== 'fiscal' || fiscal.linhasConsultadas !== false) erros.push('fiscal');
  if (Object.keys(censo.frete?.contagens || {}).length !== 38) erros.push('tabelas');
  if (censo.frete?.contagens?.motoristas !== 23) erros.push('motoristas');
  if (censo.frete?.contagens?.veiculos_motorista !== 2) erros.push('veiculos');
  if (censo.frete?.contagens?.rotas !== 5) erros.push('rotas');
  if (censo.frete?.contagens?.documentos_motorista !== 1) erros.push('documentos_motorista');
  if (censo.frete?.contagens?.documentos_veiculo !== 5) erros.push('documentos_veiculo');
  if (censo.frete?.contagens?.usuarios_app !== 4) erros.push('usuarios_app');
  if (censo.frete?.contagens?.motorista_veiculo_vinculos !== 2) erros.push('vinculos');
  if (censo.frete?.authUsers !== 4) erros.push('auth');
  if (censo.frete?.schemaSha256 !== '15ba07e0d16e62ade8c165517d48881af199101b1130f084e1e43184ab065f01') erros.push('schema');
  if (censo.frete?.edge?.length !== 19) erros.push('edge');
  if (censo.frete?.storage?.objetos !== 6 || censo.frete?.storage?.bytes !== 15708136) erros.push('storage');
  if (censo.frete?.storage?.caminhosExportados !== false) erros.push('caminhos');
  const documentos = (censo.frete?.contagens?.documentos_motorista || 0) + (censo.frete?.contagens?.documentos_veiculo || 0);
  const bucket = censo.frete?.storage?.buckets?.find(item => item.id === 'motorista-documentos');
  if (!bucket || bucket.objetos !== documentos) erros.push('documentos_versus_objetos');
  if (censo.operacional?.fc_motoristas !== 0 || censo.operacional?.fc_veiculos !== 0) erros.push('destino_nao_vazio');
  if (censo.migracaoExecutada !== false) erros.push('migracao');
  if (censo.backupFisico?.exportado !== false) erros.push('backup_fisico_afirmado');
  if (censo.mc6?.projetoSupabaseNovo !== false || censo.mc6?.autorizado !== false) erros.push('mc6');
  if (censo.escrita !== false) erros.push('escrita');
  return {
    valido: erros.length === 0,
    erros,
    backupRestauravel: false,
    bloqueios: ['backup_fisico_ausente', 'rotulo_mc6_no_frete', 'corte_nao_autorizado'],
  };
}

export function resumoCenso(censo = CENSO_FRETE_20261109) {
  const selo = validarSelo(censo);
  return {
    lidoEm: censo.lidoEm,
    consultaViva: true,
    escrita: false,
    migracaoExecutada: censo.migracaoExecutada === true,
    backupRestauravel: selo.backupRestauravel,
    rotuloFrete: censo.projetos.find(item => item.ref === REFS.freteLegado)?.nomeExibicao || null,
    classificacaoFrete: 'frete_legado',
    partida: {
      motoristas: censo.frete.contagens.motoristas,
      veiculos_motorista: censo.frete.contagens.veiculos_motorista,
      rotas: censo.frete.contagens.rotas,
      documentos_motorista: censo.frete.contagens.documentos_motorista,
      usuarios_app: censo.frete.contagens.usuarios_app,
    },
    alemDaPartida: {
      documentos_veiculo: censo.frete.contagens.documentos_veiculo,
      motorista_veiculo_vinculos: censo.frete.contagens.motorista_veiculo_vinculos,
      authUsers: censo.frete.authUsers,
      objetosStorage: censo.frete.storage.objetos,
      bytesStorage: censo.frete.storage.bytes,
      edgeFunctions: censo.frete.edge.length,
    },
    operacionalFrete: {
      fc_motoristas: censo.operacional.fc_motoristas,
      fc_veiculos: censo.operacional.fc_veiculos,
      fc_motorista_veiculos: censo.operacional.fc_motorista_veiculos,
      fc_documentos: censo.operacional.fc_documentos,
    },
    schemaSha256: censo.frete.schemaSha256,
    edgeSha256: hashEdge(censo.frete.edge),
    contagensSha256: hashContagens(censo.frete.contagens),
    seloValido: selo.valido,
    bloqueios: selo.bloqueios,
  };
}

export function relatorio() {
  return resumoCenso();
}
