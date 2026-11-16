// Preserve the legacy module permission IDs in Supabase while exposing one FORTE-OP login.
// All decisions are confirmed by access_current_module; client labels never grant authorization.
export const FORTE_OP_GRANT_APPS=Object.freeze(['vendas','venda-externa','carga-direta','patio','financeiro']);
export async function loadForteOpGrants(client){
 if(!client)throw Error('Sessão não configurada.');
 const entries=await Promise.all(FORTE_OP_GRANT_APPS.map(async app=>{
  try{
   const {data,error}=await client.rpc('access_current_module',{p_app:app});
   return [app,!error&&data?.allowed===true?data:null];
  }catch{return [app,null]}
 }));
 return Object.fromEntries(entries);
}
export function preferredForteOpGrant(grants){
 for(const app of FORTE_OP_GRANT_APPS)if(grants?.[app]?.allowed===true)return {app,...grants[app]};
 return null;
}
