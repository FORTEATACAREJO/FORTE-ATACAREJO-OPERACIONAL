// Adaptador puro da captura frete_migracao.snapshots.
// Não abre rede, não copia senha, token nem arquivo e não apaga o legado.

export const ORIGEM_REF='nkynfboqwfxhhxcsrawl';
export const ALVO_REF='gtwecfyffjszghnvtlzr';
export const FISCAL_REF='xmfpvvmvdkepmnvtdoio';
export const STATUS_CAPTURA='copia_preservada_nao_ativada';
export const EXCECAO_CHECKSUM=Object.freeze(['public.veiculos_motorista']);
export const CENSO_CAPTURA=Object.freeze({
 'public.access_audit':23,
 'public.access_invites':12,
 'public.access_notifications':9,
 'public.access_recovery_requests':0,
 'public.cargas':0,
 'public.access_requests':3,
 'public.chaves_pix_frete':1,
 'public.configuracoes':1,
 'public.convites_motorista':1,
 'public.documentos_motorista':1,
 'public.documentos_veiculo':5,
 'public.driver_onboarding':1,
 'public.favorecidos_frete':1,
 'public.forte_legal_acceptance_events':2,
 'public.forte_legal_term_versions':1,
 'public.forte_notice_reads':0,
 'public.forte_push_subscriptions':1,
 'public.frete_alertas':0,
 'public.frete_atendimento':0,
 'public.frete_ofertas_auditoria':0,
 'public.frete_tarifas':0,
 'public.historico_motoristas_veiculo':0,
 'public.integracao_forte_vendas':0,
 'public.interesses_carga':0,
 'public.motorista_rotas':0,
 'public.motorista_veiculo_vinculos':2,
 'public.motoristas':23,
 'public.notificacoes_whatsapp':0,
 'public.ordens_carregamento':0,
 'public.password_recovery_limits':52,
 'public.registration_dossiers':1,
 'public.rotas':5,
 'public.usuarios_app':4,
 'public.vehicle_link_requests':0,
 'public.vehicle_registration_drafts':0,
 'public.veiculos_motorista':2,
 'public.vendas_ordens':0,
 'public.viagens':0
});
export const BUCKETS_PRIVADOS=Object.freeze([
 {id:'forte-frete-cadastros',objetos:0},
 {id:'motorista-documentos',objetos:6},
 {id:'vendas-ordens-frete',objetos:0}
]);
export const FUNCOES_LEGADO=Object.freeze([
 {slug:'first-access',verifyJwt:false,noOperacional:true},
 {slug:'login-cpf',verifyJwt:false,noOperacional:true},
 {slug:'aceitar-carga',verifyJwt:true,noOperacional:false},
 {slug:'motorista-viagem',verifyJwt:true,noOperacional:false},
 {slug:'recover-password-email',verifyJwt:false,noOperacional:true},
 {slug:'bootstrap-master-once',verifyJwt:true,noOperacional:false},
 {slug:'register-user',verifyJwt:false,noOperacional:false},
 {slug:'set-password',verifyJwt:true,noOperacional:false},
 {slug:'register-driver-invite',verifyJwt:false,noOperacional:false},
 {slug:'access-standard',verifyJwt:false,noOperacional:true},
 {slug:'forte-notifications',verifyJwt:false,noOperacional:true},
 {slug:'vendas-frete-bridge',verifyJwt:false,noOperacional:false},
 {slug:'driver-directory',verifyJwt:false,noOperacional:false},
 {slug:'driver-onboarding',verifyJwt:false,noOperacional:false},
 {slug:'access-invites',verifyJwt:false,noOperacional:true},
 {slug:'integration-vault',verifyJwt:false,noOperacional:true},
 {slug:'account-deletion-review',verifyJwt:true,noOperacional:false},
 {slug:'registration-dossier',verifyJwt:false,noOperacional:false},
 {slug:'vehicle-registry',verifyJwt:false,noOperacional:false}
]);

