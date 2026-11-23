import {useCallback,useEffect,useState} from 'react';
import OrdersWorkspace from './OrdersWorkspace.jsx';
import {applyAuthUser,loadCloudState,saveCloudState,supabase} from './supabase.js';

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

 const saveRegistry=useCallback(async(kind,item,original)=>{
  if(!['fornecedores','clientes'].includes(kind))throw Error('Cadastro não permitido neste atalho.');
  const latest=await loadCloudState();
  if(!latest)throw Error('Base indisponível. Nenhum cadastro foi modificado.');
  const records=latest[kind]||[];
  if(original){
   const current=records.find(r=>r.id===original.id);
   if(!current)throw Error('Cadastro foi removido por outro usuário. Atualize e confira.');
   if(JSON.stringify(current)!==JSON.stringify(original))throw Error('Outro usuário alterou este cadastro. Reabra a edição para não sobrescrever alterações.');
  }else if(records.some(r=>r.id===item.id))throw Error('Identificação de cadastro em uso. Tente novamente.');
  const next={...latest,[kind]:original?records.map(r=>r.id===item.id?item:r):[...records,item]};
  const saved=await saveCloudState(next);
  if(!saved)throw Error('Servidor não confirmou o cadastro.');
  setData(applyAuthUser(saved));
  return saved;
 },[]);
 function openUsers(){
  const details=document.querySelector('.ft-admin-tools');
  if(details)details.open=true;
  const button=document.querySelector('.ft-admin-tools .fa-admin-button');
  button?.click();
 }
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
   <span className="ft-toolbar-label">Gestão de pedidos e cargas</span>
   <details className="ft-admin-tools">
    <summary aria-label="Ferramentas e cadastros">⚙ Ferramentas</summary>
    <div data-forte-top-actions/>
   </details>
   <button type="button" onClick={signOut}>Sair</button>
  </header>
  {!allowed?<section className="ft-guard" role="alert"><h1>Pedidos FT</h1><p>Acesso exclusivo para usuários Master autorizados.</p></section>:
   <>
    {notice&&<p role="alert" className="ft-warning">{notice}</p>}
    {data?<OrdersWorkspace standalone initialTab="dossie" data={data}
     currentUser={data.usuarios.find(user=>user.id===data.currentUserId)||profile}
     onRefresh={refresh} onCommit={commit} onSaveRegistry={saveRegistry} onManageUsers={openUsers}
     onNavigate={()=>setNotice('Esta operação está disponível no Forte OP.')}
     onBilling={()=>setNotice('As cobranças são emitidas no Forte OP.')}/>:<section className="ft-guard">
     <h1>Pedidos FT</h1>
     {notice?<button type="button" onClick={()=>{setNotice('');refresh().catch(error=>setNotice(error.message));}}>Tentar novamente</button>:<p role="status">Carregando as cargas…</p>}
    </section>}
   </>}
 </main>;
}
