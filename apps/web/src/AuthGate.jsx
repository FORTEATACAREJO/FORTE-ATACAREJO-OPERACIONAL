import {useEffect,useState} from 'react';
import App from './App.jsx';
import UnifiedRoleWorkspace from './UnifiedRoleWorkspace.jsx';
import {supabase,setAuthContext} from './supabase.js';
import {accessTimeout} from './access-standard.js';
import {loadForteOpGrants,preferredForteOpGrant} from './forte-op-grants.js';

export default function AuthGate(){
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [scope,setScope]=useState(null);
 useEffect(()=>{
  let active=true;
  setReady(false);setError('');
  async function load(){
   try{
    const {data:u,error:userError}=await accessTimeout(supabase.auth.getUser());
    if(userError||!u?.user)throw Error('Não foi possível conferir a sessão.');
    const {data:p,error:profileError}=await accessTimeout(supabase.from('fc_perfis').select('*').eq('user_id',u.user.id).maybeSingle());
    if(profileError||!p?.ativo||p.status_aprovacao!=='APROVADO'||p.trocar_senha)
      throw Error('Cadastro sem aprovação válida ou com senha pendente.');
    const grants=await accessTimeout(loadForteOpGrants(supabase));
    const activeGrant=preferredForteOpGrant(grants);
    if(!activeGrant)throw Error('Seu usuário ainda não possui módulo FORTE-OP autorizado.');
    const role=String(activeGrant.role||p.perfil||'').toUpperCase();
    const profile={...p,perfil:role,permissoes:activeGrant.permissions||p.permissoes};
    const restricted=['MOTORISTA','OPERADOR_PATIO','VENDEDOR_EXTERNO'].includes(role)||!grants.vendas?.allowed;
    if(active){
     setAuthContext({user:u.user,profile});
     setScope({grants,profile,restricted});setReady(true);
    }
   }catch(e){if(active){setAuthContext(null);setError(e.message||'Não foi possível validar o acesso.');}}
  }
  load();
  return()=>{active=false;setAuthContext(null)};
 },[attempt]);
 if(!ready)return <section role={error?'alert':undefined} style={{padding:24}}>
  <p>{error||'Conferindo acesso FORTE-OP…'}</p>
  {error&&<button type="button" onClick={()=>setAttempt(x=>x+1)}>TENTAR NOVAMENTE</button>}
 </section>;
 return scope?.restricted?<UnifiedRoleWorkspace grants={scope.grants} profile={scope.profile}/>:<App/>;
}
