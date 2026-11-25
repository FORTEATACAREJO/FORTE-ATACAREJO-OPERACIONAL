import {useState} from 'react';
import {supabase} from './supabase.js';
import {fields,documents} from '../../../supabase/functions/driver-cadastro/validation.mjs';
async function invoke(action,body){
 if(!supabase)throw Error('Conexão indisponível.');
 const r=await supabase.functions.invoke('driver-cadastro',{body,headers:{'x-cadastro-action':action}});
 if(r.error){let detail;try{detail=await r.error.context?.json?.();}catch{}throw Error(detail?.error||r.error.message);}
 if(r.data?.error)throw Error(r.data.error);return r.data;
}
export default function DriverIntake({driver}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[link,setLink]=useState(''),[result,setResult]=useState(null);
 const reload=async()=>setResult(await invoke('LIST',{motoristaId:driver.id}));
 const run=async(fn)=>{setBusy(true);setNotice('');try{await fn();}catch(e){setNotice(e.message);}finally{setBusy(false);}};
 return <div><button type="button" className="secondary" disabled={busy} onClick={()=>{setOpen(v=>!v);if(!open)run(reload);}}>Link e documentos do motorista</button>
 {open&&<section aria-label="Atualização cadastral por link">
 <p>O link permite somente enviar dados deste cadastro. Não concede acesso ao sistema.</p>
 <button type="button" disabled={busy} onClick={()=>run(async()=>{const r=await invoke('CREATE',{motoristaId:driver.id});setLink(r.link);await reload();})}>Gerar link individual (7 dias)</button>
 {link&&<><label>Link individual<input readOnly value={link} onFocus={e=>e.target.select()}/></label><button type="button" onClick={()=>run(async()=>{await navigator.clipboard.writeText('Olá! Atualize seu cadastro na FORTE pelo link individual: '+link);setNotice('Mensagem copiada. Envie ao motorista pelo WhatsApp privado.');})}>Copiar mensagem para WhatsApp</button></>}
 <button type="button" disabled={busy} onClick={()=>run(reload)}>Atualizar recebimentos</button>
 {notice&&<p role="status">{notice}</p>}
 {result?.links.map(l=><p key={l.id}>Link criado em {new Date(l.criado_em).toLocaleString('pt-BR')} — {l.revogado_em?'Revogado':Date.parse(l.expira_em)<=Date.now()?'Expirado':'Válido'} {!l.revogado_em&&Date.parse(l.expira_em)>Date.now()&&<button type="button" disabled={busy} onClick={()=>{if(confirm('Revogar este link?'))run(async()=>{await invoke('REVOKE',{id:l.id});setLink('');await reload();});}}>Revogar</button>}</p>)}
 <h4>Recebimentos para conferência</h4>
 {result&&!result.submissions.length&&<p>Nenhum documento ou dado recebido.</p>}
 {result?.submissions.map(s=><article key={s.id}><b>{new Date(s.criado_em).toLocaleString('pt-BR')} — aguardando revisão</b>{Object.entries(s.dados).map(([k,v])=><p key={k}>{fields[k]||k}: {v}</p>)}{s.arquivos.map(a=><button key={a.tipo} type="button" disabled={busy} onClick={()=>run(async()=>{const r=await invoke('DOWNLOAD',{id:s.id,tipo:a.tipo});const el=document.createElement('a');el.href=r.url;el.rel='noreferrer';el.click();})}>Baixar {documents[a.tipo]||a.tipo}</button>)}</article>)}
 <p>Dados recebidos não alteram automaticamente o cadastro operacional nem aprovam a CNH. Confira e atualize os campos no cadastro do motorista/veículo.</p>
 </section>}</div>;
}
