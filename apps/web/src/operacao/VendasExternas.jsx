import "./vendas-externas.css";
import {useForteNavigation} from '../use-forte-navigation.js';
import {Brand, MenuButton, Drawer, BottomNav, Hero, Metrics, Shortcuts, useDrawer} from './ForteUI.jsx';
import {customerName} from "../customer-name.js";
import {useEffect,useState} from "react";
import {supabase} from "../supabase.js";
export default function App(){const drawer=useDrawer();const[msg,setMsg]=useState(""),[view,setView,tabHistory]=useForteNavigation("venda-externa","INICIO"),[data,setData]=useState({clientes:[],produtos:[],vendas:[],comissoes:[]}),[form,setForm]=useState({clienteId:"",produtoId:"",qtd:"",condicao:"7/14/21",observacao:""});
useEffect(()=>{
 let active=true;
 supabase.functions.invoke("mobile-vendas-externas",{body:{acao:"LISTAR"}}).then(({data,error})=>{
  if(!active)return;
  if(error)setMsg("NÃO FOI POSSÍVEL CARREGAR.");
  else setData(data||{});
 });
 return ()=>{active=false};
},[]);
const [saving,setSaving]=useState(false);
async function salvar(event){
 event.preventDefault();
 if(saving)return;
 setSaving(true);
 try{
  const {data:proposal,error}=await supabase.functions.invoke("mobile-vendas-externas",{body:{acao:"CRIAR_PROPOSTA",...form,qtd:Number(form.qtd)}});
  if(error){
   const detail=await error.context?.json?.().catch(()=>null);
   setMsg(detail?.error||"NÃO FOI POSSÍVEL ENVIAR A PROPOSTA.");
   return;
  }
  setMsg("PROPOSTA ENVIADA PARA APROVAÇÃO.");
  setData(current=>({...current,vendas:[proposal,...(current.vendas||[])]}));
  setForm({clienteId:"",produtoId:"",qtd:"",condicao:"7/14/21",observacao:""});
 }catch{
  setMsg("NÃO FOI POSSÍVEL ENVIAR A PROPOSTA.");
 }finally{
  setSaving(false);
 }
}
return <main className="forte-ui forte-externa forte-simple">{view!=="INICIO"&&<button type="button" onClick={()=>tabHistory.back()}>← VOLTAR</button>}<header className="forte-header"><MenuButton drawer={drawer}/><Brand label="VENDAS EXTERNAS"/><div className="actions"><div data-forte-top-actions aria-label="Ações do sistema"/><button onClick={()=>supabase.auth.signOut()}>Sair</button></div></header><Drawer drawer={drawer}><Brand label="VENDAS EXTERNAS"/><nav>{[["INICIO","Início"],["NOVA","Novo orçamento"],["VENDAS","Meus orçamentos"],["COMISSÕES","Comissões"]].map(([id,label])=><button key={id} className={view===id?"active":""} onClick={()=>setView(id)}>{label}</button>)}</nav></Drawer><BottomNav active={view} items={[{id:"INICIO",label:"Início",icon:"home"},{id:"VENDAS",label:"Orçamentos",icon:"file"},{id:"NOVA",label:"Novo",icon:"plus",primary:true},{id:"COMISSÕES",label:"Comissões",icon:"money"}]} onSelect={setView} onMore={()=>drawer.setOpen(true)}/>{view==="INICIO"&&<><Hero title="Suas vendas, sempre por perto." description="Crie orçamentos e acompanhe as propostas enviadas."/><Metrics items={[{label:"Orçamentos",value:data.vendas.length,icon:"file"},{label:"Aprovados",value:data.vendas.filter(x=>/APROVAD/i.test(x.status||"")).length,icon:"check"},{label:"Clientes",value:data.clientes.length,icon:"users"},{label:"Comissões",value:data.comissoes.length,icon:"money"}]}/><Shortcuts items={[{label:"Novo orçamento",description:"Criar para um cliente",icon:"plus",primary:true,onClick:()=>setView("NOVA")},{label:"Meus orçamentos",description:"Acompanhar status",icon:"file",primary:true,onClick:()=>setView("VENDAS")},{label:"Minhas comissões",description:"Consultar valores",icon:"money",onClick:()=>setView("COMISSÕES")} ]}/></>}{view==="NOVA"&&<form className="card" onSubmit={salvar}><h2>NOVA PROPOSTA</h2><label>CLIENTE — NOME FANTASIA<select value={form.clienteId} onChange={e=>setForm({...form,clienteId:e.target.value})} required><option value="">SELECIONE…</option>{(data.clientes||[]).map(x=><option value={x.id}>{customerName(x)}</option>)}</select></label><label>PRODUTO<select value={form.produtoId} onChange={e=>setForm({...form,produtoId:e.target.value})} required><option value="">SELECIONE…</option>{(data.produtos||[]).filter(x=>String(x.finalidade||"REVENDA").toUpperCase()==="REVENDA").sort((a,b)=>String(a.categoria||"OUTROS").localeCompare(String(b.categoria||"OUTROS"))||String(a.nome||"").localeCompare(String(b.nome||""))).map(x=><option value={x.id}>{String(x.categoria||"OUTROS").toUpperCase()} • {x.nome} — {Number(x.preco||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</option>)}</select></label><label>QUANTIDADE<input type="number" min="1" value={form.qtd} onChange={e=>setForm({...form,qtd:e.target.value})} required/></label><label>CONDIÇÃO<input value={form.condicao} onChange={e=>setForm({...form,condicao:e.target.value})}/></label><label>OBSERVAÇÃO<textarea value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})}/></label><button type="submit" disabled={saving}>ENVIAR PARA APROVAÇÃO</button></form>}{view==="VENDAS"&&<section className="list">{(data.vendas||[]).map(x=><article key={x.id}><b>{x.numero||"PROPOSTA"}</b><span>{customerName(x,data.clientes)}</span><span>{x.produto} • {x.qtd} UN</span><strong>{x.status||"AGUARDANDO APROVAÇÃO"}</strong></article>)}</section>}{view==="COMISSÕES"&&<section className="list">{(data.comissoes||[]).map(x=><article key={x.id||x.referencia}><b>{x.referencia}</b><span>{customerName(x,data.clientes)}</span><strong>{Number(x.valor||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></article>)}</section>}{msg&&<div className="toast">{msg}</div>}</main>}
