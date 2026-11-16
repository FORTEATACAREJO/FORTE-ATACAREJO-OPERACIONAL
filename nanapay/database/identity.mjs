/**
 * Nanapay staff authentication (server only).
 * Staged for a SEPARATE Supabase project; never imported in public demo mode.
 * Validates access token against Supabase Auth, then checks active per-tenant
 * membership using server-only credentials. NEVER expose service role key.
 */
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(code,message){return Object.assign(new Error(message),{http:code});}
export function createNanapayIdentity({url,publishableKey,serviceRoleKey,fetchImpl=fetch}){
 if(!url||!/^https:\/\/[a-z0-9.-]+$/i.test(url))throw Error('NANAPAY_SUPABASE_URL must be an HTTPS origin');
 if(!publishableKey||!serviceRoleKey)throw Error('Nanapay Supabase Auth credentials missing');
 const origin=url.replace(/\/$/,'');
 const request=async(endpoint,headers)=>{
  let r;
  try{r=await fetchImpl(origin+endpoint,{method:'GET',headers,signal:AbortSignal.timeout(8000)});}
  catch{throw fail(503,'Serviço de autenticação temporariamente indisponível');}
  if(!r.ok)return {status:r.status,data:null};
  try{return {status:r.status,data:await r.json()};}catch{throw fail(503,'Resposta inválida da autenticação');}
 };
 return {
  async authorize({authorization,restaurantId,allowedRoles=['admin','garcom']}){
   if(!ID.test(String(restaurantId||'')))throw fail(400,'Identificador do restaurante inválido');
   const match=/^Bearer ([A-Za-z0-9._-]{20,6000})$/.exec(String(authorization||''));
   if(!match)throw fail(401,'Entre com seu login do restaurante');
   const user=await request('/auth/v1/user',{
    apikey:publishableKey,Authorization:'Bearer '+match[1],Accept:'application/json'
   });
   if(user.status!==200||!ID.test(String(user.data?.id||'')))throw fail(401,'Sua sessão expirou; faça login novamente');
   const query=new URLSearchParams({
    select:'id,restaurant_id,role,display_name,active',
    auth_user_id:'eq.'+user.data.id,restaurant_id:'eq.'+restaurantId,
    active:'is.true',limit:'2'
   });
   const membership=await request('/rest/v1/nanapay_staff?'+query.toString(),{
    apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,Accept:'application/json'
   });
   if(membership.status!==200)throw fail(503,'Não foi possível validar o acesso ao restaurante');
   if(!Array.isArray(membership.data)||membership.data.length!==1)throw fail(403,'Você não tem acesso a este restaurante');
   const m=membership.data[0];
   if(m.active!==true||m.restaurant_id!==restaurantId||!['admin','garcom'].includes(m.role))throw fail(403,'Acesso do restaurante inválido');
   if(!allowedRoles.includes(m.role))throw fail(403,'Seu perfil não permite esta operação');
   return Object.freeze({id:m.id,userId:user.data.id,restaurantId,role:m.role,name:m.display_name});
  }
 };
}
