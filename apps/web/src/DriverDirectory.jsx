import {useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from './supabase.js';
import ForteOpMigrationAudit from './ForteOpMigrationAudit.jsx';
import {isDriverSelectable,isDriverDraftSelectable,driverRegistrationWarnings} from './pedidos-ft-drivers.mjs';
import FleetLinkManager from './FleetLinkManager.jsx';
import OperationalDriverApproval from './OperationalDriverApproval.jsx';
import './driver-directory-mobile.css';

const EMPTY={nome:'',cpf:'',whatsapp:'',email:'',cnh:'',categoria_cnh:'',validade_cnh:'',rntrc:'',proprietario_nome:'',proprietario_documento:'',chave_pix:'',favorecido_pix:'',capacidade_operacional_kg:''};
const digits=value=>String(value||'').replace(/\D/g,'');
const legacyForm=source=>({
 nome:source.nome||'',cpf:digits(source.cpf||''),whatsapp:digits(source.telefone||source.whatsapp||''),
 email:source.email||'',cnh:digits(source.cnh_registro||source.cnh||''),categoria_cnh:source.categoria_cnh||'',
 validade_cnh:source.validade_cnh||'',rntrc:source.rntrc||'',proprietario_nome:source.proprietario_nome||'',
 proprietario_documento:digits(source.proprietario_documento||source.proprietario_cpf_cnpj||''),chave_pix:source.chave_pix||'',
 favorecido_pix:source.favorecido_pix||source.titular_pix||'',capacidade_operacional_kg:source.capacidade_operacional_kg??''
});
const cpfValido=value=>{
 const d=digits(value);
 if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
 const dig=n=>{let t=0;for(let i=0;i<n;i++)t+=Number(d[i])*(n+1-i);const r=t*10%11;return r===10?0:r};
 return dig(9)===Number(d[9])&&dig(10)===Number(d[10]);
};
const maskCpf=value=>{const d=digits(value);return d.length===11?`***.${d.slice(3,6)}.${d.slice(6,9)}-**`:'PENDENTE';};

export default function DriverDirectory({data,onClose,onSync,onPick,isAdmin=false,onDataRefresh,forForm}){
 const [query,setQuery]=useState('');
 const [view,setView]=useState('motoristas');
 const [reviewId,setReviewId]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [legacy,setLegacy]=useState([]),[existing,setExisting]=useState([]),[vehicles,setVehicles]=useState([]);
 const [selected,setSelected]=useState(null),[form,setForm]=useState(EMPTY),[editor,setEditor]=useState(false);
 const editorRef=useRef(null);
 useEffect(()=>{if(editor&&editorRef.current)editorRef.current.scrollIntoView({block:'start',behavior:'instant'});},[editor,selected]);
 const selectable=(forForm==='fornecedor'||forForm==='ordem')?isDriverDraftSelectable:isDriverSelectable;
 const operational=(data?.motoristas||[]).filter((m,i,all)=>!m.freteMotoristaId||all.findIndex(d=>d.freteMotoristaId===m.freteMotoristaId)===i);
 const rows=useMemo(()=>[...operational,...(existing||[]).filter(e=>!operational.some(m=>m.id===e.id||m.freteMotoristaId===e.id))]
  .filter(m=>(isAdmin||m.ativo!==false)&&[m.nome,m.cpf,m.cnh,m.cnhNumero].join(' ').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))),[existing,data,query,isAdmin]);
 const legacyRows=useMemo(()=>legacy.filter(l=>!existing.some(e=>e.id===l.id_origem)&&!(data?.motoristas||[]).some(m=>m.freteMotoristaId===l.id_origem||m.id===l.id_origem)).filter(l=>[l.dados?.nome,l.dados?.cpf,l.dados?.whatsapp].join(' ').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))),[legacy,query,existing,data]);
 const preApprovedLegacyIds=useMemo(()=>new Set((data?.preaprovacoesMotoristasLegados||[]).filter(x=>x.tipo==='PRE_APROVACAO_CADASTRAL').map(x=>x.sourceId)),[data?.preaprovacoesMotoristasLegados]);
 async function load(){
  if(!supabase)return;
  const [drivers,veiculos]=await Promise.all([
   supabase.from('fc_motoristas').select('id,nome,cpf,whatsapp,ativo,capacidade_operacional_kg,status_ia').order('nome').limit(150),
   supabase.from('fc_veiculos').select('id,placa,tipo,ativo').order('placa').limit(100)
  ]);
  if(drivers.error)throw new Error('Falha ao consultar motoristas do FORTE-OP: '+drivers.error.message);
  if(veiculos.error)throw new Error('Falha ao consultar veículos do FORTE-OP: '+veiculos.error.message);
  setExisting(drivers.data||[]);setVehicles(veiculos.data||[]);
  if(isAdmin){
   const stored=await supabase.from('forte_op_motoristas_pendentes')
    .select('source_id,nome,cpf,whatsapp,email,cnh,categoria_cnh,validade_cnh,rntrc,proprietario_nome,proprietario_documento,chave_pix,favorecido_pix,capacidade_operacional_kg,situacao,requisitos_pendentes,veiculo_origem_id')
    .order('nome').limit(150);
   if(stored.error)throw new Error('Falha ao carregar motoristas pendentes: '+stored.error.message);
   setLegacy((stored.data||[]).map(item=>({id_origem:item.source_id,dados:item,situacao:item.situacao,requisitos_pendentes:item.requisitos_pendentes||[]})));
  }
 }
 useEffect(()=>{let live=true;load().catch(e=>{if(live)setMessage(e.message)});return()=>{live=false}},[isAdmin]);
 async function refresh(){
  setBusy(true);try{await load();setMessage('Consulta de motoristas e veículos atualizada. Motoristas pendentes continuam indisponíveis para expedição.')}catch(e){setMessage(e.message||String(e))}finally{setBusy(false)}
 }
 function begin(row=null){
  setSelected(row?.id_origem||null);
  setForm(row?legacyForm(row.dados||{}):EMPTY);
  setEditor(true);setMessage('');
 }
 const patch=(name,value)=>setForm(f=>({...f,[name]:value}));
 async function saveDraft(){
  if(!isAdmin||!selected)return setMessage('Selecione um motorista migrado para salvar o rascunho.');
  setBusy(true);setMessage('');
  try{
   const user=await supabase.auth.getUser();
   if(user.error||!user.data.user)throw Error('Sessão expirada.');
   const grant=await supabase.rpc('access_current_module',{p_app:'vendas'});
   if(grant.error||!grant.data?.allowed||!grant.data?.isAdmin)throw Error('Revisão restrita à administração.');
   const capacity=Number(form.capacidade_operacional_kg);
   const missing=[
    !cpfValido(form.cpf)?'CPF':null,
    digits(form.cnh).length!==11?'CNH':null,
    digits(form.whatsapp).length<10?'WHATSAPP':null,
    !/^(A?[CDE])$/.test(form.categoria_cnh.trim().toUpperCase())?'CATEGORIA_CNH_COMPATIVEL':null,
    'DOCUMENTOS_NAO_CONFERIDOS','APROVACAO_ADMINISTRATIVA'
   ].filter(Boolean);
   const payload={
    nome:form.nome.trim(),cpf:digits(form.cpf)||null,whatsapp:digits(form.whatsapp)||null,
    email:form.email.trim()||null,cnh:digits(form.cnh)||null,
    categoria_cnh:form.categoria_cnh.trim()||null,validade_cnh:form.validade_cnh||null,
    rntrc:form.rntrc.trim()||null,proprietario_nome:form.proprietario_nome.trim()||null,
    proprietario_documento:digits(form.proprietario_documento)||null,
    chave_pix:form.chave_pix.trim()||null,favorecido_pix:form.favorecido_pix.trim()||null,
    capacidade_operacional_kg:capacity>0?capacity:null,requisitos_pendentes:missing,
    revisado_por:user.data.user.id,revisado_em:new Date().toISOString(),updated_at:new Date().toISOString()
   };
   if(!payload.nome)throw Error('O nome do motorista é obrigatório.');
   const {data:updated,error}=await supabase.from('forte_op_motoristas_pendentes')
    .update(payload).eq('source_id',selected).eq('situacao','PENDENTE_DOCUMENTOS')
    .select('source_id').maybeSingle();
   if(error)throw Error(error.message);
   if(!updated)throw Error('Cadastro não está pendente ou usuário sem permissão.');
   setMessage('Rascunho salvo sem ativar motorista. Pendências: '+missing.length+'.');
   await load();
  }catch(e){setMessage(e.message||'Erro ao salvar rascunho.');}finally{setBusy(false)}
 }
 async function save(event){
  event.preventDefault();
  if(!isAdmin)return setMessage('Somente Master ou Administrador pode cadastrar motorista.');
  if(form.cpf.trim()&&!cpfValido(form.cpf))return setMessage('CPF informado inválido. Corrija ou deixe pendente.');
  if(form.whatsapp.trim()&&digits(form.whatsapp).length<10)return setMessage('WhatsApp informado deve conter DDD.');
  if(form.cnh.trim()&&digits(form.cnh).length!==11)return setMessage('CNH informada deve ter 11 dígitos.');
  if(!form.nome.trim())return setMessage('Informe o nome do motorista.');
  setBusy(true);setMessage('');
  try{
   const user=await supabase.auth.getUser();
   if(user.error||!user.data.user)throw Error('Sessão expirada.');
   const [profile,grant]=await Promise.all([
    supabase.from('fc_perfis').select('empresa_id').eq('user_id',user.data.user.id).maybeSingle(),
    supabase.rpc('access_current_module',{p_app:'vendas'})
   ]);
   if(profile.error||!profile.data?.empresa_id)throw Error('Empresa do usuário não identificada.');
   if(grant.error||!grant.data?.allowed||!grant.data?.isAdmin)throw Error('Cadastro restrito a Master ou Administrador aprovado.');
   const payload={
    ...(selected?{id:selected}:{}),empresa_id:profile.data.empresa_id,
    nome:form.nome.trim().toUpperCase(),cpf:digits(form.cpf)||null,whatsapp:digits(form.whatsapp)||null,
    cnh:digits(form.cnh)||null,email:form.email.trim()||null,categoria_cnh:form.categoria_cnh.trim()||null,
    validade_cnh:form.validade_cnh||null,rntrc:form.rntrc.trim()||null,
    proprietario_nome:form.proprietario_nome.trim().toUpperCase()||null,proprietario_documento:digits(form.proprietario_documento)||null,
    chave_pix:form.chave_pix.trim()||null,favorecido_pix:form.favorecido_pix.trim().toUpperCase()||null,
    capacidade_operacional_kg:Number(form.capacidade_operacional_kg)>0?Number(form.capacidade_operacional_kg):null,
    status_ia:'PENDENTE_CONFERENCIA_DOCUMENTAL',ativo:false
   };
   const result=await supabase.from('fc_motoristas').insert(payload).select('id').single();
   if(result.error)throw Error(result.error.code==='23505'?'Motorista já registrado; confira os dados existentes.':result.error.message);
   let note='Motorista cadastrado como INATIVO, independente do veículo. A conferência documental e o vínculo manual serão feitos posteriormente.';
   if(selected){
    const marked=await supabase.from('forte_op_motoristas_pendentes')
      .update({situacao:'CADASTRO_INATIVO',revisado_por:user.data.user.id,revisado_em:new Date().toISOString(),updated_at:new Date().toISOString()})
      .eq('source_id',selected);
    if(marked.error)note+=' Atenção: o status do histórico precisa ser conferido.';
   }
   setMessage(note);
   setEditor(false);setSelected(null);setForm(EMPTY);await load();
  }catch(e){setMessage(e.message||'Não foi possível gravar.')}finally{setBusy(false)}
 }
 const fields=[
  ['nome','Nome completo',true],['cpf','CPF',false],['whatsapp','WhatsApp com DDD',false],
  ['cnh','Registro CNH (11 dígitos)',false],['categoria_cnh','Categoria CNH',false],
  ['validade_cnh','Validade CNH (opcional)',false,'date'],['email','E-mail',false,'email'],
  ...(selected?[
   ['proprietario_nome','Proprietário (histórico)',false],
   ['proprietario_documento','Documento proprietário (histórico)',false],
   ['chave_pix','Chave Pix (histórico)',false],['favorecido_pix','Favorecido Pix (histórico)',false],
   ['capacidade_operacional_kg','Capacidade (histórico)',false,'number']
  ]:[])
 ];
 return <div className="modalBackdrop ft-driver-backdrop"><section className="modal wide ft-driver-dialog" role="dialog" aria-modal="true" aria-label="Motoristas FORTE-OP">
 <div className="modalHead ft-driver-head"><h2>MOTORISTAS — PEDIDOS FT</h2><button type="button" onClick={onClose}>← VOLTAR AO PEDIDO</button></div>
 <p>Cadastro e consulta no próprio FORTE-OP, sem abrir outro aplicativo. Os dados anteriores permanecem preservados para revisão.</p>
 <div className="rowActions">
 <button type="button" disabled={busy} onClick={refresh}>ATUALIZAR DADOS</button>
 {isAdmin&&<button type="button" disabled={busy} onClick={()=>begin()}>+ CADASTRAR MOTORISTA</button>}
 </div>
 <p role="status" aria-live="polite">{message}</p>
 <nav className="ft-fleet-nav" aria-label="Cadastros e vínculos da frota">{[['motoristas','Motoristas'],['veiculos','Veículos']].map(([id,label])=><button key={id} type="button" aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</nav>
 {view==='motoristas'&&<>
 <p><b>Motoristas operacionais:</b> {existing.length} · <b>Veículos cadastrados:</b> {vehicles.length} · <b>Cadastros históricos:</b> {isAdmin?legacy.length:'restritos à administração'} · <b>Pré-aprovados pelo gestor:</b> {(data?.motoristas||[]).filter(m=>m.preAprovadoCadastro).length} operacionais e {preApprovedLegacyIds.size} históricos.</p>
 {onPick&&!(data?.motoristas||[]).some(selectable)&&<p role="status">Nenhum motorista ativo e aprovado para selecionar. Consulte as pendências documentais; os registros inativos continuam apenas para conferência. Sincronize o Forte Frete após a aprovação.</p>}
 {onPick&&onSync&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);setMessage('Conferindo motoristas do Forte Frete…');try{const result=await onSync();await load();setMessage('Sincronização concluída. '+(result?.count??'Os')+' registro(s) consultados; a seleção exige ativação e aprovação operacional.');}catch(e){setMessage(e.message||'Falha na sincronização. Nenhum motorista foi liberado.');}finally{setBusy(false);}}}>SINCRONIZAR MOTORISTAS APROVADOS</button>}
 <label className="ft-driver-search">BUSCAR MOTORISTA<input aria-label="Buscar motorista pelo nome ou CPF" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Digite nome ou CPF"/></label>
 <h3 className="ft-driver-section-title">Motoristas do cadastro operacional ({rows.length})</h3>
 <div className="ft-driver-cards">{rows.map(m=><article className="ft-driver-card" key={m.id}>
  <strong className="ft-driver-name">{m.nome||'NOME NÃO INFORMADO'}</strong>
  <span>CPF: {maskCpf(m.cpf)} · CNH: {m.cnh||m.cnhNumero?'Informada':'A conferir'}</span>
  
  <span className="ft-driver-status">{isDriverSelectable(m)?'APTO PARA EXPEDIÇÃO':m.cadastroAdministrativoLiberado?'CADASTRO ATIVO · DOCUMENTOS A CONFERIR':m.preAprovadoCadastro||((data?.motoristas||[]).find(d=>d.id===m.id)?.preAprovadoCadastro)?'PRÉ-APROVADO CADASTRAL · DOCUMENTOS A CONFERIR':'INATIVO — NECESSITA APROVAÇÃO'}</span>
  {driverRegistrationWarnings(m).length>0&&<p className="ft-driver-status" role="status">Avisos: {driverRegistrationWarnings(m).join(' • ')}</p>}
  {isAdmin&&(data?.motoristas||[]).some(d=>d.id===m.id)&&<button type="button" className="ft-driver-approve-button" disabled={busy} onClick={()=>setReviewId(old=>old===m.id?'':m.id)}>{reviewId===m.id?'FECHAR CONFERÊNCIA':isDriverSelectable((data?.motoristas||[]).find(d=>d.id===m.id))?'REVISAR DOCUMENTOS':'CONFERIR / LIBERAR MOTORISTA'}</button>}
  {reviewId===m.id&&<OperationalDriverApproval driver={(data?.motoristas||[]).find(d=>d.id===m.id)||m} onCancel={()=>setReviewId('')} onSaved={async result=>{setMessage(result?.warning||'Conferência gravada.');if(onDataRefresh)await onDataRefresh();setReviewId('');}}/>}
  {onPick&&(selectable((data?.motoristas||[]).find(d=>d.id===m.id))
    ?<button type="button" disabled={busy} onClick={()=>onPick(m.id)}>SELECIONAR PARA O PEDIDO</button>
    :<small>Cadastro disponível para conferência. Não habilitado para emissão de ordem.</small>)}
 </article>)}</div>
 {rows.length===0&&<p role="status">Nenhum motorista do cadastro operacional corresponde à busca.</p>}
 {isAdmin&&<section className="ft-driver-legacy"><h3 className="ft-driver-section-title">Cadastros antigos para regularizar ({legacyRows.length})</h3>
 <p>Histórico sem duplicar motoristas já cadastrados. Dados complementares serão tratados como avisos. A expedição real exige habilitação e conjunto conferidos.</p>
 {editor&&<p role="status">Formulário de conferência aberto logo abaixo, antes da lista de nomes.</p>}
 </section>}
 {isAdmin&&editor&&<form ref={editorRef} className="ft-driver-form" onSubmit={save} style={{display:'grid',gap:12,marginTop:16}}>
 <h3>{selected?'Conferir motorista antigo':'Cadastrar motorista independente'}</h3><p>O motorista não precisa ter veículo, transportadora ou Pix para ser cadastrado. Documentos serão conferidos antes da expedição.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}>
 {fields.map(([field,label,required,type])=><label key={field} style={{display:'grid',gap:4}}>{label}
 <input type={type||'text'} required={required} min={type==='number'?1:undefined} step={type==='number'?'any':undefined} value={form[field]||''} onChange={e=>patch(field,e.target.value)}/></label>)}
 </div><p>O cadastro será gravado como <b>INATIVO</b> até conferência documental e aprovação administrativa.</p>
 <div className="rowActions"><button type="submit" disabled={busy}>GERAR CADASTRO INATIVO</button>{selected&&<button type="button" disabled={busy} onClick={saveDraft}>SALVAR RASCUNHO SEM ATIVAR</button>}<button type="button" onClick={()=>setEditor(false)}>CANCELAR</button></div></form>}
 {isAdmin&&<section className="ft-driver-legacy-list"><div className="ft-driver-cards">{legacyRows.map(l=><article className="ft-driver-card" key={l.id_origem}>
  <strong className="ft-driver-name">{l.dados?.nome||'NOME NÃO INFORMADO'}</strong>
  <span>CPF: {maskCpf(l.dados?.cpf)} · CNH: {digits(l.dados?.cnh).length===11?'Informada':'Pendente'}</span>
  
  <span className="ft-driver-status">{preApprovedLegacyIds.has(String(l.id_origem))?'PRÉ-APROVADO CADASTRAL · CONFERIR DOCUMENTOS':'DOCUMENTAÇÃO A CONFERIR'} ({l.requisitos_pendentes?.length||0} itens)</span>
  {existing.some(e=>e.id===l.id_origem)?<small>Cadastro inativo já criado</small>:<button type="button" disabled={busy} onClick={()=>begin(l)}>CONFERIR CADASTRO</button>}
 </article>)}</div>
 {legacyRows.length===0&&<p>Nenhum cadastro antigo corresponde à busca.</p>}</section>}
  {isAdmin&&<ForteOpMigrationAudit/>}
 </>}
 {view==='veiculos'&&<FleetLinkManager drivers={data?.motoristas||[]} isAdmin={isAdmin}/>}
 </section></div>;
}
