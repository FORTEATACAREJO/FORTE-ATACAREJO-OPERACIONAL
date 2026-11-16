import {useEffect,useState} from 'react';
import {supabase} from './supabase.js';
import ExternalSalesWorkspace from './ExternalSalesWorkspace.jsx';
import FinanceiroPortal from './financeiro-portal/Portal.jsx';

function PatioWorkspace(){
 const [state,setState]=useState({cargas:[],movimentos:[]});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');try{
  const {data,error}=await supabase.rpc('forte_op_patio_resumo');
  if(error)throw Error(error.message);
  setState({cargas:data?.cargas||[],movimentos:data?.movimentos||[]});
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 return <section className="card"><h2>Pátio e expedição — FORTE-OP</h2>
 <p>Consulta operacional autorizada sem valores financeiros, custos ou margens.</p>
 <button type="button" onClick={load} disabled={busy}>ATUALIZAR</button>
 {error&&<p role="alert">{error}</p>}
 <h3>Cargas em acompanhamento</h3>
 <div style={{overflowX:'auto'}}><table><thead><tr><th>Carga</th><th>Produto</th><th>Quantidade</th><th>Motorista</th><th>Fase</th></tr></thead><tbody>{state.cargas.map((c,i)=><tr key={c.codigo||i}><td>{c.codigo}</td><td>{c.produto}</td><td>{c.qtd}</td><td>{c.motorista}</td><td>{c.fase||c.status}</td></tr>)}</tbody></table></div>
 {!state.cargas.length&&<p>Não há cargas para mostrar.</p>}
 <h3>Movimentações físicas</h3>
 <div style={{overflowX:'auto'}}><table><thead><tr><th>Produto</th><th>Movimento</th><th>Quantidade</th><th>Unidade</th></tr></thead><tbody>{state.movimentos.map((m,i)=><tr key={i}><td>{m.produto}</td><td>{m.tipo}</td><td>{m.quantidade}</td><td>{m.unidade}</td></tr>)}</tbody></table></div>
 </section>;
}

function DirectLoadWorkspace(){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{
  const {data,error}=await supabase.functions.invoke('mobile-carga-direta',{body:{acao:'LISTAR'}});
  if(error||data?.error)throw Error(data?.error||error?.message||'Falha na consulta.');
  setRows(data?.cargas||[]);
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 return <section className="card"><h2>Carga direta — FORTE-OP</h2><p>Consulta de cargas e destinos dentro da mesma sessão.</p><button onClick={load} disabled={busy}>ATUALIZAR</button>{error&&<p role="alert">{error}</p>}
 <div style={{overflowX:'auto'}}><table><thead><tr><th>Carga</th><th>Produto</th><th>Motorista</th><th>Situação</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.codigo}</td><td>{x.produto}</td><td>{x.motorista}</td><td>{x.status}</td></tr>)}</tbody></table></div>
 {!rows.length&&<p>Nenhuma carga disponível para este perfil.</p>}
 </section>;
}

function DriverWorkspace({profile}){
 const [driver,setDriver]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{
  const cpf=String(profile?.cpf||'').replace(/\D/g,'');
  if(cpf.length!==11)throw Error('Seu CPF precisa constar no cadastro do FORTE-OP.');
  const {data,error}=await supabase.from('fc_motoristas').select('nome,cpf,ativo,status_ia,categoria_cnh,validade_cnh').eq('cpf',cpf).maybeSingle();
  if(error)throw Error(error.message);
  setDriver(data||null);
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{load()},[profile?.cpf]);
 return <section className="card"><h2>Área do motorista — FORTE-OP</h2><button onClick={load} disabled={busy}>ATUALIZAR</button>{error&&<p role="alert">{error}</p>}
 {!driver?<p>Seu cadastro operacional não está homologado. A administração deve conferir CPF, CNH e documentação para liberar as cargas.</p>:
 <p><b>{driver.nome}</b> · {driver.ativo?'Cadastro ativo':'Aguardando homologação'} · CNH {driver.categoria_cnh||'sem categoria'} · {driver.status_ia||'Em revisão'}</p>}
 </section>;
}

const MODULES=[
 {id:'venda-externa',label:'Vendas externas',requiresRole:null},
 {id:'carga-direta',label:'Carga direta',requiresRole:null},
 {id:'patio',label:'Pátio',requiresRole:null},
 {id:'financeiro',label:'Financeiro',requiresRole:'MASTER'}
];
export default function UnifiedRoleWorkspace({grants,profile}){
 const role=String(profile?.perfil||'').toUpperCase();
 const eligible=MODULES.filter(x=>grants[x.id]?.allowed&&(!x.requiresRole||String(grants[x.id]?.role||role).toUpperCase()===x.requiresRole));
 if(grants.vendas?.allowed&&role==='MOTORISTA')eligible.unshift({id:'motorista',label:'Motorista'});
 const [tab,setTab]=useState(eligible[0]?.id||'');
 return <div className="forte-ui forte-op" style={{minHeight:'100vh',padding:16}}>
  <header style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,justifyContent:'space-between'}}><div><h1>FORTE-OP</h1><p>{profile?.nome} — acesso exclusivo aos módulos autorizados</p></div>
  <button type="button" onClick={()=>supabase.auth.signOut()}>SAIR</button></header>
  <nav aria-label="Módulos permitidos" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
  {eligible.map(m=><button key={m.id} type="button" aria-current={tab===m.id?'page':undefined} onClick={()=>setTab(m.id)}>{m.label}</button>)}
  </nav>
  {tab==='venda-externa'&&<ExternalSalesWorkspace/>}
  {tab==='carga-direta'&&<DirectLoadWorkspace/>}
  {tab==='patio'&&<PatioWorkspace/>}
  {tab==='motorista'&&<DriverWorkspace profile={profile}/>}
  {tab==='financeiro'&&<FinanceiroPortal embedded onExit={()=>setTab(eligible[0]?.id||'')}/>}
  {!eligible.length&&<section className="card"><p>Seu perfil foi autenticado, mas não possui um módulo operacional liberado. Solicite aprovação ao Master.</p></section>}
 </div>;
}
