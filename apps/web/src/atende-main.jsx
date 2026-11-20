import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {supabase,setAuthContext} from './supabase.js';
import {startAccess} from './access-standard.js';
import {loadForteOpGrants,preferredForteOpGrant} from './forte-op-grants.js';
import ForteAtende from './ForteAtende.jsx';
import './atende.css';

function AtendeAuth(){
  const [state,setState]=useState({loading:true,error:''});
  useEffect(()=>{
    let active=true;
    async function authorize(){
      try{
        const {data:u,error:userError}=await supabase.auth.getUser();
        if(userError||!u?.user)throw Error('Faça login para acessar o FORTE ATENDE.');
        const {data:profile,error:profileError}=await supabase.from('fc_perfis').select('*').eq('user_id',u.user.id).maybeSingle();
        if(profileError||!profile?.ativo||profile.status_aprovacao!=='APROVADO'||profile.trocar_senha)
          throw Error('Acesso não aprovado ou senha pendente de atualização.');
        const grants=await loadForteOpGrants(supabase);
        if(!grants?.vendas?.allowed||!preferredForteOpGrant(grants))
          throw Error('Seu usuário precisa de autorização para o FORTE ATACAREJO OPERACIONAL.');
        const role=String(grants.vendas.role||profile.perfil||'').toUpperCase();
        setAuthContext({user:u.user,profile:{...profile,perfil:role}});
        if(active)setState({loading:false,error:''});
      }catch(error){
        if(active){setAuthContext(null);setState({loading:false,error:String(error.message||error)});}
      }
    }
    authorize();
    return()=>{active=false;setAuthContext(null)};
  },[]);
  if(state.loading)return <main className="at-initial"><h1>FORTE ATENDE</h1><p>Validando usuário autorizado…</p></main>;
  if(state.error)return <main className="at-initial" role="alert"><h1>Acesso protegido</h1><p>{state.error}</p><button onClick={()=>location.reload()}>Tentar novamente</button></main>;
  return <ForteAtende/>;
}
const rootNode=document.getElementById('root');
if(!supabase)rootNode.textContent='FORTE ATENDE: conexão Supabase não configurada.';
else startAccess({client:supabase,app:'vendas',content:rootNode,allowOtherModules:true}).ready.then(()=>{
  createRoot(rootNode).render(<AtendeAuth/>);
}).catch(()=>{rootNode.textContent='Não foi possível iniciar a autenticação.';});
