import {lazy,Suspense,useEffect,useState} from 'react';
import SupplierProductCatalog,{validSupplierCatalog} from './SupplierProductCatalog.jsx';
import SupplierBuyerCodes from './SupplierBuyerCodes.jsx';
import SupplierPaymentPreferences from './SupplierPaymentPreferences.jsx';
import {supplierWithSelectedTerms,supplierSelectedDueDays,supplierRegisteredTerms,formatSupplierDueDays} from './supplier-terms-selection.mjs';
const DriverDirectory=lazy(()=>import('./DriverDirectory.jsx'));
import {SUPPLIER_PALLET_OPTIONS} from './supplier-pallet-preferences.mjs';
import {customerAddressError,normalizeCustomerAddress,CUSTOMER_UFS} from './customer-address.js';
import './pedidos-ft-quick-registry.css';
import {customerDisplayName,customerMatches} from './customer-search.mjs';

const fields={
 fornecedores:[
  ['nome','Fornecedor / marca'],['razaoSocial','Razão social'],['cnpj','CNPJ'],['inscricaoEstadual','Inscrição estadual'],
  ['emailPedidos','E-mail para pedidos','email'],['whatsapp','WhatsApp'],['telefone','Telefone'],
  ['emailPallets','E-mail para liberação de paletes','email'],
  ['localCarregamentoPadrao','Local de carregamento padrão'],
  ['enderecoFiscal','Endereço fiscal'],['emailFiscal','E-mail fiscal','email'],['observacoesFiscais','Observações fiscais']
 ],
 clientes:[
  ['nome','Cliente / razão social'],['nomeFantasia','Nome fantasia'],['documento','CPF ou CNPJ'],
  ['inscricaoEstadual','Inscrição estadual'],['telefone','Telefone'],['whatsapp','WhatsApp'],['email','E-mail','email'],
  ['cep','CEP'],['logradouro','Logradouro'],['numero','Número'],['bairro','Bairro'],['cidade','Cidade'],
  ['contatoResponsavel','Contato responsável'],['condicaoPagamento','Prazo de pagamento'],['observacoes','Observações']
 ]
};
const labels={fornecedores:'Fornecedor',clientes:'Cliente',motoristas:'Motorista',usuarios:'Usuário'};
const digits=v=>String(v||'').replace(/\D/g,'');
const fieldValue=(row,key)=>row[key]??'';

