import {useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase.js';

const dinheiro=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const initial={clienteId:'',produtoId:'',qtd:'',condicao:'',observacao:''};

export default function ExternalSalesWorkspace(){
 const [rows,setRows]=useState({clientes:[],produtos:[],vendas:[],comissoes:[]});
 const [form,setForm]=useState(initial),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function call(acao,extra={}){
  const {data,error}=await supabase.functions.invoke('mobile-vendas-externas',{body:{acao,...extra}});
  if(error||data?.error)throw Error(data?.error||error?.message||'Falha ao consultar vendas externas.');
  return data;
 }
 async function load(){
  setError('');setLoading(true);
  try{
   const data=await call('LISTAR');
   setRows({clientes:data.clientes||[],produtos:data.produtos||[],vendas:data.vendas||[],comissoes:data.comissoes||[]});
  }catch(e){setError(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{load()},[]);
 const selected=useMemo(()=>rows.produtos.find(x=>String(x.id)===String(form.produtoId)),[rows.produtos,form.produtoId]);
 const total=Number(selected?.preco||0)*Number(form.qtd||0);
 async function submit(event){
  event.preventDefault();setBusy(true);setError('');setSuccess('');
  try{
   if(!form.clienteId||!form.produtoId||!Number.isSafeInteger(Number(form.qtd))||Number(form.qtd)<=0)throw Error('Informe cliente, produto e quantidade inteira positiva.');
   const created=await call('CRIAR_PROPOSTA',{clienteId:form.clienteId,produtoId:form.produtoId,qtd:Number(form.qtd),condicao:form.condicao.trim(),observacao:form.observacao.trim()});
   setSuccess('Proposta '+(created.numeroVenda||'')+' enviada para aprovação, sem lançamento fiscal.');
   setForm(initial);await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="card">
 <header style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
 <div><h2>Vendas externas — FORTE-OP</h2><p>Propostas vinculadas ao vendedor autenticado, dentro do sistema único.</p></div>
 <button type="button" onClick={load} disabled={loading||busy}>ATUALIZAR</button>
 </header>
 {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 {loading?<p>Consultando dados autorizados…</p>:<>
 <form onSubmit={submit} style={{display:'grid',gap:12}}>
 <label>Cliente vinculado ao vendedor<select required value={form.clienteId} onChange={e=>setForm(f=>({...f,clienteId:e.target.value}))}><option value="">Selecione</option>{rows.clientes.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
 <label>Produto<select required value={form.produtoId} onChange={e=>setForm(f=>({...f,produtoId:e.target.value}))}><option value="">Selecione</option>{rows.produtos.map(x=><option key={x.id} value={x.id}>{x.nome} — {dinheiro(x.preco)}</option>)}</select></label>
 <label>Quantidade<input required type="number" min="1" step="1" value={form.qtd} onChange={e=>setForm(f=>({...f,qtd:e.target.value}))}/></label>
 <label>Condição comercial<input value={form.condicao} onChange={e=>setForm(f=>({...f,condicao:e.target.value}))} maxLength={120}/></label>
 <label>Observação<textarea value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} maxLength={500}/></label>
 <p><b>Total estimado:</b> {dinheiro(total)}</p>
 <button type="submit" disabled={busy||!rows.clientes.length||!rows.produtos.length}>ENVIAR PROPOSTA PARA APROVAÇÃO</button>
 </form>
 <h3>Minhas propostas</h3>
 <div style={{overflowX:'auto'}}><table><thead><tr><th>Número</th><th>Cliente</th><th>Produto</th><th>Total</th><th>Situação</th></tr></thead><tbody>
 {rows.vendas.map(x=><tr key={x.id}><td>{x.numeroVenda}</td><td>{x.cliente}</td><td>{x.produto}</td><td>{dinheiro(x.total)}</td><td>{x.status}</td></tr>)}
 </tbody></table></div>
 {!rows.vendas.length&&<p>Nenhuma proposta registrada.</p>}
 </>}
 </section>;
}
