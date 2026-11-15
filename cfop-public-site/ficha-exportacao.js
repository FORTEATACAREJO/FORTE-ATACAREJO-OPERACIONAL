/* FORTECOMPANNY — ficha de orientação fiscal v1 (exportação local).
 * Não emite NF-e, não envia dados ao servidor, não declara a operação homologada.
 * Os documentos e nomes das partes ficam fora do JSON por padrão.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let current=null;
 const clean=(v,max=300)=>String(v??'').trim().slice(0,max);
 const redact=v=>clean(v,300).replace(/\b(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}|\d{14})\b/g,'[documento omitido]');
 const safeISO=()=>new Date().toISOString();
 const digits=v=>String(v||'').replace(/\D/g,'');
 const allowUF=v=>/^(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/.test(String(v||''))?v:null;
 function asUrl(url){
  try{
   const u=new URL(String(url||''));
   return u.protocol==='https:'&&u.username===''&&u.password===''?u.href:null;
  }catch(_){return null}
 }
 function distinct(arr){return [...new Set(arr)]}
 function taxStatus(company){
  const reg=Array.isArray(company?.registrations)?company.registrations:[];
  return reg.some(x=>x&&x.ie&&x.active===true)?'IE ativa retornada em consulta':'IE não confirmada';
 }
 function snapshot(args){
  if(!args||!args.input||!args.fiscal||!args.audit)throw Error('Consulta incompleta');
  const {input,from={},to={},info={},fiscal={},audit={},rules=null}=args;
  if(audit.canIssue!==false||audit.stage!=='nao_homologado')throw Error('Situação fiscal inesperada: exportação interrompida');
  return {input,from,to,info,fiscal,audit,rules};
 }
 function makeFile(includeIdentifiers){
  if(!current)throw Error('Execute a consulta fiscal antes de gerar a ficha.');
  const {input,from,to,info,fiscal,audit,rules}=current;
  const item={
   description:redact(input.product).slice(0,90)||null,
   ncm: /^\d{8}$/.test(digits(info.code))?digits(info.code):null,
   ncm_status:Number(info.official?.entry?.nivel)===8?'codigo_encontrado_classificacao_a_confirmar':'nao_confirmado',
   cest: /^\d{7}$/.test(digits(info.suggest?.cest))?digits(info.suggest.cest):null,
   cest_status:'sugestao_documental_nao_comprova_st'
  };
  const party=(x)=>({
   uf:allowUF(x?.uf),
   contribuinte_icms:taxStatus(x),
   ...(includeIdentifiers?{cnpj_ou_cpf:clean(x?.cnpj,22)||null,razao_social:clean(x?.name,160)||null}: {})
  });
  const links=(Array.isArray(fiscal.sources)?fiscal.sources:[]).slice(0,25)
   .map(x=>({fonte:clean(x?.label,120),url:asUrl(x?.url)})).filter(x=>x.fonte&&x.url);
  const pending=distinct([
   ...(Array.isArray(audit.issues)?audit.issues.map(x=>clean(x?.text,400)):[]),
   ...(Array.isArray(fiscal.pending)?fiscal.pending.map(x=>clean(x,400)):[])
  ].filter(Boolean)).slice(0,45);
  const file={
   formato:'FORTECOMPANNY_ORIENTACAO_FISCAL',
   schema_version:'1.0.0',
   generated_at:safeISO(),
   objetivo:'orientar_parametrizacao_de_nfe',
   tipo:'consulta_orientativa_nao_homologada',
   nfe:{emitida:false,assinada:false,transmitida:false,autorizada:false},
   parametros_nao_automaticamente_aplicaveis:true,
   validacao:{status:'pendente',can_use_for_automatic_issuing:false,requires_manual_review:true,
    avisos:pending,regra_estadual_homologada_para_consulta:Number(rules?.verifiedRuleCount||0)},
   operacao:{
    perfil:clean(input.profile,45)||null,
    natureza:clean(input.nature,65)||null,
    origem_mercadoria:clean(input.goodsOrigin,35)||null,
    st_anterior_declarada:clean(input.priorSt,30)||'unknown',
    condicao_destinatario_declarada:clean(input.buyerTaxStatus,30)||'unknown',
    remetente:party(from),destinatario:party(to)
   },
   produtos:[item],
   fiscal_orientativo:{
    cfop_sugerido:clean(fiscal.cfop,120)||null,
    cfop_natureza:clean(fiscal.confidence,140)||'não confirmado',
    icms_st:clean(fiscal.st,750)||null,
    difal:clean(fiscal.difal,750)||null,
    aviso_custo_destino:clean(fiscal.costWarning,650)||null,
    valores_calculados:false,
    cst_csosn:'não determinado',
    pis_cofins:'não determinado',
    ipi:'não determinado',
    ibs_cbs:'não determinado',
    fundamento_fontes:links
   },
   avisos:['Esta ficha não substitui a legislação ou um responsável fiscal.','Não usar como autorização de NF-e nem transmitir automaticamente a emissores.']
  };
  return file;
 }
 function renderPreview(){
  try{
   const withDocs=$('exportPersonalData').checked;
   const file=makeFile(withDocs);
   const str=JSON.stringify(file,null,2);
   $('exportJsonPreview').value=str;
   $('exportJsonPreview').hidden=false;
   $('exportCopy').disabled=false;
   $('exportDownload').disabled=false;
   $('exportStatus').textContent=withDocs?
    'Ficha local pronta com os identificadores de origem/destino. Confira antes de compartilhar. Nenhum dado foi enviado.':
    'Ficha local pronta sem CPF/CNPJ nem nomes das empresas. Ainda não é parametrização homologada.';
  }catch(e){
   $('exportStatus').textContent='Não foi possível gerar a ficha: '+clean(e?.message,160);
  }
 }
 function clearPreview(message){
  $('exportJsonPreview').value='';
  $('exportJsonPreview').hidden=true;
  $('exportCopy').disabled=true;
  $('exportDownload').disabled=true;
  $('exportStatus').textContent=message||'Gere a ficha somente após concluir uma consulta.';
 }
 async function copyPreview(){
  const content=$('exportJsonPreview').value;
  if(!content)return;
  try{
   if(!navigator.clipboard?.writeText)throw Error('unavailable');
   await navigator.clipboard.writeText(content);
   $('exportStatus').textContent='Ficha copiada. O conteúdo continua apenas no seu aparelho até você decidir compartilhá-lo.';
  }catch(_){
   $('exportJsonPreview').hidden=false;
   $('exportJsonPreview').focus();
   $('exportJsonPreview').select();
   $('exportStatus').textContent='Selecione e copie o texto exibido. Nenhum dado foi enviado automaticamente.';
  }
 }
 function downloadPreview(){
  const data=$('exportJsonPreview').value;
  if(!data)return;
  const blob=new Blob([data],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;
  anchor.download='FORTECOMPANNY_ficha_orientativa_'+new Date().toISOString().slice(0,10)+'.json';
  try{
   document.body.appendChild(anchor);
   anchor.click();
   $('exportStatus').textContent='Download local solicitado. O arquivo é apenas orientação fiscal, não uma NF-e.';
  }finally{
   anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
 }
 $('exportGenerate').addEventListener('click',renderPreview);
 $('exportCopy').addEventListener('click',copyPreview);
 $('exportDownload').addEventListener('click',downloadPreview);
 $('exportPersonalData').addEventListener('change',()=>clearPreview('A opção de identificação foi alterada; gere a ficha novamente.'));
 clearPreview('Após consultar, gere uma ficha orientativa para conferência manual ou futura integração com ERP.');
 window.FORTE_FICHA_EXPORTACAO=Object.freeze({
  setSnapshot(args){
   current=snapshot(args);
   $('exportDetails').hidden=false;
   clearPreview('Consulta concluída. Gere a ficha quando desejar; nenhuma informação será enviada automaticamente.');
  },
  clearSnapshot(){
   current=null;
   $('exportDetails').hidden=true;
   $('exportPersonalData').checked=false;
   clearPreview('É necessário concluir nova consulta antes de exportar.');
  }
 });
})();