const CAMPOS_SEGREDO=['senha','password','encrypted_password','token','access_token','refresh_token','secret','service_role','arquivo','conteudo_base64','subscription','endpoint','last_signature','codigo','recovery_token'];
const CHAVES_NUMERICAS=new Set(['capacidade_t','capacidade_efetiva_t','cmt_t','pbt_t','eixos','capacidade_operacional_kg','capacidade_kg']);
const FALSO=/^(n[aã]o informado|nao informado|sem dado|sem cnh|sem pix|sem telefone|pendente|a definir|n\/a|xxx+)$/i;
const PLACA=/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST_LEGADO=/^https?:\/\/(?:[a-z0-9-]+\.)*forte-frete\.onrender\.com/i;

export const somenteDigitos=valor=>String(valor??'').replace(/\D/g,'');
export function falso(valor){
 if(valor==null)return true;
 const texto=String(valor).trim();
 if(!texto)return true;
 if(FALSO.test(texto))return true;
 const digitos=somenteDigitos(texto);
 if(digitos.length>=8&&/^(\d)\1+$/.test(digitos))return true;
 return false;
}
export function limpar(valor){return falso(valor)?'':String(valor).trim();}
export function uuidOk(valor){return UUID.test(String(valor||'').trim());}
export function chaveEstavel(entidade,id){
 const valor=String(id||'').trim();
 if(!/^[0-9a-f-]{8,}$/i.test(valor))return null;
 return `FORTE_FRETE:${entidade}:${valor}`;
}
const OMITIR_ANEXO=['dados_extraidos','dados_legados'];
export function semSegredo(valor){
 if(Array.isArray(valor))return valor.map(semSegredo);
 if(!valor||typeof valor!=='object')return valor;
 return Object.fromEntries(Object.entries(valor).filter(([chave])=>!CAMPOS_SEGREDO.includes(chave)&&!OMITIR_ANEXO.includes(chave)).map(([chave,item])=>[chave,semSegredo(item)]));
}
export function origemLimpa(valor){
 const limpo=semSegredo(valor);
 if(Array.isArray(limpo))return limpo.map(origemLimpa);
 if(!limpo||typeof limpo!=='object')return limpo;
 return Object.fromEntries(Object.entries(limpo).filter(([,item])=>item&&typeof item==='object'?true:!falso(item)).map(([chave,item])=>[chave,origemLimpa(item)]));
}
export function canonico(valor,chave=''){
 if(Array.isArray(valor))return valor.map(item=>canonico(item));
 if(valor&&typeof valor==='object')return Object.fromEntries(Object.keys(valor).sort().map(item=>[item,canonico(valor[item],item)]));
 if(typeof valor==='number')return Number.isFinite(valor)?(Object.is(valor,-0)?0:valor):null;
 if(typeof valor==='string'&&CHAVES_NUMERICAS.has(chave)){
  const numero=Number(valor.replace(',','.'));
  if(Number.isFinite(numero))return numero;
 }
 return valor;
}
export async function hashCanonico(valor){
 const dados=new TextEncoder().encode(JSON.stringify(canonico(valor)));
 const buf=await crypto.subtle.digest('SHA-256',dados);
 return [...new Uint8Array(buf)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function registros(snapshots,tabela){
 return (snapshots.find(item=>item.source_table===tabela)?.records)||[];
}
function toneladas(veiculo){
 if(!veiculo)return null;
 const bruta=veiculo.capacidade_efetiva_t??veiculo.capacidade_t;
 if(bruta==null||bruta==='')return null;
 const numero=typeof bruta==='number'?bruta:Number(String(bruta).replace(',','.'));
 if(!Number.isFinite(numero)||numero<=0)return null;
 return Math.round(numero*1000);
}
function cpfOk(valor){const digitos=somenteDigitos(valor);return digitos.length===11&&!/^(\d)\1+$/.test(digitos)&&!falso(valor);}
function foneOk(valor){const digitos=somenteDigitos(valor);return digitos.length>=10&&digitos.length<=13&&!/^(\d)\1+$/.test(digitos)&&!falso(valor);}

export function validarCenso(snapshots,opcoes={}){
 const bloqueios=[];
 const lista=Array.isArray(snapshots)?snapshots:[];
 if(opcoes.alvoRef===ORIGEM_REF)bloqueios.push('escrita_no_legado');
 if(opcoes.alvoRef===FISCAL_REF)bloqueios.push('fiscal_isolado');
 const tabelas=new Map();
 for(const item of lista){
  if(item?.source_project_ref&&item.source_project_ref!==ORIGEM_REF)bloqueios.push('origem_nao_e_frete');
  if(item?.source_project_ref===FISCAL_REF)bloqueios.push('fiscal_isolado');
  if(tabelas.has(item?.source_table))bloqueios.push('tabela_duplicada');
  tabelas.set(item?.source_table,item);
  if(!Array.isArray(item?.records))bloqueios.push('records_invalidos');
  else if(item.records.length!==item.source_count)bloqueios.push('contagem_interna');
  if(item?.status&&item.status!==STATUS_CAPTURA)bloqueios.push('status_nao_preservado');
  if(!item?.source_checksum||String(item.source_checksum).length!==32)bloqueios.push('checksum_ausente');
 }
 for(const tabela of Object.keys(CENSO_CAPTURA))if(!tabelas.has(tabela))bloqueios.push('tabela_ausente');
 for(const tabela of tabelas.keys())if(!(tabela in CENSO_CAPTURA))bloqueios.push('tabela_extra');
 for(const [tabela,esperado] of Object.entries(CENSO_CAPTURA))if(tabelas.get(tabela)&&tabelas.get(tabela).source_count!==esperado)bloqueios.push('contagem_censo');
 const registrosTotal=lista.reduce((soma,item)=>soma+(Number(item?.source_count)||0),0);
 if(lista.length===Object.keys(CENSO_CAPTURA).length&&registrosTotal!==151)bloqueios.push('total_registros');
 const divergente=[];
 if(typeof opcoes.checksumConfere==='function'){
  for(const item of lista){
   const confere=opcoes.checksumConfere(item)===true;
   if(confere)continue;
   if(EXCECAO_CHECKSUM.includes(item.source_table))divergente.push(item.source_table);
   else bloqueios.push('checksum_diverge');
  }
 }
 return {valido:bloqueios.length===0,bloqueios:[...new Set(bloqueios)],tabelas:lista.length,registros:registrosTotal,excecaoChecksumTextual:tabelas.has('public.veiculos_motorista')?[...EXCECAO_CHECKSUM]:[],divergente};
}

export function classificarMotorista(motorista={},contexto={}){
 const origem=origemLimpa(motorista);
 const nome=limpar(origem.nome);
 const cpf=cpfOk(origem.cpf)?somenteDigitos(origem.cpf):'';
 const telefone=foneOk(origem.telefone||origem.whatsapp)?somenteDigitos(origem.telefone||origem.whatsapp):'';
 const cnh=limpar(origem.cnh_registro||origem.cnh);
 const proprietario=limpar(origem.proprietario_nome)||limpar(contexto.proprietarioVeiculo);
 const chavePix=limpar(origem.chave_pix)||(contexto.pixAmbiguo?'':limpar(contexto.chavePixVinculo));
 const titular=limpar(origem.titular_pix)||(contexto.pixAmbiguo?'':limpar(contexto.titularVinculo));
 const capacidade=Number(contexto.capacidadeKg);
 const empresa=uuidOk(contexto.empresaId)?contexto.empresaId:'';
 const camposPendentes=[];
 if(!nome)camposPendentes.push('nome');
 if(!cpf)camposPendentes.push('cpf');
 if(!telefone)camposPendentes.push('telefone');
 if(!cnh)camposPendentes.push('cnh');
 if(!proprietario)camposPendentes.push('proprietario_nome');
 if(!chavePix)camposPendentes.push('chave_pix');
 if(!titular)camposPendentes.push('titular_pix');
 if(contexto.pixAmbiguo&&!limpar(origem.chave_pix))camposPendentes.push('pix_ambiguo');
 if(!Number.isFinite(capacidade)||capacidade<=0)camposPendentes.push('capacidade_operacional_kg');
 if(!empresa)camposPendentes.push('empresa_id');
 const chave=chaveEstavel('motorista',origem.id);
 if(!chave)camposPendentes.push('id_legado');
 const presente={};
 if(nome)presente.nome=nome;
 if(cpf)presente.cpf=cpf;
 if(telefone)presente.telefone=telefone;
 if(cnh)presente.cnh=cnh;
 if(limpar(origem.proprietario_nome))presente.proprietario_nome=limpar(origem.proprietario_nome);
 if(limpar(origem.chave_pix))presente.chave_pix=limpar(origem.chave_pix);
 if(limpar(origem.titular_pix))presente.titular_pix=limpar(origem.titular_pix);
 const base={apto:false,entidade:'motorista',chave,camposPendentes,nome,origem,contexto,presente};
 if(camposPendentes.length)return base;
 const registro={
  empresa_id:empresa,nome,cpf,whatsapp:telefone,cnh,proprietario_nome:proprietario,chave_pix:chavePix,favorecido_pix:titular,
  capacidade_operacional_kg:capacidade,ativo:false,origem_sistema:'FORTE_FRETE',chave,status_cadastro:'PENDENTE DE LIBERAÇÃO'
 };
 if(limpar(origem.categoria_cnh))registro.categoria_cnh=limpar(origem.categoria_cnh);
 if(limpar(origem.validade_cnh))registro.validade_cnh=limpar(origem.validade_cnh);
 if(limpar(origem.rntrc))registro.rntrc=limpar(origem.rntrc);
 if(limpar(origem.proprietario_cpf_cnpj))registro.proprietario_documento=limpar(origem.proprietario_cpf_cnpj);
 const registroPwa={
  id:origem.id,chave,nome,cpf,telefone,whatsapp:telefone,cnhNumero:cnh,proprietario:proprietario,chavePix,favorecidoPix:titular,
  placa1:limpar(contexto.placa).toUpperCase(),capacidadeMaximaKg:capacidade,ativo:false,statusCadastro:'PENDENTE DE LIBERAÇÃO',origemSistema:'FORTE_FRETE'
 };
 return {...base,apto:true,registro,registroPwa};
}
export function classificarVeiculo(veiculo={},contexto={}){
 const origem=origemLimpa(veiculo);
 const placa=limpar(origem.placa).toUpperCase();
 const tipo=limpar(origem.tipo);
 const empresa=uuidOk(contexto.empresaId)?contexto.empresaId:'';
 const camposPendentes=[];
 if(!PLACA.test(placa))camposPendentes.push('placa');
 if(!tipo)camposPendentes.push('tipo');
 if(!empresa)camposPendentes.push('empresa_id');
 const chave=chaveEstavel('veiculo',origem.id);
 if(!chave)camposPendentes.push('id_legado');
 if(!origem.motorista_id)camposPendentes.push('motorista_id');
 const capacidade=toneladas(origem);
 const base={apto:camposPendentes.length===0,entidade:'veiculo',chave,camposPendentes,nome:placa,origem,contexto,presente:{...(placa?{placa}:{}),...(tipo?{tipo}:{})}};
 if(camposPendentes.length)return base;
 return {...base,registro:{empresa_id:empresa,placa,tipo,capacidade_kg:capacidade,ativo:false,origem_sistema:'FORTE_FRETE',chave,motorista_chave:chaveEstavel('motorista',origem.motorista_id)}};
}
function classificarRota(rota){
 const origem=origemLimpa(rota);
 const saida=[limpar(origem.origem_cidade),limpar(origem.origem_uf)].filter(Boolean).join('/');
 const destinos=Array.isArray(origem.destinos)?origem.destinos.map(limpar).filter(Boolean):limpar(origem.destinos)?[limpar(origem.destinos)]:[];
 const camposPendentes=[];
 if(!saida)camposPendentes.push('origem');
 if(!destinos.length)camposPendentes.push('destino');
 const chave=chaveEstavel('rota',origem.id);
 if(!chave)camposPendentes.push('id_legado');
 if(camposPendentes.length)return {apto:false,entidade:'rota',chave,camposPendentes,nome:limpar(origem.nome),origem,presente:{}};
 return {apto:true,entidade:'rota',chave,camposPendentes,nome:limpar(origem.nome),origem,registro:{chave,origem:saida,destino:destinos.join(', '),ativo:false,origem_sistema:'FORTE_FRETE'}};
}
function classificarDocumento(documento,entidade){
 const origem=origemLimpa(documento);
 const caminho=limpar(origem.arquivo_path);
 const camposPendentes=[];
 if(!caminho||caminho.includes('..')||/^https?:/i.test(caminho))camposPendentes.push('storage_referencia');
 if(!limpar(origem.tipo))camposPendentes.push('tipo');
 const chave=chaveEstavel(entidade,origem.id);
 if(!chave)camposPendentes.push('id_legado');
 if(camposPendentes.length)return {apto:false,entidade,chave,camposPendentes,origem,presente:{}};
 return {apto:true,entidade,chave,camposPendentes,origem,registro:{chave,tipo:limpar(origem.tipo),arquivo_path:caminho,publico:false,ativo:false,bytes:null}};
}
function contextoMotorista(motorista,veiculos,chaves,favorecidos,empresaId){
 const ligados=veiculos.filter(item=>item.motorista_id===motorista.id);
 const veiculo=ligados.find(item=>item.conjunto_principal)||ligados[0];
 let chavePixVinculo='';
 let titularVinculo='';
 let pixAmbiguo=false;
 if(veiculo?.favorecido_id){
  const lista=chaves.filter(item=>item.favorecido_id===veiculo.favorecido_id&&limpar(item.chave));
  const nomes=favorecidos.filter(item=>item.id===veiculo.favorecido_id&&limpar(item.nome));
  if(lista.length===1&&nomes.length===1){chavePixVinculo=limpar(lista[0].chave);titularVinculo=limpar(nomes[0].nome);}
  else if(lista.length>1||nomes.length>1)pixAmbiguo=true;
 }
 return {empresaId,capacidadeKg:toneladas(veiculo),proprietarioVeiculo:limpar(veiculo?.proprietario_nome),placa:limpar(veiculo?.placa),chavePixVinculo,titularVinculo,pixAmbiguo};
}

export async function adaptarSnapshots(snapshots,opcoes={}){
 const censo=validarCenso(snapshots,opcoes);
 const lista=Array.isArray(snapshots)?snapshots:[];
 const veiculos=registros(lista,'public.veiculos_motorista');
 const chaves=registros(lista,'public.chaves_pix_frete');
 const favorecidos=registros(lista,'public.favorecidos_frete');
 const empresaId=opcoes.empresaId||'';
 const itens=[
  ...registros(lista,'public.motoristas').map(item=>classificarMotorista(item,contextoMotorista(item,veiculos,chaves,favorecidos,empresaId))),
  ...veiculos.map(item=>classificarVeiculo(item,{empresaId})),
  ...registros(lista,'public.rotas').map(classificarRota),
  ...registros(lista,'public.documentos_motorista').map(item=>classificarDocumento(item,'documento_motorista')),
  ...registros(lista,'public.documentos_veiculo').map(item=>classificarDocumento(item,'documento_veiculo'))
 ];
 const prontos=[];
 const pendencias=[];
 for(const item of itens){
  if(item.apto)prontos.push({...item,hash:await hashCanonico(item.registro)});
  else pendencias.push(item);
 }
 const texto=JSON.stringify({prontos,pendencias});
 const segredoVazado=CAMPOS_SEGREDO.some(campo=>texto.includes(`"${campo}"`));
 return {
  valido:censo.valido&&!segredoVazado,
  bloqueios:segredoVazado?[...censo.bloqueios,'segredo_na_saida']:censo.bloqueios,
  censo,prontos,pendencias,
  promovidos:0,
  legadoPreservado:true,
  exclusaoLegado:false
 };
}
export async function completarPendencia(pendencia,complemento={}){
 const recusados=[];
 const origem={...(pendencia?.origem||{})};
 const contexto={...(pendencia?.contexto||{})};
 const mapa={
  nome:['origem','nome'],cpf:['origem','cpf'],telefone:['origem','telefone'],cnh:['origem','cnh_registro'],
  proprietario_nome:['origem','proprietario_nome'],chave_pix:['origem','chave_pix'],titular_pix:['origem','titular_pix'],
  tipo:['origem','tipo'],placa:['origem','placa'],empresa_id:['contexto','empresaId'],capacidade_operacional_kg:['contexto','capacidadeKg']
 };
 for(const [campo,valor] of Object.entries(complemento||{})){
  if(CAMPOS_SEGREDO.includes(campo)||falso(valor)||!mapa[campo]){recusados.push(campo);continue;}
  const [alvo,chave]=mapa[campo];
  if(alvo==='origem')origem[chave]=String(valor).trim();
  else contexto[chave]=campo==='capacidade_operacional_kg'?Number(valor):String(valor).trim();
 }
 const item=pendencia?.entidade==='veiculo'?classificarVeiculo(origem,contexto):classificarMotorista(origem,contexto);
 if(item.apto)item.hash=await hashCanonico(item.registro);
 return {item,recusados};
}
function gatesOk(gates={}){
 return gates.backupRestauravel===true&&gates.rollbackEnsaiado===true&&gates.conciliacao===true&&gates.aprovacaoHumana===true;
}
export async function aplicarPromocao(destino={},adaptado,opcoes={}){
 const bloqueios=[...(adaptado?.bloqueios||[])];
 if(!adaptado?.valido)bloqueios.push('censo');
 if(!gatesOk(opcoes.gates))bloqueios.push('gates');
 if(opcoes.aplicar!==true)bloqueios.push('dry_run');
 if(bloqueios.length)return {escreve:false,bloqueios:[...new Set(bloqueios)],destino,inseridos:0,fcAlterado:false};
 const proximo=structuredClone(destino||{});
 proximo.fc_motoristas=[...(proximo.fc_motoristas||[])];
 proximo.fc_veiculos=[...(proximo.fc_veiculos||[])];
 proximo.referencias=[...(proximo.referencias||[])];
 let inseridos=0;
 for(const item of adaptado.prontos||[]){
  if(item.registro?.ativo!==false)return {escreve:false,bloqueios:['ativo_recusado'],destino,inseridos:0,fcAlterado:false};
  const lista=item.entidade==='motorista'?proximo.fc_motoristas:item.entidade==='veiculo'?proximo.fc_veiculos:proximo.referencias;
  const hash=item.hash||await hashCanonico(item.registro);
  const existente=lista.find(row=>row.chave===item.chave);
  if(existente&&existente.hash===hash)continue;
  if(existente)return {escreve:false,bloqueios:['conflito'],destino,inseridos:0,fcAlterado:false};
  lista.push({...item.registro,hash,ativo:false});
  inseridos++;
 }
 proximo.pendencias=(adaptado.pendencias||[]).map(item=>({chave:item.chave,entidade:item.entidade,camposPendentes:item.camposPendentes,ativo:false}));
 return {escreve:true,bloqueios:[],destino:proximo,inseridos,fcAlterado:inseridos>0};
}
export function ensaiarRollback({legado=[],operacional={},promovidos=[]}={}){
 const foto=JSON.stringify(legado.map(item=>({tabela:item.source_table,contagem:item.source_count,checksum:item.source_checksum})));
 const removiveis=new Set();
 const recusados=[];
 for(const item of promovidos){
  const lista=item.entidade==='motorista'?operacional.fc_motoristas:item.entidade==='veiculo'?operacional.fc_veiculos:operacional.referencias;
  const atual=(lista||[]).find(row=>row.chave===item.chave);
  if(!atual){recusados.push({chave:item.chave,motivo:'ausente'});continue;}
  if(atual.ativo!==false){recusados.push({chave:item.chave,motivo:'ja_liberado'});continue;}
  if(atual.hash!==item.hash){recusados.push({chave:item.chave,motivo:'hash_divergente'});continue;}
  removiveis.add(item.chave);
 }
 const restaurado={
  fc_motoristas:(operacional.fc_motoristas||[]).filter(row=>!removiveis.has(row.chave)),
  fc_veiculos:(operacional.fc_veiculos||[]).filter(row=>!removiveis.has(row.chave)),
  referencias:(operacional.referencias||[]).filter(row=>!removiveis.has(row.chave))
 };
 return {restaurado,recusados,legadoIntacto:foto===JSON.stringify(legado.map(item=>({tabela:item.source_table,contagem:item.source_count,checksum:item.source_checksum}))),exclusaoLegado:false};
}
export function permitirExclusaoLegado(){
 return {permitido:false,motivo:'exclusao_irreversivel_sem_aceite_do_proprietario',tabelas:38,funcoes:19,buckets:3};
}
export function sessaoAdmin(sessao={}){
 return sessao?.origem==='app_metadata'&&sessao?.appMetadata?.papel==='admin';
}
export function planejarAuth(usuarios=[],opcoes={}){
 const revelar=sessaoAdmin(opcoes.sessao);
 const itens=(usuarios||[]).map(usuario=>{
  const limpo=semSegredo(usuario);
  const pendentes=[];
  if(!uuidOk(usuario?.user_id))pendentes.push('auth_user_id');
  if(!limpar(usuario?.perfil))pendentes.push('perfil');
  if(CAMPOS_SEGREDO.some(campo=>campo in (usuario||{})))pendentes.push('credencial_nao_copiada');
  return {chave:chaveEstavel('usuario',usuario?.user_id||usuario?.id),perfil:limpar(limpo.perfil),auth_user_id:revelar&&uuidOk(usuario?.user_id)?usuario.user_id:null,ativo:false,acao:pendentes.length?'revisar':'vincular_sem_senha',camposPendentes:pendentes};
 });
 return {executado:false,escreve:false,copiaSenha:false,bloqueios:['auth_admin_ausente'],esperado:4,recebidos:itens.length,itens};
}
export function planejarStorage({buckets=[],objetos=[],destino=[]}={},opcoes={}){
 const bloqueios=[];
 const porId=new Map((buckets||[]).map(item=>[item.id,item]));
 for(const esperado of BUCKETS_PRIVADOS){
  const atual=porId.get(esperado.id);
  if(!atual)bloqueios.push('bucket_ausente');
  else if(atual.public!==false&&atual.publico!==false)bloqueios.push('bucket_publico');
 }
 if((objetos||[]).length!==6)bloqueios.push('objetos_diferentes_de_6');
 if((objetos||[]).some(item=>item.bucket!=='motorista-documentos'))bloqueios.push('objeto_fora_do_bucket');
 if((objetos||[]).some(item=>item.bytes||item.conteudo_base64))bloqueios.push('bytes_recusados');
 if((objetos||[]).some(item=>!/^[0-9a-f]{64}$/i.test(String(item.sha256||''))||!limpar(item.path)||String(item.path).includes('..')))bloqueios.push('hash_ausente');
 const guardado=new Map((destino||[]).map(item=>[`${item.bucket}:${item.path}`,item]));
 const plano=(objetos||[]).map(item=>{
  const atual=guardado.get(`${item.bucket}:${item.path}`);
  if(atual&&atual.sha256===item.sha256&&atual.publico!==true)return {bucket:item.bucket,path:item.path,sha256:item.sha256,acao:'preservar',publico:false};
  if(atual)return {bucket:item.bucket,path:item.path,sha256:item.sha256,acao:'conflito',publico:false};
  return {bucket:item.bucket,path:item.path,sha256:item.sha256,acao:'inserir',publico:false};
 });
 if(plano.some(item=>item.acao==='conflito'))bloqueios.push('conflito');
 const autorizado=bloqueios.length===0&&opcoes.aplicar===true&&sessaoAdmin(opcoes.sessao);
 const memoria=autorizado?[...(destino||[]).filter(item=>!plano.some(planoItem=>planoItem.path===item.path&&planoItem.bucket===item.bucket&&planoItem.acao==='inserir')),...plano.filter(item=>item.acao==='inserir').map(item=>({bucket:item.bucket,path:item.path,sha256:item.sha256,publico:false}))]:destino;
 return {copiaRemota:false,escreve:false,motivo:'storage_admin_ausente',bloqueios,plano,memoria,rls:'privado_sem_anon',bucketsVazios:['forte-frete-cadastros','vendas-ordens-frete']};
}
export async function calcularDelta(antes=[],depois=[]){
 const mapa=new Map((antes||[]).map(item=>[item.source_table,item]));
 const itens=[];
 for(const atual of depois||[]){
  const previo=mapa.get(atual.source_table);
  const hashAntes=await hashCanonico(previo?.records||[]);
  const hashDepois=await hashCanonico(atual.records||[]);
  const marco=Date.parse(previo?.copied_at||'');
  const aposCaptura=Array.isArray(atual.records)&&atual.records.some(item=>Number.isFinite(marco)&&Date.parse(item.updated_at)>marco);
  if(hashAntes!==hashDepois||aposCaptura)itens.push({tabela:atual.source_table,hashAntes,hashDepois,alterado:hashAntes!==hashDepois,aposCaptura,corte:atual.source_table==='public.forte_push_subscriptions'});
 }
 return {itens,corpos:[]};
}
export function planejarFuncoes(){
 return {copiarCorpo:false,excluir:false,total:FUNCOES_LEGADO.length,itens:FUNCOES_LEGADO.map(item=>({slug:item.slug,verifyJwt:item.verifyJwt,acao:item.noOperacional?'ja_existe_nao_sobrescrever':'revisar_sem_copiar_corpo'}))};
}
export function urlNoOperacional(url){
 const texto=String(url||'');
 if(!HOST_LEGADO.test(texto))return {url:texto,reescrito:false};
 const caminho=texto.replace(HOST_LEGADO,'')||'/';
 return {url:caminho.startsWith('/')?caminho:`/${caminho}`,reescrito:true};
}
export function incorporarMotoristasInativos(lista=[],novos=[]){
 const atual=[...(lista||[])];
 for(const item of novos||[]){
  if(item?.ativo!==false||!item?.chave)continue;
  const cpf=somenteDigitos(item.cpf);
  if(atual.some(row=>row.chave===item.chave||(cpf&&somenteDigitos(row.cpf)===cpf)))continue;
  atual.push({...item,ativo:false,statusCadastro:'PENDENTE DE LIBERAÇÃO'});
 }
 return atual;
}
