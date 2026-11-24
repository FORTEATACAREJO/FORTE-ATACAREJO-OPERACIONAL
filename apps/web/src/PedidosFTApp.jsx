import {paymentKey} from '../../../supabase/functions/orders-workflow/supplier-payment-terms.mjs';
import {useCallback,useEffect,useState} from 'react';
import OrdersWorkspace from './OrdersWorkspace.jsx';
import {applyAuthUser,loadCloudState,saveCloudState,supabase} from './supabase.js';

export default function PedidosFTApp({profile,grants}){
 const allowed=profile.perfil==='MASTER'&&grants.vendas?.allowed;
 const [data,setData]=useState(null);
 const [notice,setNotice]=useState('');
 const [channels,setChannels]=useState(null);
 const [checkingChannels,setCheckingChannels]=useState(false);
 const refresh=useCallback(async()=>{
  const state=await loadCloudState();
  if(!state)throw Error('Base do Pedidos FT indisponível. Tente novamente.');
  setData(applyAuthUser(state));
  return state;
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
  try{const state=await refresh();if(body.action==='SUPPLIER_TERM'&&!state.fornecedores?.find(f=>f.id===body.fornecedorId)?.prazosPagamento?.some(t=>paymentKey(t)===paymentKey(body.pagamento)))throw Error('Condição não confirmada na releitura.');}catch(e){setNotice('A operação foi recebida. Atualize as cargas para conferir.');if(body.action==='SUPPLIER_TERM')throw e;}
  return receipt;
 }
 async function checkChannels(){
  setCheckingChannels(true);setChannels(null);
  try{
   const {data:out,error}=await supabase.functions.invoke('order-communications',{body:{action:'CHANNEL_STATUS'}});
   if(error||out?.error){
    let detail=out?.error||error?.message||'Não foi possível conferir os canais.';
    if(error?.context)try{detail=(await error.context.clone().json()).error||detail;}catch{}
    throw Error(detail);
   }
   setChannels(out);
  }catch(e){setChannels({error:e.message||'Falha ao consultar os canais.'});}
  finally{setCheckingChannels(false);}
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
   {allowed&&<button type="button" disabled={checkingChannels} onClick={checkChannels}>{checkingChannels?'Conferindo canais…':'✉ Conferir e-mail / WhatsApp'}</button>}
   <button type="button" onClick={signOut}>Sair</button>
  </header>
  {!allowed?<section className="ft-guard" role="alert"><h1>Pedidos FT</h1><p>Acesso exclusivo para usuários Master autorizados.</p></section>:
   <>
    {notice&&<p role="alert" className="ft-warning">{notice}</p>}
    {channels&&<section className="ft-channel-check" role="status"><header><h3>Verificação de e-mail e WhatsApp Business</h3><button type="button" onClick={()=>setChannels(null)}>Fechar</button></header>{channels.error?<p className="ft-warning">{channels.error}</p>:<><p><strong>E-mail Hostinger:</strong> {channels.email?.ready?'✓ Caixa autorizada':'⚠ Verificação pendente'} — {channels.email?.detail}</p><p><strong>WhatsApp Business:</strong> {channels.whatsapp?.connected?'✓ Conexão cadastrada':'⚠ Conexão não confirmada'}</p><p><strong>Pedido ao fornecedor em PDF:</strong> {channels.whatsapp?.fornecedor?.ready?'✓ Modelo aprovado':'⚠ Modelo pendente'} — {channels.whatsapp?.fornecedor?.detail}</p><p><strong>Ordem ao motorista em PDF:</strong> {channels.whatsapp?.motorista?.ready?'✓ Modelo aprovado':'⚠ Modelo pendente'} — {channels.whatsapp?.motorista?.detail}</p><small>Essa conferência não dispara mensagens. O aceite de envio não comprova a entrega ao destinatário.</small></>}</section>}
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
