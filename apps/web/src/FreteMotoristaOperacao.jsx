import {useEffect,useRef,useState} from 'react';
import {BUCKET_FRETE_SANDBOX,MENSAGENS_FRETE,anexarReferenciaCarga,caminhoAnexoFrete,decidirCargaMotorista} from './frete-motorista-operacao.mjs';

export default function FreteMotoristaOperacao({client=null,userId='',cargas=null,onChange}){
 const controlado=Array.isArray(cargas);
 const [remotas,setRemotas]=useState([]);
 const [mensagem,setMensagem]=useState('');
 const [motivo,setMotivo]=useState('');
 const [hash,setHash]=useState('');
 const [ocupado,setOcupado]=useState(false);
 const arquivoRef=useRef(null);
 const lista=controlado?cargas:remotas;
 async function carregar(){
  if(controlado||!client)return;
  const {data,error}=await client.rpc('fc_frete_minhas_cargas');
  if(error){setMensagem(error.message||'Não foi possível consultar as cargas.');return;}
  setRemotas(Array.isArray(data)?data:[]);
 }
 useEffect(()=>{carregar();},[client,controlado]);
 function aplicar(proxima,texto){
  setMensagem(texto);
  if(!proxima)return;
  if(controlado)onChange?.(proxima);
  else setRemotas(atual=>atual.map(item=>item.id===proxima.id?{...item,...proxima}:item));
 }
 async function decidir(carga,decisao){
  const resultado=decidirCargaMotorista(carga,{decisao,motivo});
  if(!resultado.ok){setMensagem(resultado.erro);return;}
  if(!controlado&&client&&!resultado.idempotente){
   setOcupado(true);
   const {error}=await client.rpc('fc_frete_decidir_carga',{p_id:carga.id,p_decisao:decisao,p_motivo:decisao==='RECUSADA'?motivo:null});
   setOcupado(false);
   if(error){setMensagem(error.message||'Não foi possível registrar a decisão.');return;}
  }
  aplicar(resultado.carga,resultado.mensagem);
 }
 async function anexar(carga){
  const resultado=anexarReferenciaCarga(carga,{bucket:BUCKET_FRETE_SANDBOX,path:caminhoAnexoFrete(userId,carga.id),sha256:hash,userId});
  if(!resultado.ok){setMensagem(resultado.erro);return;}
  if(!controlado&&client&&!resultado.idempotente){
   setOcupado(true);
   const {error}=await client.rpc('fc_frete_anexar_referencia',{p_id:carga.id,p_bucket:BUCKET_FRETE_SANDBOX,p_path:caminhoAnexoFrete(userId,carga.id),p_sha256:hash.trim().toLowerCase()});
   setOcupado(false);
   if(error){setMensagem(error.message||'Não foi possível registrar a referência.');return;}
  }
  aplicar(resultado.carga,resultado.mensagem);
  setHash('');
 }
 async function lerArquivo(arquivo){
  if(!arquivo)return;
  if(arquivo.size>8*1024*1024){setMensagem('O comprovante deve ter até 8 MB.');return;}
  if(!globalThis.crypto?.subtle){setMensagem('Este navegador não calculou o hash. Informe o SHA-256.');return;}
  const digest=await crypto.subtle.digest('SHA-256',await arquivo.arrayBuffer());
  setHash([...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join(''));
  setMensagem('Hash calculado neste aparelho. O arquivo não foi enviado.');
 }
 if(!controlado&&!client)return <section data-frete-operacao="sessao"><h2>Minhas cargas</h2><p>{MENSAGENS_FRETE.semSessao}</p></section>;
 return <section data-frete-operacao="cargas">
  <style>{'[data-frete-operacao] label{display:block;margin:8px 0}[data-frete-operacao] textarea,[data-frete-operacao] input{width:100%;box-sizing:border-box;min-height:44px}[data-frete-operacao] button{display:block}'}</style>
  <h2>Minhas cargas</h2>
  <p>Estas cargas são de homologação. Aceitar não libera o cadastro para operação real e o arquivo permanece neste aparelho.</p>
  {!lista.length&&<p>{MENSAGENS_FRETE.vazia}</p>}
  {lista.map(carga=><article key={carga.id} data-carga={carga.id}>
   <h3>{carga.codigo}</h3>
   <p>{carga.origem} → {carga.destino}<br/>{carga.produto} · {Number(carga.pesoKg||0).toLocaleString('pt-BR')} kg<br/>Situação: {carga.status==='OFERECIDA'?'Aguardando decisão':carga.status==='ACEITA'?'Aceita':carga.status==='RECUSADA'?'Recusada':carga.status}</p>
   {carga.status==='OFERECIDA'&&<>
    <label>Motivo da recusa<textarea value={motivo} onChange={event=>setMotivo(event.target.value)} disabled={ocupado}/></label>
    <div className="rowActions">
     <button type="button" style={{minHeight:44,width:'100%'}} disabled={ocupado} onClick={()=>decidir(carga,'ACEITA')}>ACEITAR CARGA</button>
     <button type="button" style={{minHeight:44,width:'100%'}} disabled={ocupado} onClick={()=>decidir(carga,'RECUSADA')}>RECUSAR CARGA</button>
    </div>
   </>}
   {carga.status==='ACEITA'&&<form onSubmit={event=>{event.preventDefault();anexar(carga);}}>
    <input ref={arquivoRef} hidden type="file" accept="application/pdf,image/*" onChange={event=>{const arquivo=event.target.files?.[0];event.target.value='';lerArquivo(arquivo);}}/>
    <button type="button" style={{minHeight:44,width:'100%'}} onClick={()=>arquivoRef.current?.click()}>ESCOLHER ARQUIVO NESTE APARELHO</button>
    <label>SHA-256 do comprovante<input name="sha256" inputMode="text" autoComplete="off" value={hash} onChange={event=>setHash(event.target.value)} disabled={ocupado}/></label>
    <button type="submit" style={{minHeight:44,width:'100%'}} disabled={ocupado}>REGISTRAR REFERÊNCIA</button>
    {carga.anexoSha256&&<p>Referência já registrada.</p>}
   </form>}
   {carga.status==='RECUSADA'&&carga.motivo&&<p>Motivo: {carga.motivo}</p>}
  </article>)}
  <p role="status">{mensagem}</p>
 </section>;
}
