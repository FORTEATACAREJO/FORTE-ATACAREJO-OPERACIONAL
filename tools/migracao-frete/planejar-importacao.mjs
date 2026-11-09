import {createHash} from 'node:crypto';
import {analisarMotoristaLegado} from './normalizar-legado.mjs';

const CREDENCIAIS=['senha','password','token','access_token','refresh_token','secret','service_role'];
export function chaveEstavel(entidade,id){
 const valor=String(id||'').trim();
 if(!/^[0-9a-f-]{8,}$/i.test(valor))return null;
 return `FORTE_FRETE:${entidade}:${valor}`;
}
export function hashConteudo(registro){
 return createHash('sha256').update(JSON.stringify(registro)).digest('hex');
}
export function decidirAcao(destino,entrada){
 if(!entrada?.chave)return 'bloquear';
 if(!destino)return entrada.apto?'inserir':'revisar';
 if(destino.hash===entrada.hash)return 'preservar';
 const destinoEm=destino.atualizadoEm?Date.parse(destino.atualizadoEm):NaN;
 const origemEm=entrada.atualizadoEm?Date.parse(entrada.atualizadoEm):NaN;
 if(!Number.isFinite(origemEm)||(Number.isFinite(destinoEm)&&origemEm<destinoEm))return 'conflito';
 if(destino.apto&&!entrada.apto)return 'conflito';
 return entrada.apto?'atualizar':'revisar';
}
function semCredencial(origem){
 const copiado={...origem};
 const removidos=[];
 for(const campo of CREDENCIAIS)if(campo in copiado){delete copiado[campo];removidos.push(campo);}
 if('arquivo' in copiado||'conteudo_base64' in copiado){delete copiado.arquivo;delete copiado.conteudo_base64;removidos.push('anexo_binario');}
 return {copiado,removidos};
}
function item(entidade,id,apto,camposPendentes,registro,atualizadoEm){
 const chave=chaveEstavel(entidade,id);
 const conteudo=registro?hashConteudo(registro):null;
 return {entidade,chave,apto,camposPendentes,atualizadoEm:atualizadoEm||null,hash:conteudo,registro:apto||chave?registro:null};
}
export function planejarMotorista(motorista,veiculo,empresaId){
 const analise=analisarMotoristaLegado(motorista,veiculo,empresaId);
 const atualizadoEm=motorista?.atualizado_em||null;
 if(!analise.apto)return item('motorista',motorista?.id,false,analise.camposPendentes,null,atualizadoEm);
 return item('motorista',motorista.id,true,[],{...analise.registro,origem_sistema:'FORTE_FRETE',chave:chaveEstavel('motorista',motorista.id),ativo:false},atualizadoEm);
}
export function planejarVeiculo(veiculo){
 const id=veiculo?.id;
 const placa=String(veiculo?.placa||'').trim().toUpperCase();
 const peso=Number(veiculo?.capacidade_efetiva_t??veiculo?.capacidade_t);
 const pendentes=[];
 if(!chaveEstavel('veiculo',id))pendentes.push('id_legado');
 if(!veiculo?.motorista_id)pendentes.push('motorista_id');
 if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa))pendentes.push('placa');
 if(!Number.isFinite(peso)||peso<=0)pendentes.push('capacidade_t');
 if(pendentes.length)return item('veiculo',id,false,pendentes,null,veiculo?.atualizado_em);
 return item('veiculo',id,true,[],{
  origem_sistema:'FORTE_FRETE',chave:chaveEstavel('veiculo',id),motorista_chave:chaveEstavel('motorista',veiculo.motorista_id),
  placa,capacidade_operacional_kg:Math.round(peso*1000),ativo:false
 },veiculo.atualizado_em);
}
export function planejarRota(rota){
 const origem=String(rota?.origem||'').trim();
 const destino=String(rota?.destino||'').trim();
 const pendentes=[];
 if(!chaveEstavel('rota',rota?.id))pendentes.push('id_legado');
 if(!origem)pendentes.push('origem');
 if(!destino)pendentes.push('destino');
 if(pendentes.length)return item('rota',rota?.id,false,pendentes,null,rota?.atualizado_em);
 return item('rota',rota.id,true,[],{origem_sistema:'FORTE_FRETE',chave:chaveEstavel('rota',rota.id),origem,destino,ativo:false},rota.atualizado_em);
}
export function planejarDocumento(documento){
 const {copiado,removidos}=semCredencial(documento||{});
 const pendentes=[];
 if(removidos.some(campo=>campo!=='anexo_binario'))pendentes.push('credencial_nao_copiada');
 if(!chaveEstavel('documento',copiado.id))pendentes.push('id_legado');
 if(!copiado.motorista_id)pendentes.push('motorista_id');
 if(!copiado.tipo)pendentes.push('tipo');
 if(!copiado.storage_bucket||!copiado.storage_path)pendentes.push('storage_referencia');
 const apto=pendentes.length===0;
 return item('documento',copiado.id,apto,pendentes,apto?{
  origem_sistema:'FORTE_FRETE',chave:chaveEstavel('documento',copiado.id),motorista_chave:chaveEstavel('motorista',copiado.motorista_id),
  tipo:String(copiado.tipo),storage_bucket:String(copiado.storage_bucket),storage_path:String(copiado.storage_path),ativo:false
 }:null,copiado.atualizado_em);
}
export function planejarUsuario(usuario){
 const {copiado,removidos}=semCredencial(usuario||{});
 const pendentes=removidos.map(()=>'credencial_nao_copiada');
 if(!chaveEstavel('usuario',copiado.id))pendentes.push('id_legado');
 if(!copiado.perfil)pendentes.push('perfil');
 const apto=pendentes.length===0;
 return item('usuario',copiado.id,apto,pendentes,apto?{
  origem_sistema:'FORTE_FRETE',chave:chaveEstavel('usuario',copiado.id),perfil:String(copiado.perfil),
  status_aprovacao:copiado.status_aprovacao||'PENDENTE',ativo:false
 }:null,copiado.atualizado_em);
}
export function aplicarDecisao(destino,entrada){
 const acao=decidirAcao(destino,entrada);
 const escreve=acao==='inserir'||acao==='atualizar'||acao==='revisar';
 return {acao,escreve,registro:escreve?entrada.registro:null,chave:entrada.chave,apto:entrada.apto,camposPendentes:entrada.camposPendentes};
}
export function resumoPlano(decisoes){
 const contagem={};
 for(const item of decisoes)contagem[item.acao]=(contagem[item.acao]||0)+1;
 return {total:decisoes.length,contagem};
}
