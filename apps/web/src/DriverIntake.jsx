import {useState} from 'react';
import './driver-intake.css';
import {fields,documents,suggestedFields} from '../../../supabase/functions/driver-cadastro/validation.mjs';
async function invoke(action,body){
 const {supabase}=await import('./supabase.js');
 if(!supabase)throw Error('Conexão indisponível.');
 const r=await supabase.functions.invoke('driver-cadastro',{body,headers:{'x-cadastro-action':action}});
 if(r.error){let detail;try{detail=await r.error.context?.json?.();}catch{}throw Error(detail?.error||r.error.message);}
 if(r.data?.error)throw Error(r.data.error);return r.data;
}
export default function DriverIntake({driver}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[link,setLink]=useState(''),[result,setResult]=useState(null);
 const [mode,setMode]=useState('pendencias'),[requestedFields,setRequestedFields]=useState(()=>[...suggestedFields(driver),'placaCavalo','placaCarreta1','placaCarreta2','placaCarreta3']),[requestedDocs,setRequestedDocs]=useState([]),[linkRequest,setLinkRequest]=useState(null);
 const whatsapp=String(driver.whatsapp||driver.telefone||'').replace(/\D/g,'');
 const to=whatsapp.length===11?'55'+whatsapp:whatsapp;
 const message='Olá, '+(String(driver.nome||'').trim().split(/\s+/)[0]||'motorista')+'! Aqui é da Forte Atacarejo. Abra seu link individual, confira as placas do caminhão e das carretas e complete o que estiver pendente. Depois toque em Enviar para conferência. '+link;
 const toggle=(set,key,checked)=>set(old=>checked?[...new Set([...old,key])]:old.filter(k=>k!==key));
 const reload=async()=>setResult(await invoke('LIST',{motoristaId:driver.id}));
 const run=async(fn)=>{setBusy(true);setNotice('');try{await fn();}catch(e){setNotice(e.message);}finally{setBusy(false);}};
 const groups=[['Dados pessoais',['nome','cpf','whatsapp','email']],['Habilitação',['cnh','categoria','validade']],['Endereço',['endereco','cidade']],['Veículo e proprietário',['proprietario','nomeProprietario','placaCavalo','placaCarreta1','placaCarreta2','placaCarreta3']]];
 return <div className="di-wrap"><button type="button" className="secondary" disabled={busy} onClick={()=>{setOpen(v=>!v);if(!open)run(reload);}}>Link e documentos do motorista</button>
 {open&&<section className="di-panel" aria-label="Atualização cadastral por link">
 <header className="di-heading"><img src="/icons/forte-cadastro-motorista.webp" alt="" width="48" height="48"/><div><h3>Cadastro do motorista</h3><p>{driver.nome}</p></div></header>
 <p>O link permite somente enviar dados deste cadastro. Não concede acesso ao sistema.</p>
 <label className="di-mode">Tipo de solicitação<select value={mode} onChange={e=>setMode(e.target.value)}><option value="pendencias">Somente pendências selecionadas</option><option value="completo">Cadastro completo</option></select></label>
 {mode==='pendencias'&&<><p>Campos ausentes do cadastro operacional vêm sugeridos. Confira antes de gerar o link; marque documentos somente quando estiverem faltando ou precisarem de renovação.</p>
 <div className="di-count" role="status">{requestedFields.length+requestedDocs.length} item(ns) selecionado(s)</div>
 {groups.map(([title,keys])=><div className="di-group" key={title}><h4>{title}</h4><div className="di-list">{keys.map(k=><label className="di-choice" key={k}><span>{fields[k]}</span><input type="checkbox" checked={requestedFields.includes(k)} onChange={e=>toggle(setRequestedFields,k,e.target.checked)}/></label>)}</div></div>)}
 <div className="di-group"><h4>Documentos a solicitar</h4><div className="di-list">{Object.entries(documents).map(([k,v])=><label className="di-choice" key={k}><span>{v}</span><input type="checkbox" checked={requestedDocs.includes(k)} onChange={e=>toggle(setRequestedDocs,k,e.target.checked)}/></label>)}</div></div>
 <button type="button" className="di-clear" onClick={()=>{setRequestedFields([]);setRequestedDocs([]);}}>Limpar seleção</button></>}
 <button type="button" className="di-primary" disabled={busy||mode==='pendencias'&&!requestedFields.length&&!requestedDocs.length} onClick={()=>run(async()=>{const r=await invoke('CREATE',{motoristaId:driver.id,solicitacao:mode==='pendencias'?{fields:requestedFields,documents:requestedDocs}:null});if(!r.link||!r.link.startsWith('https://pedidos-ft.onrender.com/cadastro-motorista.html#'))throw Error('O servidor não retornou um link válido.');setLink(r.link);setLinkRequest(r.solicitacao);setNotice('Link gerado. Abra para testar ou envie pelo WhatsApp.');await reload();})}>Gerar link individual (7 dias)</button>
 {link&&<div className="di-link"><label>Link individual<input readOnly value={link} onFocus={e=>e.target.select()}/></label><a className="ft-outline" href={link} target="_blank" rel="noopener noreferrer">Testar link do motorista</a><a className="ft-outline" href={'https://wa.me/'+(/^55\d{11}$/.test(to)?to:'')+'?text='+encodeURIComponent(message)} target="_blank" rel="noopener noreferrer">Enviar link pelo WhatsApp</a><button type="button" onClick={()=>run(async()=>{if(!navigator.clipboard)throw Error("Selecione e copie o endereço acima.");await navigator.clipboard.writeText(message);setNotice("Mensagem copiada.");})}>Copiar mensagem para WhatsApp</button></div>}
 <button type="button" disabled={busy} onClick={()=>run(reload)}>Atualizar recebimentos</button>
 {notice&&<p role="status">{notice}</p>}
 {result?.links.map(l=><p key={l.id}>Link criado em {new Date(l.criado_em).toLocaleString('pt-BR')} — {l.revogado_em?'Revogado':Date.parse(l.expira_em)<=Date.now()?'Expirado':'Válido'} {!l.revogado_em&&Date.parse(l.expira_em)>Date.now()&&<button type="button" disabled={busy} onClick={()=>{if(confirm('Revogar este link?'))run(async()=>{await invoke('REVOKE',{id:l.id});setLink('');await reload();});}}>Revogar</button>}</p>)}
 <h4>Recebimentos para conferência</h4>
 {result&&!result.submissions.length&&<p>Nenhum documento ou dado recebido.</p>}
 {result?.submissions.map(s=><article key={s.id}><b>{new Date(s.criado_em).toLocaleString('pt-BR')} — aguardando revisão</b>{Object.entries(s.dados).map(([k,v])=><p key={k}>{fields[k]||k}: {v}</p>)}{s.arquivos.map(a=><button key={a.tipo} type="button" disabled={busy} onClick={()=>run(async()=>{const r=await invoke('DOWNLOAD',{id:s.id,tipo:a.tipo});const el=document.createElement('a');el.href=r.url;el.rel='noreferrer';el.click();})}>Baixar {documents[a.tipo]||a.tipo}</button>)}</article>)}
 <p>Dados recebidos não alteram automaticamente o cadastro operacional nem aprovam a CNH. Confira e atualize os campos no cadastro do motorista/veículo.</p>
 </section>}</div>;
}
