import {useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase.js';
import {activeLink,canLink,driverName,plateKey,validPlate} from './frota-vinculos.mjs';
import './frota-vinculos.css';

const initialVehicle={placa:'',tipo:'CAVALO MECÂNICO',marca_modelo:'',capacidade_kg:'',proprietario_nome:'',proprietario_documento:'',crlv_referencia:''};
const initialCarrier={razao_social:'',nome_fantasia:'',cnpj:'',whatsapp:''};
const onlyDigits=v=>String(v||'').replace(/\D/g,'');
const pretty=stamp=>stamp?new Date(stamp).toLocaleString('pt-BR'):'';
export default function FleetLinkManager({drivers=[],isAdmin=false,mode='vinculos'}){
 const [vehicles,setVehicles]=useState([]),[carriers,setCarriers]=useState([]),[links,setLinks]=useState([]),[registeredDrivers,setRegisteredDrivers]=useState([]);
 const [vehicle,setVehicle]=useState(initialVehicle),[carrier,setCarrier]=useState(initialCarrier);
 const [choice,setChoice]=useState({motorista_operacional_id:'',veiculo_id:'',transportadora_id:'',observacao:''});
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const allDrivers=useMemo(()=>[...new Map([...drivers,...registeredDrivers].map(d=>[d.id,d])).values()],[drivers,registeredDrivers]);
 const vehicleById=useMemo(()=>new Map(vehicles.map(v=>[v.id,v])),[vehicles]);
 const carrierById=useMemo(()=>new Map(carriers.map(c=>[c.id,c])),[carriers]);
 const ordered=useMemo(()=>[...links].sort((a,b)=>String(b.inicio_em).localeCompare(String(a.inicio_em))),[links]);
 const current=ordered.filter(activeLink);
 const history=ordered.filter(x=>!activeLink(x));
 async function load(){
  if(!supabase)throw Error('Supabase não está configurado.');
  const [vr,cr,lr,dr]=await Promise.all([
   supabase.from('fc_veiculos').select('id,empresa_id,placa,tipo,marca_modelo,capacidade_kg,proprietario_nome,proprietario_documento,crlv_referencia,ativo').order('placa').limit(500),
   supabase.from('fc_transportadoras').select('id,empresa_id,razao_social,nome_fantasia,cnpj,ativo').order('razao_social').limit(500),
   supabase.from('fc_frota_vinculos').select('id,empresa_id,motorista_operacional_id,veiculo_id,transportadora_id,inicio_em,fim_em,observacao').order('inicio_em',{ascending:false}).limit(1000),
   supabase.from('fc_motoristas').select('id,nome,ativo').order('nome').limit(500)
  ]);
  for(const response of [vr,cr,lr,dr])if(response.error)throw Error('Não foi possível consultar a frota: '+response.error.message);
  setVehicles(vr.data||[]);setCarriers(cr.data||[]);setLinks(lr.data||[]);setRegisteredDrivers(dr.data||[]);setLoading(false);
 }
 useEffect(()=>{let active=true;load().catch(e=>{if(active){setMessage(e.message);setLoading(false);}});return()=>{active=false}},[]);
 async function admin(){
  if(!isAdmin)throw Error('Somente Master/Admin pode cadastrar ou vincular.');
  const user=await supabase.auth.getUser();
  if(user.error||!user.data.user)throw Error('Sessão expirada. Faça login novamente.');
  const [profile,grant]=await Promise.all([
   supabase.from('fc_perfis').select('empresa_id').eq('user_id',user.data.user.id).maybeSingle(),
   supabase.rpc('access_current_module',{p_app:'vendas'})
  ]);
  if(profile.error||!profile.data?.empresa_id||grant.error||!grant.data?.allowed||!grant.data?.isAdmin)
   throw Error('Sem permissão de administrador na empresa ativa.');
  return {userId:user.data.user.id,empresaId:profile.data.empresa_id};
 }
 async function transact(task){
  setBusy(true);setMessage('');
  try{await task();await load();}catch(e){setMessage(e.message||'Operação não concluída.');}finally{setBusy(false);}
 }
 async function saveVehicle(event){
  event.preventDefault();
  await transact(async()=>{
   const {empresaId}=await admin();
   const plate=plateKey(vehicle.placa);
   if(!validPlate(plate))throw Error('Informe uma placa brasileira válida, com sete caracteres.');
   const body={empresa_id:empresaId,placa:plate,tipo:vehicle.tipo,
     marca_modelo:vehicle.marca_modelo.trim()||null,
     capacidade_kg:vehicle.capacidade_kg?Number(vehicle.capacidade_kg):null,
     proprietario_nome:vehicle.proprietario_nome.trim()||null,
     proprietario_documento:onlyDigits(vehicle.proprietario_documento)||null,
     crlv_referencia:vehicle.crlv_referencia.trim()||null};
   if(body.capacidade_kg!==null&&!(body.capacidade_kg>0))throw Error('Informe uma capacidade positiva.');
   const result=await supabase.from('fc_veiculos').insert(body).select('id').single();
   if(result.error)throw Error(result.error.code==='23505'?'Esta placa já existe no cadastro de veículos. Não a duplique.':result.error.message);
   setVehicle(initialVehicle);setMessage('Veículo cadastrado separado dos motoristas. Nenhum vínculo criado automaticamente.');
  });
 }
 async function saveCarrier(event){
  event.preventDefault();
  await transact(async()=>{
   const {empresaId}=await admin();
   const cnpj=onlyDigits(carrier.cnpj);
   if(cnpj&&cnpj.length!==14)throw Error('CNPJ da transportadora precisa ter 14 dígitos.');
   if(carrier.razao_social.trim().length<2)throw Error('Informe o nome ou razão social.');
   const result=await supabase.from('fc_transportadoras').insert({
    empresa_id:empresaId,razao_social:carrier.razao_social.trim().toUpperCase(),
    nome_fantasia:carrier.nome_fantasia.trim()||null,cnpj:cnpj||null,whatsapp:onlyDigits(carrier.whatsapp)||null
   }).select('id').single();
   if(result.error)throw Error(result.error.code==='23505'?'Transportadora já cadastrada para essa empresa.':result.error.message);
   setCarrier(initialCarrier);setMessage('Transportadora cadastrada independentemente de motoristas e veículos.');
  });
 }
 async function linkDriver(event){
  event.preventDefault();
  await transact(async()=>{
   const {empresaId,userId}=await admin();
   const check=canLink({links,vehicleId:choice.veiculo_id,driverId:choice.motorista_operacional_id,drivers:allDrivers,vehicles});
   if(!check.ok)throw Error(check.reason);
   if(choice.transportadora_id&&!carriers.some(c=>c.id===choice.transportadora_id&&c.ativo!==false))
    throw Error('Transportadora inativa ou não encontrada.');
   const result=await supabase.from('fc_frota_vinculos').insert({
    empresa_id:empresaId,motorista_operacional_id:choice.motorista_operacional_id,
    veiculo_id:choice.veiculo_id,transportadora_id:choice.transportadora_id||null,
    vinculado_por:userId,observacao:choice.observacao.trim()||null
   }).select('id').single();
   if(result.error)throw Error(result.error.code==='23505'?'Veículo já vinculado por outro usuário. Atualize a lista antes de tentar.':result.error.message);
   setChoice({motorista_operacional_id:'',veiculo_id:'',transportadora_id:'',observacao:''});
   setMessage('Vínculo cadastral registrado. Documentação e autorização de transporte permanecem separadas.');
  });
 }
 async function unlinkDriver(id){
  if(!globalThis.confirm?.('Desvincular este motorista do veículo? O vínculo antigo será mantido no histórico.'))return;
  await transact(async()=>{
   const {userId}=await admin();
   const result=await supabase.from('fc_frota_vinculos')
    .update({fim_em:new Date().toISOString(),desvinculado_por:userId})
    .eq('id',id).is('fim_em',null).select('id');
   if(result.error)throw Error(result.error.message);
   if(result.data?.length!==1)throw Error('O vínculo já foi encerrado ou não está acessível.');
   setMessage('Vínculo encerrado. Motorista e veículo continuam cadastrados e o histórico foi preservado.');
  });
 }
 return <section className="ft-fleet-manager" aria-label="Cadastros independentes e vínculos da frota">
  <p role="status">{message}</p>
  {loading&&<p>Consultando frota…</p>}
  {mode==='cadastros'&&<>
   <h3>Veículos — cadastro independente</h3>
   <p>Uma única ficha por placa. Cadastre cavalo, carreta ou semirreboque sem escolher motorista.</p>
   {isAdmin&&<form className="ft-fleet-form" onSubmit={saveVehicle}>
    <label>Placa<input required value={vehicle.placa} onChange={e=>setVehicle(v=>({...v,placa:e.target.value}))} placeholder="AAA1B23" maxLength={8}/></label>
    <label>Tipo<select value={vehicle.tipo} onChange={e=>setVehicle(v=>({...v,tipo:e.target.value}))}>{['CAVALO MECÂNICO','CAMINHÃO','SEMIRREBOQUE','REBOQUE','BITREM','RODOTREM','OUTRO'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Marca/modelo<input value={vehicle.marca_modelo} onChange={e=>setVehicle(v=>({...v,marca_modelo:e.target.value}))}/></label>
    <label>Capacidade (kg)<input type="number" min="1" value={vehicle.capacidade_kg} onChange={e=>setVehicle(v=>({...v,capacidade_kg:e.target.value}))}/></label>
    <label>Proprietário<input value={vehicle.proprietario_nome} onChange={e=>setVehicle(v=>({...v,proprietario_nome:e.target.value}))}/></label>
    <label>CPF/CNPJ proprietário<input value={vehicle.proprietario_documento} onChange={e=>setVehicle(v=>({...v,proprietario_documento:e.target.value}))}/></label>
    <label>Referência CRLV<input value={vehicle.crlv_referencia} onChange={e=>setVehicle(v=>({...v,crlv_referencia:e.target.value}))}/></label>
    <button type="submit" disabled={busy}>CADASTRAR VEÍCULO</button>
   </form>}
   <div className="ft-fleet-items">{vehicles.map(v=><article key={v.id}><b>{v.placa}</b> · {v.tipo}<small>{v.proprietario_nome||'Proprietário a conferir'} · {v.capacidade_kg?Number(v.capacidade_kg).toLocaleString('pt-BR')+' kg':'Capacidade a conferir'}</small></article>)}</div>
   <h3>Transportadoras — cadastro independente</h3>
   {isAdmin&&<form className="ft-fleet-form" onSubmit={saveCarrier}>
    <label>Razão social/nome<input required value={carrier.razao_social} onChange={e=>setCarrier(c=>({...c,razao_social:e.target.value}))}/></label>
    <label>Nome fantasia<input value={carrier.nome_fantasia} onChange={e=>setCarrier(c=>({...c,nome_fantasia:e.target.value}))}/></label>
    <label>CNPJ<input value={carrier.cnpj} onChange={e=>setCarrier(c=>({...c,cnpj:e.target.value}))}/></label>
    <label>WhatsApp<input value={carrier.whatsapp} onChange={e=>setCarrier(c=>({...c,whatsapp:e.target.value}))}/></label>
    <button type="submit" disabled={busy}>CADASTRAR TRANSPORTADORA</button>
   </form>}
   <div className="ft-fleet-items">{carriers.map(c=><article key={c.id}><b>{c.nome_fantasia||c.razao_social}</b><small>{c.razao_social}</small></article>)}</div>
  </>}
  {mode==='vinculos'&&<>
   <h3>Vincular motorista + veículo + transportadora</h3>
   <p>O vínculo é feito manualmente e pode ser encerrado sem apagar nenhum cadastro. Um veículo tem somente um vínculo ativo por vez; pode ter vários motoristas no histórico.</p>
   {isAdmin&&<form className="ft-fleet-form" onSubmit={linkDriver}>
    <label>Motorista<select required value={choice.motorista_operacional_id} onChange={e=>setChoice(v=>({...v,motorista_operacional_id:e.target.value}))}>
     <option value="">Selecione motorista cadastrado</option>
     {allDrivers.map(d=><option key={d.id} value={d.id}>{d.nome}{d.ativo===false?' · pré-cadastro/inativo':''}</option>)}
    </select></label>
    <label>Veículo<select required value={choice.veiculo_id} onChange={e=>setChoice(v=>({...v,veiculo_id:e.target.value}))}>
     <option value="">Selecione uma placa</option>
     {vehicles.filter(v=>v.ativo!==false).map(v=><option key={v.id} value={v.id}>{v.placa} · {v.tipo}{current.some(l=>l.veiculo_id===v.id)?' · vinculado':''}</option>)}
    </select></label>
    <label>Transportadora<select value={choice.transportadora_id} onChange={e=>setChoice(v=>({...v,transportadora_id:e.target.value}))}>
     <option value="">Sem transportadora informada (conferir)</option>
     {carriers.filter(c=>c.ativo!==false).map(c=><option key={c.id} value={c.id}>{c.nome_fantasia||c.razao_social}</option>)}
    </select></label>
    <label>Observação<input value={choice.observacao} onChange={e=>setChoice(v=>({...v,observacao:e.target.value}))} placeholder="Ex.: substituição de motorista"/></label>
    <button type="submit" disabled={busy}>VINCULAR MANUALMENTE</button>
   </form>}
   <h3>Vínculos atuais ({current.length})</h3>
   <div className="ft-fleet-items">{current.map(l=><article key={l.id}>
    <b>{driverName(allDrivers,l.motorista_operacional_id)}</b>
    <span>{vehicleById.get(l.veiculo_id)?.placa||'Veículo não encontrado'} · {carrierById.get(l.transportadora_id)?.razao_social||'Transportadora não informada'}</span>
    <small>Vinculado: {pretty(l.inicio_em)} · não é liberação para expedição</small>
    {isAdmin&&<button type="button" onClick={()=>unlinkDriver(l.id)} disabled={busy}>DESVINCULAR E MANTER HISTÓRICO</button>}
   </article>)}</div>
   {current.length===0&&<p>Nenhum vínculo ativo. O sistema não escolherá motorista automaticamente pela placa.</p>}
   <h3>Histórico de vínculos ({history.length})</h3>
   <div className="ft-fleet-items">{history.map(l=><article key={l.id}>
    <b>{driverName(allDrivers,l.motorista_operacional_id)}</b>
    <span>{vehicleById.get(l.veiculo_id)?.placa||'Veículo não encontrado'} · {carrierById.get(l.transportadora_id)?.razao_social||'Sem transportadora'}</span>
    <small>{pretty(l.inicio_em)} até {pretty(l.fim_em)}</small>
   </article>)}</div>
  </>}
 </section>;
}
