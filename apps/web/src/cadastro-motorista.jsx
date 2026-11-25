import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {fields,documents,maxFile,maxBody,validToken} from '../../../supabase/functions/driver-cadastro/validation.mjs';
import './cadastro-motorista.css';
const base=String(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const key=String(import.meta.env.VITE_SUPABASE_ANON_KEY||'');
const token=location.hash.slice(1);
async function call(action,body){
 const r=await fetch(base+'/functions/v1/driver-cadastro',{method:'POST',headers:{apikey:key,'x-cadastro-action':action,'x-cadastro-token':token},body,cache:'no-store',referrerPolicy:'no-referrer'});
 const data=await r.json();if(!r.ok||data.error)throw Error(data.error||'Não foi possível enviar.');return data;
}
function App(){
 const [ready,setReady]=useState(false),[status,setStatus]=useState('Verificando seu link…'),[busy,setBusy]=useState(false),[values,setValues]=useState({}),[files,setFiles]=useState({}),[version,setVersion]=useState(0),[received,setReceived]=useState('');
 useEffect(()=>{if(!base||!key||!validToken(token)){setStatus('Solicite à FORTE um link individual válido.');return;}call('CHECK').then(()=>{setReady(true);setStatus('');}).catch(e=>setStatus(e.message));},[]);
 async function submit(e){e.preventDefault();if(busy)return;setBusy(true);setStatus('');setReceived('');try{
 const selected=Object.values(files).filter(Boolean);if(selected.some(f=>f.size>maxFile)||selected.reduce((sum,f)=>sum+f.size,0)>maxBody-65536)throw Error('Envie arquivos de até 6 MB cada, em etapas menores que 12 MB.');
 const body=new FormData();body.append('dados',JSON.stringify(values));for(const [k,f] of Object.entries(files))if(f)body.append(k,f);
 const result=await call('SUBMIT',body);setReceived(result.protocolo);setValues({});setFiles({});setVersion(v=>v+1);
 }catch(e){setStatus(e.message);}finally{setBusy(false);}}
 const field=(k,label)=>{const props={id:k,value:values[k]||'',onChange:e=>setValues(v=>({...v,[k]:e.target.value})),disabled:busy};
 return <label key={k} htmlFor={k}>{label}{k==='categoria'||k==='proprietario'?<select {...props}><option value="">Selecione</option>{(k==='categoria'?['A','B','C','D','E','AB','AC','AD','AE']:['Sim','Não']).map(v=><option key={v}>{v}</option>)}</select>:<input {...props} maxLength={300} type={k==='validade'?'date':k==='email'?'email':'text'} inputMode={['cpf','cnh','whatsapp'].includes(k)?'numeric':undefined} autoComplete="off"/>}</label>};
 return <main><header><small>FORTE ATACAREJO</small><h1>Cadastro do motorista</h1><p>Atualize seus dados e envie os documentos pelo celular.</p></header>{status&&<p role="status" className="notice">{status}</p>}{received&&<section className="success" role="status"><b>Dados recebidos pela FORTE!</b><p>Protocolo: {received}</p><p>Você pode enviar mais informações nesta mesma página enquanto o link estiver válido.</p></section>}{ready&&<form onSubmit={submit}>
 <section><h2>1. Seus dados</h2><p>Preencha o que estiver disponível. Não precisa de comprovante de endereço.</p>{Object.entries(fields).slice(0,9).map(([k,v])=>field(k,v))}</section>
 <section><h2>2. Veículo</h2><p>Informações do veículo serão conferidas separadamente.</p>{Object.entries(fields).slice(9).map(([k,v])=>field(k,v))}</section>
 <section><h2>3. Documentos</h2><p>Escolha uma foto da galeria ou fotografe pelo celular. Até 6 MB por arquivo; envie em etapas.</p>{Object.entries(documents).map(([k,v])=><label key={k+version}>{v}<input aria-label={v} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={e=>setFiles(old=>({...old,[k]:e.target.files?.[0]||null}))}/></label>)}</section>
 <p className="privacy">Os dados enviados serão usados pela FORTE ATACAREJO para atualização e conferência do cadastro de motorista e veículo. Não envie senhas, dados bancários ou documentos de terceiros sem autorização. A aprovação do carregamento é uma etapa separada.</p>
 <button type="submit" disabled={busy}>{busy?'Enviando…':'Enviar cadastro / documentos'}</button>
 <p>O link é individual, válido por 7 dias e permite até 12 envios. Não compartilhe com outras pessoas.</p>
 </form>}</main>;
}
createRoot(document.getElementById('root')).render(<App/>);
