/* FORTECOMPANNY — auditoria de fundamento legal, sem dependência de XML.
 * Usar somente como GATE de qualidade documental. Não substitui a revisão
 * jurídica de normas, sua vigência ou a classificação física da mercadoria.
 */
(function(root){
 'use strict';
 const ufs=new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
 const clean=x=>String(x??'').trim();
 const isDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(clean(x))&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
 const official=url=>{
  const match=/^https:\/\/([^\/@?#:]+)(?::443)?(?:\/|[?#]|$)/i.exec(clean(url));
  if(!match)return false;
  const h=match[1].toLowerCase();
  return h.endsWith('.gov.br')||h==='gov.br'||h.endsWith('.leg.br')||h==='leg.br';
 };
 function reviewRule(rule={},op={}){
  const problems=[];
  const add=x=>{if(!problems.includes(x))problems.push(x)};
  const normalize=x=>clean(x).toUpperCase();
  const details=rule?.regra_json&&typeof rule.regra_json==='object'?rule.regra_json:{};
  const review=rule?.revisao_legal||details.revisao_legal||{};
  const start=rule.inicio_vigencia||rule.vigencia_inicio||details.inicio_vigencia||details.vigencia_inicio;
  const end=rule.fim_vigencia||rule.vigencia_fim||details.fim_vigencia||details.vigencia_fim;
  const date=clean(op.date);
  if(!rule||typeof rule!=='object')return {ready:false,problems:['Regra jurídica ausente'],basisType:'legislacao',xmlRequired:false};
  if(clean(rule.situacao)!=='homologada'||!rule.homologado_em)add('Regra ainda não marcada como homologada após revisão jurídica.');
  if(!official(rule.fonte_url))add('Fonte normativa oficial HTTPS não demonstrada.');
  if(!clean(rule.ato_normativo)||!clean(rule.artigo))add('Ato, dispositivo e fundamento legal específico não identificados.');
  if(!isDate(start))add('Início de vigência do ato normativo não informado.');
  if(end&&!isDate(end))add('Fim de vigência inválido.');
  if(!isDate(date))add('Data da operação não foi identificada para testar vigência.');
  if(isDate(start)&&isDate(date)&&date<start)add('Operação anterior à vigência do ato.');
  if(isDate(end)&&isDate(date)&&date>end)add('Operação posterior ao fim de vigência do ato.');
  if(!ufs.has(normalize(rule.uf_origem))||!ufs.has(normalize(rule.uf_destino)))add('Origens/destinos da norma sem escopo de UF.');
  if(normalize(rule.uf_origem)!==normalize(op.fromUF)||normalize(rule.uf_destino)!==normalize(op.toUF))
   add('A norma não corresponde à rota de origem e destino analisada.');
  if(!clean(rule.natureza)||clean(rule.natureza)!==clean(op.natureza))add('Natureza de operação não comprovada na norma.');
  if(!clean(rule.finalidade)||clean(rule.finalidade)!==clean(op.finalidade))add('Finalidade tributária não comprovada na norma.');
  // Identificar NCM de um produto real requer características e regras NCM;
  // um código transcrito de uma nota fiscal não confirma enquadramento.
  const ncm=clean(op.ncm).replace(/\D/g,''),cest=clean(op.cest).replace(/\D/g,'');
  if(!/^\d{8}$/.test(ncm))add('Classificação de mercadoria com NCM completo ainda não identificada.');
  if(rule.ncm&&clean(rule.ncm).replace(/\D/g,'')!==ncm)add('O NCM analisado não corresponde à regra.');
  if(rule.cest&&clean(rule.cest).replace(/\D/g,'')!==cest)add('O CEST legal não corresponde à regra (se aplicável).');
  if(review?.produto_enquadrado!==true)add('Enquadramento técnico do produto na norma ainda não revisado.');
  if(review?.excecoes_analisadas!==true)add('Exceções, benefícios e hipóteses especiais ainda não revisados.');
  if(review?.aprovada!==true||!clean(rule.aprovado_por||review?.revisor)||!isDate(review?.data||clean(rule.homologado_em).slice(0,10)))
   add('Revisão jurídica documentada e aprovada ainda não registrada.');
  if(op.specialRegime==='sim'&&review?.ato_especial_verificado!==true)
   add('Regime especial declarado e seu ato concessivo não foram verificados.');
  return Object.freeze({
   ready:problems.length===0,
   problems,
   basisType:'legislacao',
   xmlRequired:false,
   status:problems.length===0?'evidencia_legal_revisada':'pendente_de_fundamentacao_legal',
   // Não autorizar emissão de NF-e por qualquer resultado desse gate.
   canIssue:false
  });
 }
 function assess(stateData={},op={}){
  const rules=Array.isArray(stateData?.verifiedRules)?stateData.verifiedRules:[];
  const assessments=rules.map(rule=>reviewRule(rule,op));
  const valid=assessments.filter(x=>x.ready);
  return Object.freeze({
   ruleCount:rules.length,legalReviewedCount:valid.length,
   hasApplicableReviewedRule:valid.length>0,
   xmlRequired:false,
   problems:valid.length?[]:(assessments[0]?.problems||['Nenhuma regra revisada com fundamento legal aplicável foi encontrada nesta operação.']),
   canIssue:false
  });
 }
 root.FORTE_FUNDAMENTO_LEGAL=Object.freeze({reviewRule,assess,officialSource:official});
})(window);