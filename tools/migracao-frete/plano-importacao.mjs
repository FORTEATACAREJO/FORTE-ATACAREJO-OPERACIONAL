// Planejamento puro da migracao Frete -> Operacional.
// Nao abre rede, nao le banco e nao emite comando de escrita.
import {createHash} from 'node:crypto';
import {analisarMotoristaLegado, somenteDigitos} from './normalizar-legado.mjs';

export const ORIGEM_SISTEMA = 'forte-frete';

/** Contagens lidas em 2026-11-09. Sao ponto de partida, nao criterio de aceite. */
export const CONTAGENS_PARTIDA_20261109 = Object.freeze({
  motoristas: 23,
  veiculos_motorista: 2,
  rotas: 5,
  documentos_motorista: 1,
  usuarios_app: 4,
});

export const ENTIDADES = Object.freeze(Object.keys(CONTAGENS_PARTIDA_20261109));
const ENTIDADES_COMPLEMENTARES = Object.freeze(['documentos_veiculo', 'motorista_veiculo_vinculos']);
export {ENTIDADES_COMPLEMENTARES};

const CAMPOS_COMPLEMENTARES = Object.freeze({
  documentos_veiculo: ['id', 'veiculo_id', 'tipo', 'arquivo_path', 'storage_path', 'bucket'],
  motorista_veiculo_vinculos: ['id', 'motorista_id', 'veiculo_id'],
});

const CAMPOS_IDENTIDADE = Object.freeze({
  motoristas: ['id', 'nome', 'cpf', 'telefone', 'cnh_registro', 'categoria_cnh', 'validade_cnh', 'rntrc', 'proprietario_nome', 'proprietario_cpf_cnpj', 'chave_pix', 'titular_pix', 'status_cadastro', 'auth_user_id'],
  veiculos_motorista: ['id', 'motorista_id', 'placa', 'capacidade_efetiva_t', 'capacidade_t', 'rntrc', 'proprietario_nome', 'ativo'],
  rotas: ['id', 'nome', 'origem', 'destino', 'origem_cidade', 'origem_uf'],
  documentos_motorista: ['id', 'motorista_id', 'tipo', 'bucket', 'storage_bucket', 'storage_path', 'caminho', 'path', 'arquivo_path'],
  usuarios_app: ['id', 'user_id', 'perfil', 'status_aprovacao', 'ativo'],
});

const CONFLITOS = new Set(['conflito_sem_sobrescrita', 'conflito_chave_natural', 'duplicado_na_fonte', 'vinculo_ausente']);

