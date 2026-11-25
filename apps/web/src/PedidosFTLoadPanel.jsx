import {useState} from 'react';
import {loadReport,reportPDF} from './orders-reports';

const statuses=['Em andamento','Finalizadas','Canceladas','Rascunhos'];
const searchKey=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const loadStatus=(load,order)=>load.status==='CANCELADA'?statuses[2]:load.finalizadaEm?statuses[1]:String(order?.status||'').startsWith('RASCUNHO')?statuses[3]:statuses[0];
const reference=load=>load.codigo||load.id;

export default function PedidosFTLoadPanel({data,cargas,showReports,onOpen}){
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
   protocol:load.protocolo||order?.protocolo,
   os:order?.numero||load.numeroOS,
   status:loadStatus(load,order),
  };
 });
 const term=searchKey(query);
 const filtered=records.filter(({load,supplier,official,protocol,os,status:current})=>
  (!status||status===current)&&
  searchKey([os,reference(load),supplier,official,protocol,load.motorista].join(' ')).includes(term)
 );
 function downloadSummary(){
  const sections=statuses.map(title=>({
   title,
   rows:filtered.filter(record=>record.status===title).map(({load,supplier,official,os})=>
    [os&&'Nossa OS '+os,'Carga '+reference(load),supplier,official&&'Pedido '+official,load.fase].filter(Boolean).join(' • ')
   ),
  })).filter(section=>section.rows.length);
  reportPDF('RESUMO DE CARGAS — PEDIDOS FT',sections).save('PEDIDOS-FT-CARGAS.pdf');
 }
 return <section className="ft-card" aria-label={showReports?'Relatórios':'Todas as cargas'}>
  <div className="ft-load-filters">
   <label>Buscar carga<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Código, fornecedor, pedido ou motorista"/></label>
   <label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}>
    <option value="">Todas</option>
    {statuses.map(value=><option key={value}>{value}</option>)}
   </select></label>
  </div>
  <p className="ft-hint">{filtered.length} de {records.length} cargas</p>
  {showReports&&<button type="button" className="ft-primary" disabled={!filtered.length} onClick={downloadSummary}>Baixar resumo das cargas em PDF</button>}
  {filtered.length?<ul className="ft-doc-list ft-load-list">
   {filtered.map(({load,supplier,official,protocol,os,status:current})=><li key={load.id}>
    <div>
     <b>{os||reference(load)}{supplier&&' · '+supplier}</b>
     {os&&<small>Código interno da carga: {reference(load)}</small>}
     <span>{current}{load.fase&&' · '+load.fase}</span>
     {official&&<small>Pedido oficial {official}</small>}
     {protocol&&<small>Protocolo {protocol}</small>}
    </div>
    {showReports
     ?<button type="button" className="ft-outline" aria-label={'Baixar PDF da carga '+reference(load)} onClick={()=>loadReport(data,load).save(reference(load)+'-DOSSIE.pdf')}>Baixar PDF</button>
     :<button type="button" className="ft-outline" aria-label={'Abrir carga '+reference(load)} onClick={()=>onOpen(load.id)}>Abrir dossiê</button>}
   </li>)}
  </ul>:<p>Nenhuma carga encontrada.</p>}
 </section>;
}
