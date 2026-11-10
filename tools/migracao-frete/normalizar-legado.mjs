// Funcoes puras de pre-validacao de dados do Frete antigo. Nao acessam producao.
export const somenteDigitos=value=>String(value??'').replace(/\D/g,'');
export function analisarMotoristaLegado(motorista,veiculo,empresaId){
  const m=motorista||{},v=veiculo||{};
  const nome=String(m.nome||'').trim();
  const cpf=somenteDigitos(m.cpf);
  const whatsapp=somenteDigitos(m.telefone);
  const cnh=String(m.cnh_registro||'').trim();
  const proprietario=String(m.proprietario_nome||v.proprietario_nome||'').trim();
  const chavePix=String(m.chave_pix||'').trim();
  const favorecido=String(m.titular_pix||'').trim();
  const peso=Number(v.capacidade_efetiva_t??v.capacidade_t);
  const camposPendentes=[];
  if(!empresaId)camposPendentes.push('empresa_id');
  if(!nome)camposPendentes.push('nome');
  if(cpf.length!==11)camposPendentes.push('cpf_valido');
  if(whatsapp.length<10||whatsapp.length>13)camposPendentes.push('telefone_valido');
  if(!cnh)camposPendentes.push('cnh');
  if(!proprietario)camposPendentes.push('proprietario_nome');
  if(!chavePix)camposPendentes.push('chave_pix');
  if(!favorecido)camposPendentes.push('favorecido_pix');
  if(!Number.isFinite(peso)||peso<=0)camposPendentes.push('capacidade_t');
  if(!m.id)camposPendentes.push('id_legado');
  if(camposPendentes.length)return {apto:false,camposPendentes,origemId:m.id||null,registro:null};
  return {apto:true,camposPendentes:[],origemId:m.id,registro:{
    empresa_id:empresaId,nome,cpf,whatsapp,cnh,
    categoria_cnh:m.categoria_cnh||null,validade_cnh:m.validade_cnh||null,
    rntrc:m.rntrc||null,proprietario_nome:proprietario,
    proprietario_documento:m.proprietario_cpf_cnpj||null,
    chave_pix:chavePix,favorecido_pix:favorecido,
    capacidade_operacional_kg:Math.round(peso*1000),
    // Importacao nunca concede aprovacao ou atividade; exigir revisao humana.
    ativo:false
  }};
}
export function resumoAnalise(resultados){
 const motivos={};let aptos=0;
 for(const r of resultados){if(r.apto)aptos++;else for(const campo of new Set(r.camposPendentes))motivos[campo]=(motivos[campo]||0)+1;}
 return {total:resultados.length,aptos,pendentes:resultados.length-aptos,motivos};
}
export function permitirCorte({backupFonteValidado,backupDestinoValidado,restauracaoTestada,conciliacaoValidada,aprovacaoHumana}={}){
 return [backupFonteValidado,backupDestinoValidado,restauracaoTestada,conciliacaoValidada,aprovacaoHumana].every(v=>v===true);
}
