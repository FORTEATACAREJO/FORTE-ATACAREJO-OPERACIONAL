import {useState} from 'react';
import FreteMotoristaPainel from './FreteMotoristaPainel.jsx';
export default function DriverDirectory({data,onClose,onSync,onChange,canEdit=false}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function refresh(){setBusy(true);try{const result=await onSync();setMessage((result?.count??0)+' motorista(s) consultados na base histórica. Nenhum cadastro antigo foi apagado.')}catch(error){setMessage(error.message)}finally{setBusy(false)}}
 return <div className="modalBackdrop"><section className="modal"><div className="modalHead"><h2>MOTORISTAS — OPERACIONAL</h2><button onClick={onClose}>FECHAR</button></div>
  <FreteMotoristaPainel motoristas={data.motoristas||[]} canEdit={canEdit} onSave={resultado=>{if(!resultado.escreve||!onChange)return;onChange(atual=>({...atual,motoristas:resultado.motoristas,auditoria:[...(atual.auditoria||[]),{id:`aud-${resultado.registro.id}-${resultado.registro.atualizadoEm}`,acao:'MOTORISTA GRAVADO NO OPERACIONAL',referencia:resultado.registro.id,detalhe:`${resultado.acao} • ${resultado.registro.statusCadastro||''}`,dataHora:resultado.registro.atualizadoEm}]}));}}/>
  <div className="rowActions"><button type="button" disabled={busy||!onSync} onClick={refresh}>ATUALIZAR DA BASE HISTÓRICA</button></div>
  <p role="status">{message}</p>
 </section></div>;
}
