export const profileActive=p=>Boolean(p?.empresa_id&&p.ativo===true&&p.status_aprovacao==='APROVADO'&&!p.trocar_senha);
export const isMaster=(p,g)=>profileActive(p)&&p.perfil==='MASTER'&&g?.allowed===true&&g.role==='MASTER';
export async function getAttendanceGrant(db,empresa,uid){
 const r=await db.from('forte_atende_access').select('ativo,whatsapp,email,revision').eq('empresa_id',empresa).eq('user_id',uid).order('revision',{ascending:false}).limit(1).maybeSingle();
 if(r.error)throw Error('Permissão de atendimento indisponível.');
 return r.data||null;
}
export async function getAttendanceSettings(db,empresa){
 const r=await db.from('forte_atende_settings').select('reception,ai,revision').eq('empresa_id',empresa).order('revision',{ascending:false}).limit(1).maybeSingle();
 if(r.error)throw Error('Configuração de atendimento indisponível.');
 return r.data||{revision:0,reception:false,ai:false};
}
export async function manageAttendance({db,p,user,master,body,env}){
 const empresa=p.empresa_id,own=await getAttendanceGrant(db,empresa,user.id);
 if(body.action==='ATENDE_ACCESS')return {master,whatsapp:master||own?.ativo===true&&own.whatsapp===true,email:master||own?.ativo===true&&own.email===true};
 if(!master)throw Error('Configuração exclusiva do MASTER.');
 if(body.action==='ATENDE_MANAGE_LIST'){
  const r=await db.from('fc_perfis').select('user_id,nome,perfil').eq('empresa_id',empresa).eq('ativo',true).eq('status_aprovacao','APROVADO').eq('trocar_senha',false);
  if(r.error)throw Error('Usuários indisponíveis.');
  const users=await Promise.all(r.data.filter(x=>x.user_id!==user.id).map(async x=>({id:x.user_id,name:x.nome,grant:await getAttendanceGrant(db,empresa,x.user_id)})));
  return {users,settings:await getAttendanceSettings(db,empresa),aiConfigured:Boolean(env('OPENAI_API_KEY'))};
 }
 if(body.action==='ATENDE_GRANT'){
  if(body.userId===user.id||typeof body.whatsapp!=='boolean'||typeof body.email!=='boolean')throw Error('Permissão inválida.');
  const r=await db.from('fc_perfis').select('empresa_id,ativo,status_aprovacao,trocar_senha').eq('empresa_id',empresa).eq('user_id',body.userId).maybeSingle();
  if(r.error||!profileActive(r.data))throw Error('Usuário ativo e aprovado não localizado.');
  const auth=await db.auth.admin.getUserById(body.userId);if(auth.error||!auth.data?.user)throw Error('Login não localizado.');
  const prev=await getAttendanceGrant(db,empresa,body.userId);
  if(body.revision!==(prev?.revision||0))throw Error('Permissão alterada. Atualize.');
  const a=await db.from('forte_atende_access').insert({empresa_id:empresa,user_id:body.userId,revision:(prev?.revision||0)+1,ativo:body.whatsapp||body.email,whatsapp:body.whatsapp,email:body.email,actor:user.id});
  if(a.error)throw Error('Não foi possível gravar. Atualize.');
  return {ok:true};
 }
 if(body.action==='ATENDE_SETTINGS'){
  if(typeof body.reception!=='boolean'||typeof body.ai!=='boolean'||body.ai&&!env('OPENAI_API_KEY'))throw Error('Configuração inválida ou IA sem credencial.');
  const prev=await getAttendanceSettings(db,empresa);
  if(prev.revision!==body.revision)throw Error('Configuração alterada. Atualize.');
  const r=await db.from('forte_atende_settings').insert({empresa_id:empresa,revision:prev.revision+1,reception:body.reception,ai:body.ai,actor:user.id});
  if(r.error)throw Error('Não foi possível gravar. Atualize.');
  return {ok:true};
 }
 throw Error('Ação de atendimento inválida.');
}