export default function PedidosFTQuickRegistry({request,data,onSave,onClose,onSyncDrivers,onManageUsers,onPickDriver,onDataRefresh,onRegisterTerm,onChooseTerm}){
 const {kind,mode='view',id=''}=request;
 const collection=data[kind]||[];
 const [recordId,setRecordId]=useState(id);
 const [editing,setEditing]=useState(mode==='edit'||mode==='new');
 const selected=collection.find(r=>r.id===recordId);
 const [draft,setDraft]=useState(()=>mode==='new'?{ativo:true}:{...(selected||{})});
 const [error,setError]=useState('');
 const [recordQuery,setRecordQuery]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{const close=e=>{if(e.key==='Escape'&&!busy)onClose()};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose,busy]);
 function pick(row){setRecordId(row.id);setDraft(structuredClone(row));setEditing(false);setError('');setRecordQuery('');}
 function create(){setRecordId('');setDraft({ativo:true});setEditing(true);setError('');}
 function edit(){if(!selected)return;setDraft(structuredClone(selected));setEditing(true);setError('');}
 function setValue(key,value){setDraft(row=>({...row,[key]:value}));}
 async function save(e){
  e.preventDefault();
  if(!['fornecedores','clientes'].includes(kind))return;
  setError('');setBusy(true);
  try{
   if(!String(draft.nome||'').trim())throw Error('Informe o nome principal do cadastro.');
   let item={...draft,nome:String(draft.nome).trim(),ativo:draft.ativo!==false};
   if(kind==='fornecedores'){
    if(supplierSelectedDueDays(item).length===0)throw Error('Selecione pelo menos um prazo negociado (à vista ou um ou mais dias).');
    item={...item,prazosPagamento:[...supplierRegisteredTerms(selected||{}),...supplierRegisteredTerms(item)]};
    item=supplierWithSelectedTerms(item);
    if(!['CIF','FOB'].includes(item.modalidadeFrete))throw Error('Selecione CIF ou FOB.');
    if(!SUPPLIER_PALLET_OPTIONS.some(option=>option.value===item.condicaoPaletes))throw Error('Selecione a condição de paletes do fornecedor.');
    if(!validSupplierCatalog(item.produtosNegociados||[],data.produtos||[]))throw Error('Confira os produtos e os custos unitários negociados.');
    item.produtosNegociados=(item.produtosNegociados||[]).map(row=>({produtoId:row.produtoId,custoUnitario:Number(row.custoUnitario)}));
   }else{
    item=normalizeCustomerAddress(item);
    const err=customerAddressError(item);if(err)throw Error(err);
   }
   const key=kind==='clientes'?digits(item.documento):digits(item.cnpj);
   if(collection.some(r=>r.id!==recordId&&key&&digits(kind==='clientes'?r.documento:r.cnpj)===key))throw Error('Já existe outro cadastro com este CPF/CNPJ.');
   if(collection.some(r=>r.id!==recordId&&String(r.nome||'').trim().toLowerCase()===item.nome.toLowerCase()))throw Error('Já existe outro cadastro com este nome.');
   const savedId=recordId||'cad-'+crypto.randomUUID();
   await onSave(kind,{...item,id:savedId},selected||null);
   if(kind==='fornecedores'&&recordId&&item.condicaoPagamento!==formatSupplierDueDays(supplierSelectedDueDays(selected||{})))onChooseTerm?.(savedId,item.condicaoPagamento);
   onClose();
  }catch(err){setError(err.message||'Não foi possível salvar o cadastro.');}finally{setBusy(false);}
 }
 if(kind==='motoristas')return <Suspense fallback={<div role="status">Abrindo cadastro de motoristas…</div>}><DriverDirectory data={data} onClose={onClose} onSync={onSyncDrivers} onPick={id=>onPickDriver?.(id,request.forForm)} onDataRefresh={onDataRefresh} isAdmin/></Suspense>;
 if(kind==='usuarios')return <div className="ft-quick-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="ft-quick-modal" role="dialog" aria-modal="true" aria-label="Atalhos de usuários">
   <header><h2>Usuários e permissões</h2><button type="button" onClick={onClose}>← Voltar ao pedido</button></header>
   <p>As aprovações, convites e alterações de acesso são realizadas pelo cadastro administrativo, sem alterar a autenticação a partir do pedido.</p>
   <ul>{collection.filter(x=>x.ativo!==false).slice(0,25).map(x=><li key={x.id}>{x.nome} — {x.perfil||'Perfil a conferir'}</li>)}</ul>
   <button type="button" onClick={()=>{onClose();onManageUsers();}}>Abrir gestão de usuários</button>
  </section>
 </div>;
 return <div className="ft-quick-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
  <section className="ft-quick-modal" role="dialog" aria-modal="true" aria-label={'Cadastro rápido de '+labels[kind]}>
   <header><div><h2>{editing?(recordId?'Corrigir cadastro':'Novo cadastro'):'Consultar cadastro'} — {labels[kind]}</h2><p>Os campos já preenchidos no pedido serão mantidos.</p></div><button type="button" onClick={onClose} disabled={busy}>← Voltar ao pedido</button></header>
   {!recordId&&mode!=='new'&&!editing&&<label>Buscar {labels[kind].toLowerCase()}<input autoFocus placeholder={kind==='clientes'?'Nome fantasia, razão social ou CPF/CNPJ':'Digite o nome ou documento'} value={recordQuery} onChange={e=>setRecordQuery(e.target.value)}/></label>}
   {!recordId&&!editing&&<div className="ft-quick-list">{collection.filter(x=>x.ativo!==false&&(kind==='clientes'?customerMatches(x,recordQuery):[x.nome,x.razaoSocial,x.cnpj,x.documento].some(value=>String(value||'').toLocaleLowerCase('pt-BR').includes(recordQuery.trim().toLocaleLowerCase('pt-BR'))))).map(x=><button className="ft-quick-record" key={x.id} type="button" onClick={()=>pick(x)}>{kind==='clientes'?customerDisplayName(x):x.nome||x.razaoSocial||'Sem nome'}</button>)}</div>}
   {recordId&&!editing&&<div className="ft-quick-summary"><strong>{kind==='clientes'?customerDisplayName(selected||{}):selected?.nome||'Cadastro selecionado'}</strong><p>{selected?.cnpj||selected?.documento||''} · {selected?.telefone||selected?.whatsapp||''}</p><div className="ft-quick-actions"><button type="button" onClick={edit}>Editar cadastro</button><button type="button" onClick={create}>+ Novo</button><button type="button" className="secondary" onClick={()=>setRecordId('')}>Buscar outro</button></div></div>}
   {editing&&<form onSubmit={save}>
    <div className="ft-quick-grid">
     {(fields[kind]||[]).map(([key,label,type])=><label key={key}>{label}<input type={type||'text'} value={fieldValue(draft,key)} onChange={e=>setValue(key,e.target.value)}/></label>)}
     {kind==='clientes'&&<label>UF<select value={draft.uf||''} onChange={e=>setValue('uf',e.target.value)}><option value="">Selecione</option>{CUSTOMER_UFS.map(uf=><option key={uf}>{uf}</option>)}</select></label>}
     {kind==='fornecedores'&&<>
      <label>Frete CIF ou FOB<select value={draft.modalidadeFrete||''} onChange={e=>setValue('modalidadeFrete',e.target.value)}><option value="">Selecione</option><option value="CIF">CIF</option><option value="FOB">FOB</option></select></label>
      <label>Condição de paletes<select value={draft.condicaoPaletes||''} onChange={e=>setValue('condicaoPaletes',e.target.value)}><option value="">Selecione</option>{SUPPLIER_PALLET_OPTIONS.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select></label>
     </>}
    </div>
    {kind==='fornecedores'&&<>
      <SupplierBuyerCodes supplier={draft} units={data.unidades||[]} onChange={setDraft}/>
      <SupplierPaymentPreferences supplier={draft} registered={selected} onChange={setDraft} onRegisterTerm={term=>onRegisterTerm?.(selected?.id,term)} onChooseTerm={term=>onChooseTerm?.(selected?.id,term)}/>
      <SupplierProductCatalog supplier={draft} products={data.produtos||[]} onChange={setDraft}/>
    </>}
    {error&&<p className="ft-quick-error" role="alert">{error}</p>}
    <div className="ft-quick-actions"><button type="submit" disabled={busy}>{busy?'Gravando…':'Salvar e voltar ao pedido'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>recordId?(setEditing(false),setError('')):onClose()}>Cancelar</button></div>
   </form>}
   {!editing&&<div className="ft-quick-actions"><button type="button" className="secondary" onClick={create}>+ Novo {labels[kind]}</button></div>}
  </section>
 </div>;
}
