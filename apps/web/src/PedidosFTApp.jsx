import {useCallback,useEffect,useState} from 'react';
import OrdersWorkspace from './OrdersWorkspace.jsx';
import {applyAuthUser,loadCloudState,supabase} from './supabase.js';

export default function PedidosFTApp({profile,grants}){
 const allowed=profile.perfil==='MASTER'&&grants.vendas?.allowed;
 const [data,setData]=useState(null);
 const [notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  const state=await loadCloudState();
  if(!state)throw Error('Base do Pedidos FT indisponível. Tente novamente.');
  setData(applyAuthUser(state));
 },[]);
 useEffect(()=>{
  if(allowed)refresh().catch(error=>setNotice(error.message));
 },[allowed,refresh]);

 async function commit(body){
  const {data:receipt,error}=await supabase.functions.invoke('orders-workflow',{body});
  let message=receipt?.error;
  if(!message&&error?.context){
   try{message=(await error.context.json()).error;}catch{}
  }
  if(error||message)throw Error(message||error.message);
  try{await refresh();}catch{setNotice('A operação foi recebida. Atualize as cargas para conferir.');}
  return receipt;
 }
 async function signOut(){
  const {error}=await supabase.auth.signOut();
  if(error)setNotice('Não foi possível sair. Tente novamente.');
  else window.location.reload();
 }
 return <main className="pedidos-ft-standalone">
  <header className="pedidos-ft-toolbar">
   <div data-forte-top-actions/>
   <button type="button" onClick={signOut}>Sair</button>
  </header>
  {!allowed?<section className="ft-guard" role="alert"><h1>Pedidos FT</h1><p>Acesso exclusivo para usuários Master autorizados.</p></section>:
   <>
    {notice&&<p role="alert" className="ft-warning">{notice}</p>}
    {data?<OrdersWorkspace standalone initialTab="dossie" data={data}
     currentUser={data.usuarios.find(user=>user.id===data.currentUserId)||profile}
     onRefresh={refresh} onCommit={commit}
     onNavigate={()=>setNotice('Esta operação está disponível no Forte OP.')}
     onBilling={()=>setNotice('As cobranças são emitidas no Forte OP.')}/>:<section className="ft-guard">
     <h1>Pedidos FT</h1>
     {notice?<button type="button" onClick={()=>{setNotice('');refresh().catch(error=>setNotice(error.message));}}>Tentar novamente</button>:<p role="status">Carregando as cargas…</p>}
    </section>}
   </>}
 </main>;
}
