import {createRoot} from 'react-dom/client';
import AuthGate from './AuthGate.jsx';
import PedidosFTApp from './PedidosFTApp.jsx';
import RestrictedDossiers,{ftAccess} from './FTRestrictedDossiers.jsx';
import {startAccess} from './access-standard.js';
import {supabase} from './supabase.js';
import {initMonitoring,reactErrorOptions} from './monitoring.js';
import './styles.css';
import './App.css';
import './forte-ui.css';
import './pedidos-ft-standalone.css';

initMonitoring();
const content=document.getElementById('root');
if(supabase){
 startAccess({client:supabase,app:'vendas',title:'Pedidos FT',icon:'/icons/pedidos-ft-192.png',content,resolveModuleAccess:()=>ftAccess({action:'FT_SCOPE'})}).ready.then(effective=>{
  createRoot(content,reactErrorOptions).render(
   effective.ftMode==='RESTRICTED'?<RestrictedDossiers/>:<AuthGate title="Pedidos FT" renderWorkspace={scope=><PedidosFTApp {...scope}/>}/>
  );
 });
}else content.textContent='Conexão do Pedidos FT indisponível.';
if('serviceWorker' in navigator&&import.meta.env.PROD){
 window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.error));
}
