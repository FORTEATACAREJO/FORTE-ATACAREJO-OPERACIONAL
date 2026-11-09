// Aplica o plano Frete -> Operacional apenas em memoria.
// Nao abre rede, nao gera SQL e nao altera producao.
import {classificarProjeto, decidirOperacao} from './classificar-projeto.mjs';
import {planoImportacao, resumoPlano} from './plano-importacao.mjs';

const CONFLITO = new Set(['conflito_sem_sobrescrita', 'conflito_chave_natural', 'duplicado_na_fonte', 'vinculo_ausente']);

function gatesAceitos(gates = {}) {
  return gates.backupFisico === true
    && gates.aprovacaoHumana === true
    && gates.rollbackEnsaiado === true
    && gates.conciliacaoValidada === true;
}

export function importarIdempotente({
  fonte = {},
  destino = {},
  origem,
  alvo,
  dryRun = true,
  gates = {},
  empresaId = 'empresa-revisao',
  bucketUnicoComObjetos,
} = {}) {
  const origemDecisao = decidirOperacao('importar_para_operacional', origem);
  const alvoClasse = classificarProjeto(alvo);
  const bloqueios = [];
  if (!origemDecisao.permitido) bloqueios.push(origemDecisao.motivo);
  if (alvoClasse.papel !== 'operacional') bloqueios.push('alvo_nao_operacional');
  if (origemDecisao.classe?.ref && origemDecisao.classe.ref === alvoClasse.ref) bloqueios.push('escrita_no_legado');
  const plano = planoImportacao({fonte, destino, empresaId, bucketUnicoComObjetos});
  if ((plano.itens || []).some(item => CONFLITO.has(item.acao))) bloqueios.push('conflito');
  if (!gatesAceitos(gates)) bloqueios.push('gates');
  if (dryRun !== false) bloqueios.push('dry_run');
  const autorizado = bloqueios.length === 0;
  const proximo = structuredClone(destino || {});
  let inseridos = 0;
  if (autorizado) {
    for (const item of plano.itens) {
      if (item.acao !== 'inserir' || !item.registro) continue;
      const lista = Array.isArray(proximo[item.entidade]) ? proximo[item.entidade] : [];
      proximo[item.entidade] = [...lista, {
        chave_estavel: item.chaveEstavel,
        conteudo_hash: item.conteudoHash,
        cpf: item.registro.cpf || null,
        registro: item.registro,
      }];
      inseridos += 1;
    }
  }
  return {
    aplicado: autorizado,
    escopo: autorizado ? 'memoria' : 'nenhum',
    dryRun: !autorizado,
    inseridos: autorizado ? inseridos : 0,
    bloqueios,
    comandosRemotos: [],
    resumo: resumoPlano(plano),
    destino: autorizado ? proximo : destino,
  };
}