export function chaveEstavel(tabela, id) {
  const origemId = String(id ?? '').trim();
  if (![...ENTIDADES, ...ENTIDADES_COMPLEMENTARES].includes(tabela) || !origemId) return null;
  return `${ORIGEM_SISTEMA}:${tabela}:${origemId}`;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function hashRegistro(registro) {
  return createHash('sha256').update(canonical(registro)).digest('hex');
}

function texto(value) {
  return String(value ?? '').trim();
}

function itemBase(entidade, origemId, extra) {
  return {
    entidade,
    origemId: origemId || null,
    chaveEstavel: chaveEstavel(entidade, origemId),
    preservaDestino: true,
    registro: null,
    ...extra,
  };
}

function finalizar(parcial, ocupacao) {
  if (!parcial.apto) {
    const duplicado = ocupacao.reservar(chaveEstavel(parcial.entidade, parcial.origemId));
    return itemBase(parcial.entidade, parcial.origemId, {
      acao: duplicado || parcial.acao || 'rejeitar_incompleto',
      camposPendentes: parcial.camposPendentes,
      conteudoHash: null,
    });
  }
  const conteudoHash = hashRegistro(parcial.registro);
  const ocupada = ocupacao.claim(parcial.chave, conteudoHash);
  let acao = ocupada;
  let registro = acao === 'inserir' ? parcial.registro : null;
  if (acao === 'inserir' && parcial.cpf) {
    const anterior = ocupacao.cpf.get(parcial.cpf);
    if (anterior && anterior !== parcial.chave) {
      acao = 'conflito_chave_natural';
      registro = null;
    } else ocupacao.cpf.set(parcial.cpf, parcial.chave);
  }
  return itemBase(parcial.entidade, parcial.origemId, {
    acao,
    camposPendentes: [],
    conteudoHash,
    preservaDestino: acao !== 'inserir',
    registro,
  });
}

function criarOcupacao(destino) {
  const chaves = new Map();
  const cpf = new Map();
  const vistas = new Set();
  for (const entidade of [...ENTIDADES, ...ENTIDADES_COMPLEMENTARES]) {
    for (const row of destino?.[entidade] || []) {
      if (!row?.chave_estavel) continue;
      chaves.set(row.chave_estavel, row.conteudo_hash || null);
      if (entidade === 'motoristas') {
        const digitos = somenteDigitos(row.cpf || row.registro?.cpf);
        if (digitos.length === 11) cpf.set(digitos, row.chave_estavel);
      }
    }
  }
  return {
    cpf,
    reservar(chave) {
      if (!chave) return null;
      if (vistas.has(chave)) return 'duplicado_na_fonte';
      vistas.add(chave);
      return null;
    },
    claim(chave, hash) {
      const duplicado = this.reservar(chave);
      if (duplicado) return duplicado;
      if (!chaves.has(chave)) {
        chaves.set(chave, hash);
        return 'inserir';
      }
      return chaves.get(chave) === hash ? 'ignorar_igual' : 'conflito_sem_sobrescrita';
    },
  };
}

function mapearMotorista(row, veiculos, empresaId) {
  const veiculo = (veiculos || []).find(item => texto(item.motorista_id) === texto(row?.id)) || null;
  const analise = analisarMotoristaLegado(row, veiculo, empresaId);
  const chave = chaveEstavel('motoristas', analise.origemId);
  if (!analise.apto) {
    return {apto: false, entidade: 'motoristas', origemId: analise.origemId, camposPendentes: analise.camposPendentes, acao: 'rejeitar_incompleto'};
  }
  return {
    apto: true,
    entidade: 'motoristas',
    origemId: analise.origemId,
    chave,
    cpf: analise.registro.cpf,
    registro: {...analise.registro, origem_sistema: ORIGEM_SISTEMA, origem_tabela: 'motoristas', origem_id: analise.origemId, chave_estavel: chave, ativo: false},
  };
}

function mapearVeiculo(row, motoristasIds, vinculosPorVeiculo = new Map()) {
  const origemId = texto(row?.id);
  const motoristaId = texto(row?.motorista_id) || texto(vinculosPorVeiculo.get(texto(row?.id)));
  const placa = texto(row?.placa).toUpperCase();
  const camposPendentes = [];
  if (!origemId) camposPendentes.push('id');
  if (!motoristaId) camposPendentes.push('motorista_id');
  if (!placa) camposPendentes.push('placa');
  if (camposPendentes.length) return {apto: false, entidade: 'veiculos_motorista', origemId, camposPendentes};
  if (!motoristasIds.has(motoristaId)) return {apto: false, entidade: 'veiculos_motorista', origemId, camposPendentes: ['motorista_id'], acao: 'vinculo_ausente'};
  const capacidade = Number(row.capacidade_efetiva_t ?? row.capacidade_t);
  const chave = chaveEstavel('veiculos_motorista', origemId);
  return {
    apto: true,
    entidade: 'veiculos_motorista',
    origemId,
    chave,
    registro: {
      origem_sistema: ORIGEM_SISTEMA,
      origem_tabela: 'veiculos_motorista',
      origem_id: origemId,
      chave_estavel: chave,
      motorista_origem_id: motoristaId,
      placa,
      capacidade_t: Number.isFinite(capacidade) ? capacidade : null,
      ativo: false,
    },
  };
}

function descreverDestinos(destinos) {
  if (Array.isArray(destinos)) {
    return destinos.map(item => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return texto(item.cidade || item.nome || item.destino);
      return '';
    }).filter(Boolean).join(', ');
  }
  if (typeof destinos === 'string') return texto(destinos);
  return '';
}

