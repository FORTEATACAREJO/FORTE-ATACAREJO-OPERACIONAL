// Identidade dos projetos Supabase da FORTE.
// O nome de exibicao nao define o banco. O project_ref define.

export const REFS = Object.freeze({
  freteLegado: 'nkynfboqwfxhhxcsrawl',
  operacional: 'gtwecfyffjszghnvtlzr',
  fiscal: 'xmfpvvmvdkepmnvtdoio',
});

export const NOME_EXIBICAO_PRETENDIDO = 'FORTE FRETE (LEGADO - NÃO APAGAR)';
export const CUSTO_MC6_USD_MES = 10;

const FERRAMENTAS_MCP_VISTAS = Object.freeze([
  'list_projects',
  'get_project',
  'create_project',
  'pause_project',
  'restore_project',
]);

export function classificarProjeto(projeto = {}) {
  const ref = String(projeto.ref || projeto.id || projeto.project_ref || '').trim();
  const nomeExibicao = String(projeto.name || projeto.nomeExibicao || '').trim();
  let papel = 'desconhecido';
  if (ref === REFS.freteLegado) papel = 'frete_legado';
  else if (ref === REFS.operacional) papel = 'operacional';
  else if (ref === REFS.fiscal) papel = 'fiscal';
  const rotuloMc6 = /mc[-\s]?6/i.test(nomeExibicao);
  let usoComoMc6 = 'nao_aplica';
  if (papel === 'frete_legado') usoComoMc6 = 'proibido';
  else if (rotuloMc6 || papel === 'desconhecido') usoComoMc6 = 'proibido_sem_ref_novo';
  return {
    ref: ref || null,
    nomeExibicao: nomeExibicao || null,
    papel,
    rotuloMc6,
    rotuloNaoDefineIdentidade: true,
    usoComoMc6,
    preservarDados: papel === 'frete_legado' || papel === 'fiscal',
  };
}

function recusa(motivo, classe, extra = {}) {
  return {permitido: false, motivo, classe, comandos: [], ...extra};
}

export function decidirOperacao(operacao, projeto = {}) {
  const classe = classificarProjeto(projeto);
  if (operacao === 'preservar') return {permitido: true, motivo: 'somente_leitura', classe, comandos: []};
  if (classe.papel === 'fiscal' && operacao !== 'preservar') return recusa('fiscal_isolado', classe);
  if (operacao === 'usar_como_mc6' || operacao === 'iniciar_schema_mc6') {
    return recusa(classe.papel === 'frete_legado' ? 'ref_e_frete_legado' : 'mc6_exige_projeto_novo_ou_sem_supabase', classe);
  }
  if (operacao === 'apagar' || operacao === 'truncar' || operacao === 'sobrescrever' || operacao === 'pausar') {
    return recusa('corte_nao_autorizado', classe);
  }
  if (operacao === 'criar_projeto_mc6') return recusa('custo_de_10_usd_sem_aceite', classe, {custoMensalUsd: CUSTO_MC6_USD_MES});
  if (operacao === 'renomear_exibicao') {
    if (classe.papel !== 'frete_legado') return recusa('renome_fora_do_frete', classe);
    return recusa('mcp_sem_projects_write', classe, {
      nomePretendido: NOME_EXIBICAO_PRETENDIDO,
      ferramentasMcp: FERRAMENTAS_MCP_VISTAS,
      patchNecessario: `PATCH /v1/projects/${REFS.freteLegado}`,
    });
  }
  if (operacao === 'importar_para_operacional' && classe.papel === 'frete_legado') {
    return {permitido: true, motivo: 'somente_plano_idempotente', classe, comandos: []};
  }
  return recusa('operacao_nao_reconhecida', classe);
}
