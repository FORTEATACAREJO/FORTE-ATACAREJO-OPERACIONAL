import {useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase.js';
import ForteOpMigrationAudit from './ForteOpMigrationAudit.jsx';

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

export default function DriverDirectory({data,onClose,onSync,isAdmin=false}){
 const [query,setQuery]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [legacy,setLegacy]=useState([]),[existing,setExisting]=useState([]),[vehicles,setVehicles]=useState([]);
 const [selected,setSelected]=useState(null),[form,setForm]=useState(EMPTY),[editor,setEditor]=useState(false);
 const rows=useMemo(()=>[...(existing||[]),...(data?.motoristas||[]).filter(m=>!existing.some(e=>e.id===m.id))]
  .filter(m=>(isAdmin||m.ativo!==false)&&[m.nome,m.cpf,m.placa1,m.placa2].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))),[existing,data,query,isAdmin]);
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
  setBusy(true);try{await load();setMessage('Consulta de motoristas e veículos atualizada.')}catch(e){setMessage(e.message||String(e))}finally{setBusy(false)}
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
    !form.proprietario_nome.trim()?'PROPRIETARIO':null,
    !form.chave_pix.trim()?'PIX':null,
    !form.favorecido_pix.trim()?'FAVORECIDO_PIX':null,
    !(capacity>0)?'CAPACIDADE_OPERACIONAL':null,
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
  if(!cpfValido(form.cpf))return setMessage('Informe CPF válido.');
  if(digits(form.whatsapp).length<10)return setMessage('Informe WhatsApp com DDD.');
  if(digits(form.cnh).length!==11)return setMessage('Informe os 11 dígitos do registro CNH.');
  if(!form.nome.trim()||!form.proprietario_nome.trim()||!form.chave_pix.trim()||!form.favorecido_pix.trim()||!(Number(form.capacidade_operacional_kg)>0))
   return setMessage('Complete nome, proprietário, chave Pix, favorecido Pix e capacidade operacional positiva.');
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
    nome:form.nome.trim().toUpperCase(),cpf:digits(form.cpf),whatsapp:digits(form.whatsapp),
    cnh:digits(form.cnh),email:form.email.trim()||null,categoria_cnh:form.categoria_cnh.trim()||null,
    validade_cnh:form.validade_cnh||null,rntrc:form.rntrc.trim()||null,
    proprietario_nome:form.proprietario_nome.trim().toUpperCase(),proprietario_documento:digits(form.proprietario_documento)||null,
    chave_pix:form.chave_pix.trim(),favorecido_pix:form.favorecido_pix.trim().toUpperCase(),
    capacidade_operacional_kg:Number(form.capacidade_operacional_kg),
    status_ia:'PENDENTE_CONFERENCIA_DOCUMENTAL',ativo:false
   };
   const result=await supabase.from('fc_motoristas').insert(payload).select('id').single();
   if(result.error)throw Error(result.error.code==='23505'?'Motorista já registrado; confira os dados existentes.':result.error.message);
   let note='Cadastro inserido como INATIVO. Ativação somente após conferir CNH, documentos e conjunto.';
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
  ['nome','Nome completo',true],['cpf','CPF',true],['whatsapp','WhatsApp com DDD',true],
  ['cnh','Registro CNH (11 dígitos)',true],['categoria_cnh','Categoria CNH',false],
  ['validade_cnh','Validade CNH',false,'date'],['proprietario_nome','Nome do proprietário',true],
  ['proprietario_documento','CPF/CNPJ do proprietário',false],['chave_pix','Chave Pix',true],
  ['favorecido_pix','Favorecido Pix',true],['capacidade_operacional_kg','Capacidade operacional (kg)',true,'number'],
  ['rntrc','RNTRC',false],['email','E-mail',false,'email']
 ];
 return <div className="modalBackdrop"><section className="modal wide" role="dialog" aria-modal="true" aria-label="Motoristas FORTE-OP">
 <div className="modalHead"><h2>MOTORISTAS E VEÍCULOS — FORTE-OP</h2><button type="button" onClick={onClose}>FECHAR</button></div>
 <p>Cadastro e consulta no próprio FORTE-OP, sem abrir outro aplicativo. Os dados anteriores permanecem preservados para revisão.</p>
 <div className="rowActions">
 <button type="button" disabled={busy} onClick={refresh}>ATUALIZAR DADOS</button>
 {isAdmin&&<button type="button" disabled={busy} onClick={()=>begin()}>+ CADASTRAR MOTORISTA</button>}
 </div>
 <p role="status" aria-live="polite">{message}</p>
 <p><b>Motoristas operacionais:</b> {existing.length} · <b>Veículos cadastrados:</b> {vehicles.length} · <b>Registros antigos para conferência:</b> {isAdmin?legacy.length:'restritos à administração'}</p>
 <label>BUSCAR MOTORISTA<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, CPF ou placa"/></label>
 <div className="flowTable"><table><thead><tr><th>Motorista</th><th>CPF</th><th>Capacidade</th><th>Status</th></tr></thead>
 <tbody>{rows.map(m=><tr key={m.id}><td>{m.nome}</td><td>{maskCpf(m.cpf)}</td><td>{Number(m.capacidade_operacional_kg||m.capacidadeMaximaKg||0).toLocaleString('pt-BR')} kg</td><td>{m.ativo===false?'INATIVO — REVISÃO':'ATIVO'}</td></tr>)}</tbody></table></div>
 {isAdmin&&<section><h3>Legado preservado — completar somente com documentos reais</h3>
 <p>Os 23 cadastros antigos estão disponíveis para revisão no FORTE-OP e continuam inativos. Complete os dados reais, salve um rascunho e depois gere o cadastro definitivo inativo.</p>
 <div className="flowTable"><table><thead><tr><th>Nome original</th><th>CPF</th><th>CNH</th><th>Pendências</th><th>Situação</th><th>Ação</th></tr></thead>
 <tbody>{legacy.map(l=><tr key={l.id_origem}><td>{l.dados?.nome||'SEM NOME'}</td><td>{maskCpf(l.dados?.cpf)}</td><td>{digits(l.dados?.cnh).length===11?'Informada':'PENDENTE'}</td><td>{l.requisitos_pendentes?.length||0}</td><td>{l.situacao}</td>
 <td>{existing.some(e=>e.id===l.id_origem)?'CADASTRO INATIVO CRIADO':<button type="button" disabled={busy} onClick={()=>begin(l)}>CONFERIR E COMPLETAR</button>}</td></tr>)}</tbody></table></div></section>}
 {isAdmin&&editor&&<form onSubmit={save} style={{display:'grid',gap:12,marginTop:16}}>
 <h3>{selected?'Completar cadastro legado':'Novo cadastro'} — documento obrigatório</h3>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}>
 {fields.map(([field,label,required,type])=><label key={field} style={{display:'grid',gap:4}}>{label}
 <input type={type||'text'} required={required} min={type==='number'?1:undefined} step={type==='number'?'any':undefined} value={form[field]||''} onChange={e=>patch(field,e.target.value)}/></label>)}
 </div><p>O cadastro será gravado como <b>INATIVO</b> até conferência documental e aprovação administrativa.</p>
 <div className="rowActions"><button type="submit" disabled={busy}>GERAR CADASTRO INATIVO</button>{selected&&<button type="button" disabled={busy} onClick={saveDraft}>SALVAR RASCUNHO SEM ATIVAR</button>}<button type="button" onClick={()=>setEditor(false)}>CANCELAR</button></div></form>}
 {isAdmin&&<ForteOpMigrationAudit/>}
 </section></div>;
}