function mapearRota(row) {
  const origemId = texto(row?.id);
  const nome = texto(row?.nome);
  const origemCidade = texto(row?.origem_cidade);
  const origemUf = texto(row?.origem_uf);
  const origem = texto(row?.origem) || [origemCidade, origemUf].filter(Boolean).join('/');
  const destino = texto(row?.destino) || descreverDestinos(row?.destinos);
  const camposPendentes = [];
  if (!origemId) camposPendentes.push('id');
  if (!nome && !origem && !destino) camposPendentes.push('identificacao');
  if (camposPendentes.length) return {apto: false, entidade: 'rotas', origemId, camposPendentes};
  const chave = chaveEstavel('rotas', origemId);
  return {
    apto: true,
    entidade: 'rotas',
    origemId,
    chave,
    registro: {
      origem_sistema: ORIGEM_SISTEMA,
      origem_tabela: 'rotas',
      origem_id: origemId,
      chave_estavel: chave,
      nome: nome || null,
      origem: origem || null,
      destino: destino || null,
      origem_cidade: origemCidade || null,
      origem_uf: origemUf || null,
      ativa: row?.ativa === true,
    },
  };
}

function referenciaArquivo(row, contexto) {
  const caminho = texto(row?.storage_path || row?.caminho || row?.path || row?.arquivo_path);
  const explicito = texto(row?.bucket || row?.storage_bucket);
  if (explicito) return {bucket: explicito, caminho, bucketOrigem: 'linha'};
  if (caminho && texto(contexto?.bucketUnicoComObjetos)) {
    return {bucket: texto(contexto.bucketUnicoComObjetos), caminho, bucketOrigem: 'unico_bucket_com_objetos'};
  }
  return {bucket: '', caminho, bucketOrigem: null};
}

function mapearDocumento(row, motoristasIds, contexto) {
  const origemId = texto(row?.id);
  const motoristaId = texto(row?.motorista_id);
  const tipo = texto(row?.tipo);
  const arquivo = referenciaArquivo(row, contexto);
  const bucket = arquivo.bucket;
  const caminho = arquivo.caminho;
  const camposPendentes = [];
  if (!origemId) camposPendentes.push('id');
  if (!motoristaId) camposPendentes.push('motorista_id');
  if (!tipo) camposPendentes.push('tipo');
  if (!bucket) camposPendentes.push('bucket');
  if (!caminho) camposPendentes.push('storage_path');
  if (camposPendentes.length) return {apto: false, entidade: 'documentos_motorista', origemId, camposPendentes};
  if (!motoristasIds.has(motoristaId)) return {apto: false, entidade: 'documentos_motorista', origemId, camposPendentes: ['motorista_id'], acao: 'vinculo_ausente'};
  const chave = chaveEstavel('documentos_motorista', origemId);
  return {
    apto: true,
    entidade: 'documentos_motorista',
    origemId,
    chave,
    registro: {
      origem_sistema: ORIGEM_SISTEMA,
      origem_tabela: 'documentos_motorista',
      origem_id: origemId,
      chave_estavel: chave,
      motorista_origem_id: motoristaId,
      tipo,
      bucket,
      bucket_origem: arquivo.bucketOrigem,
      storage_path: caminho,
      conteudo_sha256: /^[a-f0-9]{64}$/.test(texto(row?.conteudo_sha256)) ? texto(row.conteudo_sha256) : null,
      copiar_bytes: false,
    },
  };
}

function mapearDocumentoVeiculo(row, veiculosIds, contexto) {
  const origemId = texto(row?.id);
  const veiculoId = texto(row?.veiculo_id);
  const tipo = texto(row?.tipo);
  const arquivo = referenciaArquivo(row, contexto);
  const camposPendentes = [];
  if (!origemId) camposPendentes.push('id');
  if (!veiculoId) camposPendentes.push('veiculo_id');
  if (!tipo) camposPendentes.push('tipo');
  if (!arquivo.bucket) camposPendentes.push('bucket');
  if (!arquivo.caminho) camposPendentes.push('storage_path');
  if (camposPendentes.length) return {apto: false, entidade: 'documentos_veiculo', origemId, camposPendentes};
  if (!veiculosIds.has(veiculoId)) return {apto: false, entidade: 'documentos_veiculo', origemId, camposPendentes: ['veiculo_id'], acao: 'vinculo_ausente'};
  const chave = chaveEstavel('documentos_veiculo', origemId);
  return {
    apto: true,
    entidade: 'documentos_veiculo',
    origemId,
    chave,
    registro: {
      origem_sistema: ORIGEM_SISTEMA,
      origem_tabela: 'documentos_veiculo',
      origem_id: origemId,
      chave_estavel: chave,
      veiculo_origem_id: veiculoId,
      tipo,
      bucket: arquivo.bucket,
      bucket_origem: arquivo.bucketOrigem,
      storage_path: arquivo.caminho,
      copiar_bytes: false,
    },
  };
}

