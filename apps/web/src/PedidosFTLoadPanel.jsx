import {useRef,useState} from 'react';
import {buildPedidosFTDossier,dossierPending,pendingTypes} from './pedidos-ft-model.mjs';
import {loadReport,reportPDF} from './orders-reports';

const statuses=['Em andamento','Finalizadas','Canceladas'];
const searchKey=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const loadStatus=load=>load.status==='CANCELADA'?statuses[2]:load.finalizadaEm?statuses[1]:statuses[0];
const reference=(load,order)=>order?.numero||load.numeroOS||'OS não vinculada';

export function LoadCloseConfirmation({load,onClose,busy=false}){
 const [checked,setChecked]=useState(false),[observation,setObservation]=useState(''),[saving,setSaving]=useState(false),[status,setStatus]=useState('');
 const lock=useRef(false);
 if(load.status==='CANCELADA')return null;
 if(load.finalizadaEm)return <div><span className="ft-pill ft-good">FINALIZADA</span><small>Concluída por {load.finalizadaPor||'Responsável não informado'} em {new Date(load.finalizadaEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</small>{load.fechamentoPedro?.observacao&&<small>Observação: {load.fechamentoPedro.observacao}</small>}</div>;
 if(!onClose)return null;
 async function finish(){if(lock.current||!checked)return;lock.current=true;setSaving(true);setStatus('');try{await onClose(load.id,observation.trim());setChecked(false);setStatus('Confirmação registrada. Confira o status da carga.');}catch(e){setStatus(e.message||'Não foi possível finalizar.');}finally{lock.current=false;setSaving(false);}}
 return <div className="ft-close-confirmation"><label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" style={{width:18,height:18,flexShrink:0}} checked={checked} disabled={busy||saving} onChange={e=>setChecked(e.target.checked)}/> Conferi e imprimi o dossiê completo</label>{checked&&<><label>Observação (opcional)<textarea value={observation} maxLength={500} disabled={saving||busy} onChange={e=>setObservation(e.target.value)}/></label><button type="button" className="ft-primary" disabled={busy||saving} onClick={finish}>{saving?'Finalizando…':'Confirmar carga finalizada'}</button></>}{status&&<p role="status">{status}</p>}</div>;
}

export default function PedidosFTLoadPanel({data,cargas,showReports,onOpen,onClose,busy=false,pendingFilter=''}){
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState('');
 const suppliers=new Map((data.fornecedores||[]).map(supplier=>[supplier.id,supplier.nome]));
 const orders=data.comprasFornecedor||[];
 const ordersById=new Map(orders.map(order=>[order.id,order]));
 const ordersByLoad=new Map(orders.map(order=>[order.cargaId,order]));
 const records=cargas.map(load=>{
  const order=ordersById.get(load.compraFornecedorId)||ordersByLoad.get(load.id);
  return {
   load,
   supplier:load.fornecedor||suppliers.get(load.fornecedorId)||order?.fornecedor,
   official:load.numeroPedidoFornecedor||order?.numeroPedidoFornecedor,
   os:reference(load,order),
   status:loadStatus(load),
  };
 });
 const term=searchKey(query);
 const filtered=records.filter(({load,supplier,official,os,status:current})=>
  (!pendingFilter||dossierPending(buildPedidosFTDossier(data,load.id)).includes(pendingFilter))&&
  (!status||status===current)&&
  searchKey([os,supplier,official,load.motorista].join(' ')).includes(term)
 );
 function downloadSummary(){
  const sections=statuses.map(title=>({
   title,
   rows:filtered.filter(record=>record.status===title).map(({load,supplier,official,os})=>
    [os,supplier,official&&'Pedido '+official,load.fase].filter(Boolean).join(' • ')
   ),
  })).filter(section=>section.rows.length);
  reportPDF('RESUMO DE CARGAS — PEDIDOS FT',sections).save('PEDIDOS-FT-CARGAS.pdf');
 }
 return <section className="ft-card" aria-label={showReports?'Relatórios':'Todas as cargas'}>
  {pendingFilter&&<p><b>{pendingTypes.find(t=>t[0]===pendingFilter)?.[1]}</b></p>}
  <div className="ft-load-filters">
   <label>Buscar carga<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="OS, fornecedor, pedido ou motorista"/></label>
   <label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}>
    <option value="">Todas</option>
    {statuses.map(value=><option key={value}>{value}</option>)}
   </select></label>
  </div>
  <p className="ft-hint">{filtered.length} de {records.length} cargas</p>
  {showReports&&<button type="button" className="ft-primary" disabled={!filtered.length} onClick={downloadSummary}>Baixar resumo das cargas em PDF</button>}
  {filtered.length?<ul className="ft-doc-list ft-load-list">
   {filtered.map(({load,supplier,official,os,status:current})=><li key={load.id}>
    <div>
     <b>{os}{supplier&&' · '+supplier}</b>
     <span className={'ft-pill '+(current==='Finalizadas'?'ft-good':current==='Canceladas'?'ft-warn':'ft-neutral')}>{current==='Finalizadas'?'FINALIZADA':current}</span>
     {current!=='Finalizadas'&&load.fase&&<small>{load.fase}</small>}
     {official&&<small>Pedido oficial {official}</small>}
     {!showReports&&<LoadCloseConfirmation load={load} onClose={onClose} busy={busy}/>}
    </div>
    {showReports
     ?<button type="button" className="ft-outline" aria-label={'Baixar PDF da carga '+os} onClick={()=>loadReport(data,load).save(os+'-DOSSIE.pdf')}>Baixar PDF</button>
     :<button type="button" className="ft-outline" aria-label={'Abrir carga '+os} onClick={()=>onOpen(load.id)}>Abrir dossiê</button>}
   </li>)}
  </ul>:<p>Nenhuma carga encontrada.</p>}
 </section>;
}
