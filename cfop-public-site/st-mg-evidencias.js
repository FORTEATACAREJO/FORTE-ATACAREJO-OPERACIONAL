/* FORTECOMPANNY+ IA — evidências oficiais do RICMS/MG, Anexo VII (2026-11-15).
 * Apenas ALCANCE de ST (interna/protocolos): não determina automaticamente incidência,
 * sujeito passivo, CFOP, valor, dispensa ou vigência para operação particular.
 * Documentação: https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms_2023_seco/anexovii2023_4.html
 * Responsabilidade: https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms_2023_seco/anexovii2023_2.html
 */
(function(root){
 'use strict';
 const ufs='AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
 const agreements=Object.freeze({
  cimento:'AC AL AP BA CE DF ES GO MA MT MS PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '),
  argamassa:'AP BA ES PA PR RJ RS SP'.split(' ')
 });
 const chapters=Object.freeze({
  cimento:{cest:'0500100',ncmPrefixes:['2523'],mvaReferenciaPercentual:20,chapter:'5',item:'1.0',label:'Cimento',agreement:'Protocolo ICM 11/85'},
  argamassa:{cest:'1000200',ncmPrefixes:['3816001','38245000'],mvaReferenciaPercentual:40,chapter:'10',item:'2.0',label:'Argamassas',agreement:'Protocolos ICMS indicados no capítulo 10.1'},
  outras_argamassas:{cest:'1000300',ncmPrefixes:['32149000'],mvaReferenciaPercentual:40,chapter:'10',item:'3.0',label:'Outras argamassas',agreement:'Protocolos ICMS indicados no capítulo 10.1'}
 });
 const urlTable='https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms_2023_seco/anexovii2023_4.html';
 const urlResp='https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/ricms_2023_seco/anexovii2023_2.html';
 const digits=v=>String(v||'').replace(/\D/g,'');
 function evaluate({from,to,ncm,cest}={}){
  from=String(from||'').toUpperCase();to=String(to||'').toUpperCase();
  ncm=digits(ncm);cest=digits(cest);
  if(!ufs.includes(from)||!ufs.includes(to))return {status:'entrada_invalida',basis:'UF desconhecida',rule:null};
  if(to!=='MG')return {status:'destino_nao_coberto',basis:'Base documental específica de MG; não inferir regras da UF de destino.',rule:null};
  const r=Object.values(chapters).find(x=>x.cest===cest&&x.ncmPrefixes.some(prefix=>ncm.startsWith(prefix)));
  if(!r)return {status:'produto_nao_coberto',basis:'CEST e NCM não correspondem aos grupos documentados; conferir XML/ficha técnica.',rule:null};
  const group=r.cest==='0500100'?'cimento':'argamassa';
  const internal=from==='MG';
  const interstate=agreements[group].includes(from);
  const status=internal?'st_ambito_interno':interstate?'st_ambito_interestadual_por_acordo':'sem_acordo_interestadual_listado';
  return {
   status,
   product:r.label,from,to,
   legalScope:internal?'Âmbito interno de MG':interstate?'Protocolo/convenção interestadual indicado no Anexo VII':
    'UF de origem não incluída no âmbito interestadual deste grupo; possível responsabilidade do destinatário mineiro pelo art. 15.',
   base:{cest:r.cest,ncm,chapter:r.chapter,item:r.item,agreement:r.agreement,
     mvaTabelaReferenciaPercentual:r.mvaReferenciaPercentual,
     mvaNaoHomologadaParaCalculo:true},
   sources:[{title:'RICMS/MG 2023 Anexo VII Parte 2, capítulo '+r.chapter+', item '+r.item,url:urlTable},
    {title:'RICMS/MG 2023 Anexo VII Parte 1, arts. 13–16',url:urlResp}],
   reminders:[
    'Confirmar classificação do produto por XML/ficha técnica e vigência da norma para a operação.',
    'Confirmar IE e finalidade; protocolaridade não é prova de retenção ou recolhimento efetivos.',
    'Verificar responsabilidade do remetente/destinatário, regime especial, exceções, cálculo, prazo e guia.',
    'ST recolhida anteriormente em outra UF não comprova recolhimento devido a MG.'
   ],
   validation:'evidencia_legal_para_revisao_nao_homologada'
  };
 }
 root.FORTE_ST_MG_EVIDENCIAS=Object.freeze({evaluate,ufs:Object.freeze(ufs),versao:'2026-11-15',source:urlTable});
})(window);