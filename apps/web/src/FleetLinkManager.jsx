import {useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase.js';
import {activeLink,canLink,driverName,plateKey,validPlate} from './frota-vinculos.mjs';
import './frota-vinculos.css';

const emptyVehicle={placa:'',tipo:'CAVALO MECÂNICO',marca_modelo:'',capacidade_kg:'',proprietario_nome:'',proprietario_documento:'',crlv_referencia:'',transportadora_nome:'',transportadora_cnpj:'',transportadora_whatsapp:''};
const emptyLink={motorista_operacional_id:'',veiculo_id:'',observacao:''};
const digits=v=>String(v||'').replace(/\D/g,'');
const pretty=v=>v?new Date(v).toLocaleString('pt-BR'):'';
const carrierLabel=(vehicle,link)=>link?.transportadora_nome_snapshot||vehicle?.transportadora_nome||'Transportadora não informada';

export default function FleetLinkManager({drivers=[],isAdmin=false}){
 const [vehicles,setVehicles]=useState([]),[links,setLinks]=useState([]),[registeredDrivers,setRegisteredDrivers]=useState([]);
 const [vehicle,setVehicle]=useState(emptyVehicle),[editingVehicleId,setEditingVehicleId]=useState('');
 const [choice,setChoice]=useState(emptyLink);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const allDrivers=useMemo(()=>[...new Map([...drivers,...registeredDrivers].map(d=>[d.id,d])).values()],[drivers,registeredDrivers]);
 const vehicleById=useMemo(()=>new Map(vehicles.map(v=>[v.id,v])),[vehicles]);
 const ordered=useMemo(()=>[...links].sort((a,b)=>String(b.inicio_em).localeCompare(String(a.inicio_em))),[links]);
 const current=ordered.filter(activeLink),history=ordered.filter(l=>!activeLink(l));
 async function load(){
  if(!supabase)throw Error('Supabase não configurado.');
  const [vr,lr,dr]=await Promise.all([
   supabase.from('fc_veiculos').select('id,empresa_id,placa,tipo,marca_modelo,capacidade_kg,proprietario_nome,proprietario_documento,crlv_referencia,transportadora_nome,transportadora_cnpj,transportadora_whatsapp,ativo').order('placa').limit(500),
   supabase.from('fc_frota_vinculos').select('id,empresa_id,motorista_operacional_id,veiculo_id,transportadora_nome_snapshot,transportadora_cnpj_snapshot,inicio_em,fim_em,observacao').order('inicio_em',{ascending:false}).limit(1000),
   supabase.from('fc_motoristas').select('id,nome,ativo').order('nome').limit(500)
  ]);
  for(const item of [vr,lr,dr])if(item.error)throw Error('Falha ao consultar veículos e vínculos: '+item.error.message);
  setVehicles(vr.data||[]);setLinks(lr.data||[]);setRegisteredDrivers(dr.data||[]);setLoading(false);
 }
 useEffect(()=>{let live=true;load().catch(e=>{if(live){setMessage(e.message);setLoading(false);}});return()=>{live=false;};},[]);
 async function admin(){
  if(!isAdmin)throw Error('Somente Master ou Administrador pode alterar cadastros.');
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
  try{const status=await task();await load();if(status)setMessage(status);}
  catch(e){setMessage(e.message||'Não foi possível concluir a operação.');}
  finally{setBusy(false);}
 }
 function editExisting(row){
  setEditingVehicleId(row.id);
  setVehicle(Object.fromEntries(Object.keys(emptyVehicle).map(key=>[key,String(row[key]??emptyVehicle[key])])));
  setMessage('Editando a placa '+row.placa+'. Os dados do motorista são independentes.');
 }
 function cancelEdit(){setEditingVehicleId('');setVehicle(emptyVehicle);}
 async function saveVehicle(event){
  event.preventDefault();
  await transact(async()=>{
   const {empresaId}=await admin();
   const plate=plateKey(vehicle.placa);
   if(!validPlate(plate))throw Error('Informe placa válida (sete caracteres).');
   const cnpj=digits(vehicle.transportadora_cnpj),whatsapp=digits(vehicle.transportadora_whatsapp);
   if(cnpj&&cnpj.length!==14)throw Error('CNPJ da transportadora deve ter 14 números.');
   if(whatsapp&&whatsapp.length<10)throw Error('WhatsApp da transportadora deve conter DDD.');
   const payload={
    empresa_id:empresaId,placa:plate,tipo:vehicle.tipo,
    marca_modelo:vehicle.marca_modelo.trim()||null,
    capacidade_kg:vehicle.capacidade_kg?Number(vehicle.capacidade_kg):null,
    proprietario_nome:vehicle.proprietario_nome.trim()||null,
    proprietario_documento:digits(vehicle.proprietario_documento)||null,
    crlv_referencia:vehicle.crlv_referencia.trim()||null,
    transportadora_nome:vehicle.transportadora_nome.trim()||null,
    transportadora_cnpj:cnpj||null,transportadora_whatsapp:whatsapp||null
   };
   if(payload.capacidade_kg!==null&&!(payload.capacidade_kg>0))throw Error('A capacidade deve ser positiva.');
   const request=editingVehicleId
    ?supabase.from('fc_veiculos').update(payload).eq('id',editingVehicleId).eq('empresa_id',empresaId)
    :supabase.from('fc_veiculos').insert(payload);
   const result=await request.select('id').single();
   if(result.error)throw Error(result.error.code==='23505'?'Placa já cadastrada. Utilize Editar veículo.':result.error.message);
   cancelEdit();
   return 'Ficha do veículo salva com a transportadora. Nenhum motorista foi vinculado automaticamente.';
  });
 }
 async function linkDriver(event){
  event.preventDefault();
  await transact(async()=>{
   const {empresaId,userId}=await admin();
   const check=canLink({links,vehicleId:choice.veiculo_id,driverId:choice.motorista_operacional_id,drivers:allDrivers,vehicles});
   if(!check.ok)throw Error(check.reason);
   const selectedVehicle=vehicles.find(v=>v.id===choice.veiculo_id);
   const result=await supabase.from('fc_frota_vinculos').insert({
    empresa_id:empresaId,motorista_operacional_id:choice.motorista_operacional_id,
    veiculo_id:choice.veiculo_id,transportadora_id:null,
    transportadora_nome_snapshot:selectedVehicle.transportadora_nome||null,
    transportadora_cnpj_snapshot:selectedVehicle.transportadora_cnpj||null,
    vinculado_por:userId,observacao:choice.observacao.trim()||null
   }).select('id').single();
   if(result.error)throw Error(result.error.code==='23505'?'O veículo já possui motorista vinculado. Atualize e confira o histórico.':result.error.message);
   setChoice(emptyLink);
   return 'Motorista vinculado ao veículo. A transportadora é a cadastrada na ficha do veículo. A liberação para transporte segue separada.';
  });
 }
 async function unlinkDriver(id){
  if(!globalThis.confirm?.('Desvincular o motorista do veículo? O histórico será preservado.'))return;
  await transact(async()=>{
   const {userId}=await admin();
   const result=await supabase.from('fc_frota_vinculos')
    .update({fim_em:new Date().toISOString(),desvinculado_por:userId})
    .eq('id',id).is('fim_em',null).select('id');
   if(result.error)throw Error(result.error.message);
   if(result.data?.length!==1)throw Error('Vínculo já encerrado ou não acessível.');
   return 'Vínculo encerrado. Motorista, veículo, transportadora e histórico foram preservados.';
  });
 }
 return <section className="ft-fleet-manager" aria-label="Veículos e vínculo de motoristas">
  <p role="status" aria-live="polite">{message}</p>
  {loading&&<p>Consultando veículos…</p>}
  <h3>Cadastro de veículos</h3>
  <p>O veículo é cadastrado por placa. <strong>Transportadora e proprietário ficam nesta mesma ficha</strong>; o motorista é escolhido separadamente.</p>
  {isAdmin&&<form className="ft-fleet-form" onSubmit={saveVehicle} aria-label="Cadastro do veículo com transportadora">
   <label>Placa<input required value={vehicle.placa} onChange={e=>setVehicle(v=>({...v,placa:e.target.value}))} placeholder="AAA1B23" maxLength={8}/></label>
   <label>Tipo<select value={vehicle.tipo} onChange={e=>setVehicle(v=>({...v,tipo:e.target.value}))}>{['CAVALO MECÂNICO','CAMINHÃO','SEMIRREBOQUE','REBOQUE','BITREM','RODOTREM','OUTRO'].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Marca/modelo<input value={vehicle.marca_modelo} onChange={e=>setVehicle(v=>({...v,marca_modelo:e.target.value}))}/></label>
   <label>Capacidade (kg)<input type="number" min="1" value={vehicle.capacidade_kg} onChange={e=>setVehicle(v=>({...v,capacidade_kg:e.target.value}))}/></label>
   <label>Proprietário do veículo<input value={vehicle.proprietario_nome} onChange={e=>setVehicle(v=>({...v,proprietario_nome:e.target.value}))}/></label>
   <label>CPF/CNPJ do proprietário<input value={vehicle.proprietario_documento} onChange={e=>setVehicle(v=>({...v,proprietario_documento:e.target.value}))}/></label>
   <label>Referência CRLV<input value={vehicle.crlv_referencia} onChange={e=>setVehicle(v=>({...v,crlv_referencia:e.target.value}))}/></label>
   <div className="ft-fleet-form-heading">Transportadora deste veículo</div>
   <label>Nome ou razão social<input value={vehicle.transportadora_nome} onChange={e=>setVehicle(v=>({...v,transportadora_nome:e.target.value}))} placeholder="Transportadora / proprietário transportador"/></label>
   <label>CNPJ<input value={vehicle.transportadora_cnpj} onChange={e=>setVehicle(v=>({...v,transportadora_cnpj:e.target.value}))}/></label>
   <label>WhatsApp da transportadora<input value={vehicle.transportadora_whatsapp} onChange={e=>setVehicle(v=>({...v,transportadora_whatsapp:e.target.value}))}/></label>
   <div className="ft-fleet-actions">
    <button type="submit" disabled={busy}>{editingVehicleId?'SALVAR ALTERAÇÕES DO VEÍCULO':'CADASTRAR VEÍCULO'}</button>
    {editingVehicleId&&<button type="button" disabled={busy} onClick={cancelEdit}>CANCELAR EDIÇÃO</button>}
   </div>
  </form>}
  <h3>Veículos cadastrados ({vehicles.length})</h3>
  <div className="ft-fleet-items">{vehicles.map(v=><article key={v.id}>
   <b>{v.placa} · {v.tipo}</b>
   <span>Transportadora: {v.transportadora_nome||'A preencher na ficha do veículo'}</span>
   <small>{v.proprietario_nome||'Proprietário a conferir'} · {v.capacidade_kg?Number(v.capacidade_kg).toLocaleString('pt-BR')+' kg':'Capacidade a conferir'}</small>
   {isAdmin&&<button type="button" disabled={busy} onClick={()=>editExisting(v)}>EDITAR VEÍCULO / TRANSPORTADORA</button>}
  </article>)}</div>
  <h3>Vincular motorista a um veículo</h3>
  <p>Selecione o motorista e a placa. O vínculo é manual; a transportadora é a informada no veículo. Desvincular não apaga cadastros nem históricos.</p>
  {isAdmin&&<form className="ft-fleet-form" onSubmit={linkDriver} aria-label="Vincular motorista a veículo">
   <label>Motorista<select required value={choice.motorista_operacional_id} onChange={e=>setChoice(v=>({...v,motorista_operacional_id:e.target.value}))}>
    <option value="">Selecione motorista cadastrado</option>
    {allDrivers.map(d=><option key={d.id} value={d.id}>{d.nome}{d.ativo===false?' · pré-cadastro/inativo':''}</option>)}
   </select></label>
   <label>Veículo<select required value={choice.veiculo_id} onChange={e=>setChoice(v=>({...v,veiculo_id:e.target.value}))}>
    <option value="">Selecione uma placa</option>
    {vehicles.filter(v=>v.ativo!==false).map(v=><option key={v.id} value={v.id}>{v.placa} · {v.tipo}{current.some(l=>l.veiculo_id===v.id)?' · já vinculado':''}</option>)}
   </select></label>
   <label>Transportadora do veículo<input readOnly value={vehicleById.get(choice.veiculo_id)?.transportadora_nome||'Não informada no veículo'} aria-label="Transportadora do veículo"/></label>
   <label>Observação<input value={choice.observacao} onChange={e=>setChoice(v=>({...v,observacao:e.target.value}))} placeholder="Ex.: substituição de motorista"/></label>
   <button type="submit" disabled={busy}>VINCULAR MOTORISTA</button>
  </form>}
  <h3>Vínculos atuais ({current.length})</h3>
  <div className="ft-fleet-items">{current.map(l=><article key={l.id}>
   <b>{driverName(allDrivers,l.motorista_operacional_id)}</b>
   <span>{vehicleById.get(l.veiculo_id)?.placa||'Veículo não encontrado'} · {carrierLabel(vehicleById.get(l.veiculo_id),l)}</span>
   <small>Vinculado em {pretty(l.inicio_em)}. Vínculo não autoriza expedição.</small>
   {isAdmin&&<button type="button" disabled={busy} onClick={()=>unlinkDriver(l.id)}>DESVINCULAR E MANTER HISTÓRICO</button>}
  </article>)}</div>
  {current.length===0&&<p>Nenhum motorista vinculado. Não haverá associação automática pela placa.</p>}
  <h3>Histórico de vínculos ({history.length})</h3>
  <div className="ft-fleet-items">{history.map(l=><article key={l.id}>
   <b>{driverName(allDrivers,l.motorista_operacional_id)}</b>
   <span>{vehicleById.get(l.veiculo_id)?.placa||'Veículo não encontrado'} · {carrierLabel(vehicleById.get(l.veiculo_id),l)}</span>
   <small>{pretty(l.inicio_em)} até {pretty(l.fim_em)}</small>
  </article>)}</div>
 </section>;
}
