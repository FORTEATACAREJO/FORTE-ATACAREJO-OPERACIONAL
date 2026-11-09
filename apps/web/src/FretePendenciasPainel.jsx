import {useState} from 'react';
import {adaptarSnapshots,completarPendencia} from './frete-snapshot.mjs';

const ROTULOS={nome:'Nome',cpf:'CPF',telefone:'WhatsApp',cnh:'CNH',proprietario_nome:'Proprietário',chave_pix:'Chave Pix',titular_pix:'Titular do Pix',capacidade_operacional_kg:'Capacidade kg',placa:'Placa',tipo:'Tipo do veículo',empresa_id:'Empresa',destino:'Destino',origem:'Origem',storage_referencia:'Arquivo',motorista_id:'Motorista',id_legado:'Identificador',pix_ambiguo:'Pix ambíguo'};

export default function FretePendenciasPainel({canEdit=false,onPromover}){
 const [empresaId,setEmpresaId]=useState('');
 const [lote,setLote]=useState('');
 const [snapshots,setSnapshots]=useState(null);
 const [relatorio,setRelatorio]=useState(null);
 const [mensagem,setMensagem]=useState('');
 const [complementos,setComplementos]=useState({});
 async function ler(bruto=lote){
  let lista=snapshots;
  if(String(bruto||'').trim()){
   let json;
   try{json=JSON.parse(bruto);}catch{setMensagem('O lote não é um JSON válido.');return;}
   lista=Array.isArray(json)?json:json?.snapshots;
   if(!Array.isArray(lista)){setMensagem('O lote não contém snapshots.');return;}
   setSnapshots(lista);
   setLote('');
  }
  if(!Array.isArray(lista)){setMensagem('O lote não contém snapshots.');return;}
  const resultado=await adaptarSnapshots(lista,{empresaId,alvoRef:'gtwecfyffjszghnvtlzr'});
  setRelatorio(resultado);
  setMensagem(resultado.valido?'Lote lido. Cadastro incompleto permanece pendente, sem dado fictício.':'Lote fora do censo da captura. Nada foi gravado.');
 }
 async function arquivo(event){
  const file=event.target.files?.[0];
  if(!file)return;
  const texto=await file.text();
  setLote(texto);
  await ler(texto);
 }
 async function guardar(pendencia){
  const {item,recusados}=await completarPendencia(pendencia,{...(complementos[pendencia.chave]||{}),...(empresaId?{empresa_id:empresaId}:{})});
  setRelatorio(atual=>{
   const pendencias=atual.pendencias.filter(row=>row.chave!==pendencia.chave);
   const prontos=atual.prontos.filter(row=>row.chave!==pendencia.chave);
   if(item.apto)prontos.push(item);else pendencias.push(item);
   return {...atual,pendencias,prontos};
  });
  setMensagem(recusados.length?'Valor recusado. O campo fictício ou vazio não entrou.':item.apto?'Complemento aceito. O cadastro segue inativo.':'Ainda há campos pendentes.');
 }
 function preparar(){
  if(!relatorio?.valido){setMensagem('Lote fora do censo. Nada foi preparado.');return;}
  const motoristas=(relatorio.prontos||[]).filter(item=>item.entidade==='motorista'&&item.registroPwa?.ativo===false).map(item=>item.registroPwa);
  onPromover?.({motoristas});
  setMensagem('Prontos ficaram inativos nesta tela. fc_motoristas não foi gravado e o banco antigo permanece.');
 }
 const pendencias=(relatorio?.pendencias||[]).filter(item=>item.entidade==='motorista'||item.entidade==='veiculo');
 const prontos=(relatorio?.prontos||[]).filter(item=>item.entidade==='motorista'||item.entidade==='veiculo');
 return <div className="frete-pendencias">
  <h3>Pendências da captura do Frete</h3>
  <p>O lote já capturado não é refeito aqui. Campo vazio continua vazio. O banco antigo não é apagado.</p>
  <label>Empresa do operacional<input name="empresaId" value={empresaId} onChange={event=>setEmpresaId(event.target.value)} disabled={!canEdit}/></label>
  <label>Lote JSON<textarea name="lote" value={lote} onChange={event=>setLote(event.target.value)} disabled={!canEdit}/></label>
  <label>Arquivo do lote<input name="arquivo" type="file" accept="application/json" onChange={arquivo} disabled={!canEdit}/></label>
  {canEdit&&<div className="rowActions"><button type="button" onClick={()=>ler()}>LER LOTE</button><button type="button" onClick={preparar}>PREPARAR INATIVOS NESTA TELA</button></div>}
  {relatorio&&<p>{prontos.length} pronto(s) inativo(s) • {pendencias.length} pendência(s) de motorista ou veículo.</p>}
  <div className="flowTable"><table><thead><tr><th>Cadastro</th><th>Pendências</th><th>Complemento</th></tr></thead><tbody>
   {pendencias.map(item=><tr key={item.chave||item.nome}><td>{item.nome||'Sem nome'}</td><td>{item.camposPendentes.map(campo=>ROTULOS[campo]||campo).join(', ')}</td><td>{canEdit&&item.camposPendentes.filter(campo=>!['empresa_id','id_legado','pix_ambiguo','motorista_id'].includes(campo)).map(campo=><label key={campo}>{ROTULOS[campo]||campo}<input name={`${item.chave}:${campo}`} value={complementos[item.chave]?.[campo]||''} onChange={event=>setComplementos(atual=>({...atual,[item.chave]:{...atual[item.chave],[campo]:event.target.value}}))}/></label>)}{canEdit&&<button type="button" onClick={()=>guardar(item)}>GUARDAR COMPLEMENTO</button>}</td></tr>)}
  </tbody></table></div>
  {!!prontos.length&&<ul>{prontos.map(item=><li key={item.chave}>{item.nome||item.entidade}: inativo, pronto para revisão</li>)}</ul>}
  <p role="status">{mensagem}</p>
 </div>;
}