function mapearVinculo(row, motoristasIds, veiculosIds) {
  const origemId = texto(row?.id);
  const motoristaId = texto(row?.motorista_id);
  const veiculoId = texto(row?.veiculo_id);
  const camposPendentes = [];
  if (!origemId) camposPendentes.push('id');
  if (!motoristaId) camposPendentes.push('motorista_id');
  if (!veiculoId) camposPendentes.push('veiculo_id');
  if (camposPendentes.length) return {apto: false, entidade: 'motorista_veiculo_vinculos', origemId, camposPendentes};
  if (!motoristasIds.has(motoristaId) || !veiculosIds.has(veiculoId)) {
    return {apto: false, entidade: 'motorista_veiculo_vinculos', origemId, camposPendentes: ['referencia'], acao: 'vinculo_ausente'};
  }
  const chave = chaveEstavel('motorista_veiculo_vinculos', origemId);
  return {
    apto: true,
    entidade: 'motorista_veiculo_vinculos',
    origemId,
    chave,
    registro: {
      origem_sistema: ORIGEM_SISTEMA,
      origem_tabela: 'motorista_veiculo_vinculos',
      origem_id: origemId,
      chave_estavel: chave,
      motorista_origem_id: motoristaId,
      veiculo_origem_id: veiculoId,
    },
  };
}

function mapearUsuario(row) {
  const userId = texto(row?.user_id);
  const id = texto(row?.id);
  const origemId = userId || id;
  const perfil = texto(row?.perfil);
  const camposPendentes = [];
  if (!origemId) camposPendentes.push('user_id');
  if (userId && id && userId !== id) camposPendentes.push('id_auth_divergente');
  if (!perfil) camposPendentes.push('perfil');
  if (camposPendentes.length) return {apto: false, entidade: 'usuarios_app', origemId, camposPendentes};
  const chave = chaveEstavel('usuarios_app', origemId);
  return {
    apto: true,
    entidade: 'usuarios_app',
    origemId,
    chave,
    registro: {
      origem_sistema: ORIGEM_SISTEMA,
      origem_tabela: 'usuarios_app',
      origem_id: origemId,
      chave_estavel: chave,
      perfil,
      status_aprovacao: texto(row?.status_aprovacao) || null,
      conceder_acesso: false,
      ativo: false,
    },
  };
}

export function reconciliarContagens(fonte = {}, destino = {}) {
  const tamanho = (bag, entidade) => Array.isArray(bag?.[entidade]) ? bag[entidade].length : 0;
  const entidades = {};
  for (const entidade of ENTIDADES) {
    const partida = CONTAGENS_PARTIDA_20261109[entidade];
    const atualFonte = tamanho(fonte, entidade);
    const atualDestino = tamanho(destino, entidade);
    entidades[entidade] = {partida, fonte: atualFonte, destino: atualDestino, fonteConferePartida: atualFonte === partida, destinoConfereFonte: atualDestino === atualFonte};
  }
  return {papelDaPartida: 'contagem_de_partida', aceite: false, entidades};
}

