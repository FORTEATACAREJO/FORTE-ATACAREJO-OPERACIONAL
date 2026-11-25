import {useState} from 'react';
import {supabase} from './supabase.js';

const digits=value=>String(value||'').replace(/\D/g,'');
const initial=driver=>({
 cpf:digits(driver.cpf),cnhNumero:digits(driver.cnhNumero||driver.cnh),
 cnhCategoria:String(driver.cnhCategoria||driver.categoria_cnh||'').toUpperCase(),
 cnhValidade:String(driver.cnhValidade||driver.validade_cnh||'').slice(0,10),
 telefone:digits(driver.telefone||driver.whatsapp)
});
export default function OperationalDriverApproval({driver,onCancel,onSaved}){
 const [form,setForm]=useState(()=>initial(driver));
 const [reference,setReference]=useState('');
 const [checked,setChecked]=useState(false),[responsible,setResponsible]=useState(false);
 const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const patch=(key,value)=>setForm(f=>({...f,[key]:value}));
 async function submit(approve){
  setBusy(true);setFeedback('');
  try{
   if(!supabase)throw Error('Conexão ao FORTE OP indisponível.');
   if(!form.cpf||!form.cnhNumero||!form.cnhCategoria ) {
    if(approve)throw Error('Complete CPF, CNH e categoria para aprovar.');
   }
   if(approve&&(!checked||!responsible))
    throw Error('Confirme a conferência documental e sua responsabilidade antes de habilitar.');
   const {data,error}=await supabase.functions.invoke('orders-workflow',{
    body:{
     action:'DRIVER_REVIEW',requestId:crypto.randomUUID(),motoristaId:driver.id,
     ...form,aprovar:approve,documentosConferidos:checked,
     confirmacaoResponsavel:responsible,referenciaConferencia:reference.trim().length>=5?reference.trim():approve?'Confirmação documental registrada pelo responsável autenticado no PEDIDOS FT.':reference.trim()
    }
   });
   if(error||data?.error)throw Error(data?.error||error.message);
   setFeedback(data?.warning||'Alteração confirmada.');
   await onSaved?.(data);
  }catch(e){setFeedback(e.message||'Não foi possível salvar a conferência.');}
  finally{setBusy(false);}
 }
 const fields=[
  ['cpf','CPF','text','00000000000'],['cnhNumero','Registro da CNH','text','11 dígitos'],
  ['cnhCategoria','Categoria da CNH','text','C, D, E, AC, AD ou AE'],
  ['cnhValidade','Validade da CNH (opcional no cadastro)','date',''],['telefone','Telefone com DDD','tel','']
 ];
 return <section className="ft-driver-review" aria-label={'Conferir e habilitar '+driver.nome}>
  <h3>Conferir e habilitar motorista</h3>
  <p><strong>{driver.nome}</strong> · {driver.documentosConferidos?'Habilitado':driver.cadastroAdministrativoLiberado?'Cadastro ativo — documentos a conferir':'Pendente de aprovação'}</p>
  <p>Confira os dados da pessoa antes de habilitar. O veículo e a transportadora são vinculados separadamente na aba Veículos.</p>
  <div className="ft-driver-review-grid">
   {fields.map(([name,label,type,placeholder])=><label key={name}>{label}
    <input aria-label={label} type={type} placeholder={placeholder} value={form[name]||''}
     onChange={e=>patch(name,e.target.value)} disabled={busy}/>
   </label>)}
  </div>
  <label>Observação da conferência (opcional)
   <textarea aria-label="Referência da conferência documental" rows={2} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Observação adicional, se necessário" disabled={busy}/>
  </label>
  <label className="ft-driver-review-check"><input type="checkbox" checked={checked} disabled={busy}
   onChange={e=>setChecked(e.target.checked)}/> Conferi a CNH original e confirmei que está vigente e que a categoria é compatível com o veículo. A data pode ficar em branco.</label>
  <label className="ft-driver-review-check"><input type="checkbox" checked={responsible} disabled={busy}
   onChange={e=>setResponsible(e.target.checked)}/> Confirmo como responsável que os documentos foram efetivamente verificados.</label>
  <p>O cadastro pode ser ativo sem data de validade informada. A habilitação para transporte exige conferência real por Master/Administrador. Sem vínculo de veículo, não será possível emitir ordem de carregamento.</p>
  <p className="ft-hint">Ao marcar as duas confirmações, a habilitação fica disponível. O sistema registra automaticamente o responsável e a data; a observação é opcional.</p>
  {feedback&&<p role="alert" className="ft-driver-review-feedback">{feedback}</p>}
  <div className="ft-driver-review-actions">
   <button type="button" disabled={busy} onClick={()=>submit(false)}>SALVAR DADOS CADASTRAIS</button>
   <button type="button" disabled={busy||!checked||!responsible} onClick={()=>submit(true)}>CONFIRMAR E HABILITAR MOTORISTA</button>
   <button type="button" disabled={busy} onClick={onCancel}>VOLTAR AOS MOTORISTAS</button>
  </div>
 </section>;
}
