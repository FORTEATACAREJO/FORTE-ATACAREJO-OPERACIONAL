import {aplicarDecisao,planejarDocumento,planejarMotorista,planejarRota,planejarUsuario,planejarVeiculo,resumoPlano} from './planejar-importacao.mjs';
import {permitirCorte} from './normalizar-legado.mjs';

export const BASE_AUDITORIA={motorista:23,veiculo:2,rota:5,documento:1,usuario:4};
const LISTAS={motorista:'motoristas',veiculo:'veiculos',rota:'rotas',documento:'documentos',usuario:'usuarios'};
const SEGREDO=/"senha"|"password"|"token"|"access_token"|"conteudo_base64"|"arquivo"|"service_role"/;

export function contagens(origem={}){
 return Object.fromEntries(Object.entries(LISTAS).map(([entidade,campo])=>[entidade,(origem[campo]||[]).length]));
}
export function preservarBase(origem,base=BASE_AUDITORIA){
 const contagem=contagens(origem);
 const faltam={};
 for(const [entidade,minimo] of Object.entries(base))if((contagem[entidade]||0)<minimo)faltam[entidade]={minimo,atual:contagem[entidade]||0};
 return {preservado:Object.keys(faltam).length===0,contagem,faltam};
}
function planosDe(origem,empresaId){
 const veiculos=origem.veiculos||[];
 return [
  ...(origem.motoristas||[]).map(motorista=>planejarMotorista(motorista,veiculos.find(veiculo=>veiculo.motorista_id===motorista.id),empresaId)),
  ...veiculos.map(planejarVeiculo),
  ...(origem.rotas||[]).map(planejarRota),
  ...(origem.documentos||[]).map(planejarDocumento),
  ...(origem.usuarios||[]).map(planejarUsuario)
 ];
}
export function reconciliar(origem={},destino=[],opcoes={}){
 const empresaId=opcoes.empresaId||'';
 const base=preservarBase(origem,opcoes.base||BASE_AUDITORIA);
 const planos=planosDe(origem,empresaId);
 const guardado=new Map((destino||[]).filter(item=>item?.chave).map(item=>[item.chave,item]));
 const decisoes=planos.map(plano=>{
  const decisao=aplicarDecisao(guardado.get(plano.chave)||null,plano);
  return {...decisao,entidade:plano.entidade,hash:plano.hash,atualizadoEm:plano.atualizadoEm};
 });
 const bloqueios=[];
 if(!base.preservado)bloqueios.push('base_incompleta');
 if(!empresaId)bloqueios.push('empresa_ausente');
 if(planos.some(plano=>!plano.chave))bloqueios.push('chave_instavel');
 if(decisoes.some(item=>item.acao==='conflito'||item.acao==='bloquear'))bloqueios.push('conflito');
 if(planos.some(plano=>plano.entidade==='usuario'&&!plano.registro?.auth_user_id))bloqueios.push('auth_sem_referencia');
 if(planos.some(plano=>plano.entidade==='documento'&&!plano.apto))bloqueios.push('storage_sem_referencia');
 const novas=new Set(planos.map(plano=>plano.chave).filter(Boolean));
 if((destino||[]).some(item=>String(item?.chave||'').startsWith('FORTE_FRETE:')&&!novas.has(item.chave)))bloqueios.push('origem_menor_que_staging');
 const autorizado=opcoes.aplicar===true&&opcoes.dryRun!==true&&bloqueios.length===0&&permitirCorte(opcoes.gates);
 return {
  dryRun:!autorizado,escreve:autorizado,bloqueios,contagem:base.contagem,faltam:base.faltam,
  resumo:resumoPlano(decisoes),
  chaves:planos.map(plano=>plano.chave).filter(Boolean),
  decisoes:decisoes.map(item=>autorizado?item:{...item,registro:null,escreve:false})
 };
}
export async function gravarStaging(db,loteId,reconciliacao){
 if(!reconciliacao?.escreve)return {gravados:0,ignorado:true};
 let gravados=0;
 for(const item of reconciliacao.decisoes){
  if(!item.escreve)continue;
  if(SEGREDO.test(JSON.stringify(item.registro||{})))throw new Error('Registro recusado.');
  await db.query('select migracao_frete.registrar_item($1,$2,$3,$4,$5,$6,$7,$8) as acao',[
   loteId,item.entidade,item.chave,item.apto===true,item.camposPendentes||[],item.atualizadoEm||null,item.hash||null,item.registro||null
  ]);
  gravados++;
 }
 return {gravados,ignorado:false};
}