export function planoImportacao({fonte = {}, destino = {}, empresaId, bucketUnicoComObjetos} = {}) {
  const ocupacao = criarOcupacao(destino);
  const motoristasIds = new Set((fonte.motoristas || []).map(row => texto(row?.id)).filter(Boolean));
  const veiculosIds = new Set((fonte.veiculos_motorista || []).map(row => texto(row?.id)).filter(Boolean));
  const vinculosPorVeiculo = new Map();
  for (const vinculo of fonte.motorista_veiculo_vinculos || []) {
    const veiculoId = texto(vinculo?.veiculo_id);
    const motoristaId = texto(vinculo?.motorista_id);
    if (veiculoId && motoristaId && !vinculosPorVeiculo.has(veiculoId)) vinculosPorVeiculo.set(veiculoId, motoristaId);
  }
  const contexto = {bucketUnicoComObjetos};
  const mapeadores = {
    motoristas: row => mapearMotorista(row, fonte.veiculos_motorista, empresaId),
    veiculos_motorista: row => mapearVeiculo(row, motoristasIds, vinculosPorVeiculo),
    rotas: mapearRota,
    documentos_motorista: row => mapearDocumento(row, motoristasIds, contexto),
    usuarios_app: mapearUsuario,
  };
  const itens = [];
  for (const entidade of ENTIDADES) {
    for (const row of fonte[entidade] || []) itens.push(finalizar(mapeadores[entidade](row), ocupacao));
  }
  for (const row of fonte.documentos_veiculo || []) itens.push(finalizar(mapearDocumentoVeiculo(row, veiculosIds, contexto), ocupacao));
  for (const row of fonte.motorista_veiculo_vinculos || []) itens.push(finalizar(mapearVinculo(row, motoristasIds, veiculosIds), ocupacao));
  return {executavel: false, aplicaProducao: false, reconciliacao: reconciliarContagens(fonte, destino), itens};
}

export function resumoPlano(plano) {
  const itens = (plano?.itens || []).map(({registro, ...resto}) => resto);
  const porEntidade = {};
  for (const entidade of ENTIDADES) porEntidade[entidade] = {total: 0, inserir: 0, ignorar_igual: 0, conflito: 0, pendente: 0};
  for (const item of itens) {
    if (!porEntidade[item.entidade]) porEntidade[item.entidade] = {total: 0, inserir: 0, ignorar_igual: 0, conflito: 0, pendente: 0};
    const grupo = porEntidade[item.entidade];
    grupo.total += 1;
    if (item.acao === 'inserir') grupo.inserir += 1;
    else if (item.acao === 'ignorar_igual') grupo.ignorar_igual += 1;
    else if (CONFLITOS.has(item.acao)) grupo.conflito += 1;
    else grupo.pendente += 1;
  }
  return {executavel: false, aplicaProducao: false, reconciliacao: plano?.reconciliacao || null, porEntidade, itens};
}

function escolherId(entidade, row) {
  if (entidade === 'usuarios_app') return texto(row?.user_id || row?.id);
  return texto(row?.id);
}

export function snapshotIdentidade(fonte = {}) {
  const itens = [];
  for (const entidade of ENTIDADES) {
    for (const row of fonte[entidade] || []) {
      const origemId = escolherId(entidade, row);
      const chave = chaveEstavel(entidade, origemId);
      if (!chave) {
        itens.push({entidade, chaveEstavel: null, conteudoHash: null});
        continue;
      }
      const pick = {};
      for (const campo of CAMPOS_IDENTIDADE[entidade]) pick[campo] = row?.[campo] ?? null;
      itens.push({entidade, chaveEstavel: chave, conteudoHash: hashRegistro(pick)});
    }
  }
  for (const entidade of ENTIDADES_COMPLEMENTARES) {
    if (!Array.isArray(fonte[entidade])) continue;
    for (const row of fonte[entidade]) {
      const origemId = texto(row?.id);
      const chave = chaveEstavel(entidade, origemId);
      if (!chave) {
        itens.push({entidade, chaveEstavel: null, conteudoHash: null});
        continue;
      }
      const pick = {};
      for (const campo of CAMPOS_COMPLEMENTARES[entidade]) pick[campo] = row?.[campo] ?? null;
      itens.push({entidade, chaveEstavel: chave, conteudoHash: hashRegistro(pick)});
    }
  }
  return itens;
}

function indexarSnapshot(snapshot) {
  const map = new Map();
  const semId = [];
  const duplicados = [];
  for (const item of snapshot) {
    if (!item.chaveEstavel || !item.conteudoHash) {
      semId.push(item.entidade);
      continue;
    }
    if (map.has(item.chaveEstavel)) duplicados.push(item.chaveEstavel);
    else map.set(item.chaveEstavel, item.conteudoHash);
  }
  return {map, semId, duplicados};
}

