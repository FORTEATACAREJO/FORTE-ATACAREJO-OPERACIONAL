(function(root){
 'use strict';
 const UFS=Object.freeze('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ').sort());
 const TOPICS=Object.freeze(['ICMS_GERAL','ICMS_ALIQUOTAS','ICMS_ST_CEST','ICMS_ANTECIPACAO','DIFAL','FCP','BENEFICIOS_FISCAIS','REGIMES_ESPECIAIS','CFOP_CST_CSOSN','NCM_CLASSIFICACAO','IPI','PIS_COFINS','IBS_CBS']);
 const date=v=>{const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;};
 const official=url=>{const m=/^https:\/\/([^\/@?#:]+)(?::443)?(?:\/|[?#]|$)/i.exec(String(url||'').trim());return !!m&&['gov.br','leg.br'].some(d=>m[1].toLowerCase()===d||m[1].toLowerCase().endsWith('.'+d));};
 function analyzeAct(a){
  const issues=[],check=(v,m)=>{if(!v)issues.push(m)};
  if(!a||typeof a!=='object')return {status:'nao_revisado',issues:['Ato inexistente'],xmlRequired:false,canIssue:false};
  const uf=String(a.uf||'').toUpperCase();
  check(uf==='BR'||UFS.includes(uf),'UF ou abrangência nacional não informada');
  check(TOPICS.includes(a.tema),'Matéria tributária não classificada');
  check(official(a.fonte_url),'Fonte normativa oficial HTTPS não conferida');
  check(!!String(a.ato_normativo||'').trim(),'Número e espécie do ato não identificados');
  check(!!String(a.dispositivo||'').trim(),'Dispositivo legal, artigo ou tabela não identificado');
  check(date(a.publicado_em),'Data de publicação não confirmada');
  check(date(a.inicio_vigencia),'Início de vigência não confirmado');
  if(a.fim_vigencia)check(date(a.fim_vigencia),'Fim de vigência inválido');
  if(date(a.inicio_vigencia)&&date(a.publicado_em)&&a.inicio_vigencia<a.publicado_em)
   issues.push('Data anterior à publicação exige fundamentar eventual efeito retroativo');
  check(a.alteracoes_conferidas===true,'Alterações e revogações ainda não conferidas');
  check(a.excecoes_conferidas===true,'Exceções e condições ainda não conferidas');
  check(a.texto_integral_conferido===true,'Texto integral da norma não conferido');
  check(a.aprovacao==='aprovada'&&!!String(a.revisor||'').trim()&&date(a.revisado_em),'Revisão jurídica documentada ainda não aprovada');
  return {status:issues.length===0?'ato_documentalmente_revisado':'nao_revisado',legallyDocumented:issues.length===0,
   issues,taxRuleApproved:false,xmlRequired:false,canIssue:false};
 }
 function coverage(states=[],acts=[]){
  const registered=new Set(states.map(x=>String(x.uf||'').toUpperCase()).filter(x=>UFS.includes(x))),byUF={};
  for(const uf of UFS){
   const list=acts.filter(x=>x.uf===uf);
   byUF[uf]={portalIndexed:registered.has(uf),actsRegistered:list.length,
    actsDocumentallyReviewed:list.filter(x=>analyzeAct(x).legallyDocumented).length,
    fiscalRulesHomologated:0};
  }
  return {federativeUnitsRegistered:registered.size,federativeUnitsExpected:27,topics:TOPICS.length,
   subjects:TOPICS,byUF,xmlRequired:false,ruleApprovalRequiresScenario:true};
 }
 root.FORTE_BASE_NORMATIVA=Object.freeze({UFS,TOPICS,analyzeAct,coverage,officialSource:official});
})(window);