export function ensaiarRestauracao(fonte = {}, copia = {}) {
  const origem = indexarSnapshot(snapshotIdentidade(fonte));
  const restaurada = indexarSnapshot(snapshotIdentidade(copia));
  const faltantes = [];
  const divergentes = [];
  const extras = [];
  for (const [chave, hash] of origem.map) {
    if (!restaurada.map.has(chave)) faltantes.push(chave);
    else if (restaurada.map.get(chave) !== hash) divergentes.push(chave);
  }
  for (const chave of restaurada.map.keys()) if (!origem.map.has(chave)) extras.push(chave);
  const equivalente = origem.semId.length === 0 && restaurada.semId.length === 0 && origem.duplicados.length === 0 && restaurada.duplicados.length === 0 && faltantes.length === 0 && divergentes.length === 0 && extras.length === 0;
  return {
    equivalente,
    faltantes,
    divergentes,
    extras,
    semId: origem.semId.length + restaurada.semId.length,
    duplicados: [...origem.duplicados, ...restaurada.duplicados],
  };
}

const SHA256 = /^[a-f0-9]{64}$/;
const SENSIVEL = /@[a-z0-9.-]+\.[a-z]{2,}|\d{3}\.\d{3}\.\d{3}-\d{2}|service_role|sb_secret|sb_publishable|private[_ ]key|bearer\s|password|senha_hash/i;

export function contemDadoSensivel(textoLivre) {
  return SENSIVEL.test(String(textoLivre ?? ''));
}

export function validarManifestoBackup(manifesto) {
  const erros = [];
  if (!manifesto || typeof manifesto !== 'object') return {valido: false, erros: ['manifesto']};
  if (contemDadoSensivel(JSON.stringify(manifesto))) erros.push('dado_sensivel');
  if (!SHA256.test(manifesto.schema?.sha256 || '')) erros.push('schema');
  for (const entidade of ENTIDADES) {
    const item = manifesto.dados?.[entidade];
    if (!item || !Number.isInteger(item.contagem) || item.contagem < 0 || !SHA256.test(item.sha256 || '')) erros.push(`dados:${entidade}`);
  }
  if (!Number.isInteger(manifesto.auth?.contagem) || manifesto.auth.contagem < 0 || !SHA256.test(manifesto.auth?.sha256 || '')) erros.push('auth');
  if (!Number.isInteger(manifesto.storage?.objetos) || manifesto.storage.objetos < 0 || !SHA256.test(manifesto.storage?.manifesto_sha256 || '')) erros.push('storage');
  if (!Array.isArray(manifesto.edge?.nomes) || manifesto.edge.nomes.length === 0 || manifesto.edge.nomes.some(nome => typeof nome !== 'string' || !nome.trim()) || !SHA256.test(manifesto.edge?.sha256 || '')) erros.push('edge');
  if (manifesto.restauracao?.ambiente !== 'isolado') erros.push('restauracao_ambiente');
  if (manifesto.restauracao?.contagens_conferidas !== true) erros.push('restauracao_contagens');
  if (manifesto.restauracao?.hashes_iguais !== true) erros.push('restauracao_hashes');
  return {valido: erros.length === 0, erros};
}

export function avaliarProntidao({plano, manifesto, ensaio, aprovacaoHumana = false, pendenciasRevisadas = false} = {}) {
  const bloqueios = [];
  if (!plano || plano.executavel !== false || plano.aplicaProducao !== false) bloqueios.push('plano');
  if ((plano?.itens || []).some(item => CONFLITOS.has(item.acao))) bloqueios.push('conflito');
  if ((plano?.itens || []).some(item => item.acao === 'rejeitar_incompleto') && pendenciasRevisadas !== true) bloqueios.push('pendencias_sem_revisao');
  if (!validarManifestoBackup(manifesto).valido) bloqueios.push('backup');
  if (ensaio?.equivalente !== true) bloqueios.push('restauracao');
  if (aprovacaoHumana !== true) bloqueios.push('aprovacao_humana');
  if (plano?.reconciliacao?.aceite !== false || plano?.reconciliacao?.papelDaPartida !== 'contagem_de_partida') bloqueios.push('partida_nao_e_aceite');
  return {prontoParaHomologacao: bloqueios.length === 0, bloqueios, aplicaProducao: false};
}

export function aplicarProducao() {
  return Object.freeze({aplicado: false, motivo: 'bloqueado_sem_aceite_de_corte', comandos: []});
}
