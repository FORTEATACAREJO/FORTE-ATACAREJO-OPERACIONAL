import {paymentScheduleText} from '../../../supabase/functions/orders-workflow/supplier-payment-terms.mjs';
import {useEffect,useMemo,useRef,useState} from 'react';
import {buildPedidosFTDossier,pendingTypes,dossierPending} from './pedidos-ft-model.mjs';
import {loadReport} from './orders-reports';
import './pedidos-ft.css';
import PedidosFTLoadPanel from './PedidosFTLoadPanel.jsx';
import DriverIntake from './DriverIntake.jsx';
import {useForteLayer} from './use-forte-navigation.js';

const number=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const when=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
const text=v=>v===null||v===undefined||v===''?'Não informado':String(v);
const validMaster=user=>user?.master===true||String(user?.perfil||'').toUpperCase()==='MASTER';

function FtTitle({subtitle,heading}) {
 return <div className="ft-title">
  <img src="/icons/pedidos-ft-192.png" width="58" height="58" alt=""/>
  <div><h2 ref={heading} tabIndex={heading?-1:undefined}>PEDIDOS FT</h2><p>{subtitle}</p></div>
 </div>;
}
function FtOptions({onSelect}){
 const options=useRef(null);
 function select(view){
  options.current.open=false;
  onSelect(view);
 }
 return <details className="ft-options" ref={options} onKeyDown={event=>{
  if(event.key==='Escape'&&options.current.open){
   options.current.open=false;
   options.current.querySelector('summary').focus();
  }
 }}>
  <summary aria-label="Mais opções" className="ft-outline"><span aria-hidden="true">⋮</span></summary>
  <div className="ft-options-list">
   <button type="button" onClick={()=>select('cargas')}>Todas as cargas</button>
   <button type="button" onClick={()=>select('relatorios')}>Relatórios</button>
  </div>
 </details>;
}
function Panel({title,children,aside}){return <section id={/^\d\./.test(title)?'ft-campo-'+title.split('.')[0]:undefined} className="ft-card"><div className="ft-card-heading"><h3>{title}</h3>{aside}</div>{children}</section>;}
function Field({label,value}){return <div className="ft-field"><span>{label}</span><b>{text(value)}</b></div>;}
function Pill({children,tone='neutral'}){return <span className={'ft-pill ft-'+tone}>{children}</span>;}
function DocList({docs,onOpenDocument,onValidate}){return docs.length?<ul className="ft-doc-list">{docs.map((d,i)=><li key={d.id||i}><div><b>{d.categoria||'Documento'}</b><small>{d.filename||'Arquivo sem nome'} • {d.validationStatus||'Pendente de validação'}</small></div><button type="button" className="ft-outline" disabled={!d.storagePath||!d.storageBucket} onClick={()=>onOpenDocument(d)}>Abrir</button>{onValidate&&d.validationStatus!=='VALIDADO'&&<button type="button" className="ft-outline" onClick={()=>onValidate(d)}>Validar</button>}</li>)}</ul>:<p className="ft-hint">Nenhum documento vinculado com segurança a esta carga.</p>;}

function PedroClosing({data,carga,order}){
 const recipient=data.settings?.pedidoPreviaInterna;
 const phone=String(recipient?.whatsapp||'').replace(/\D/g,'');
 const valid=/^55\d{11}$/.test(phone);
 const [open,setOpen]=useState(false);
 const os=order?.numero||carga.numeroOS||'OS não vinculada';
 const message='FORTE ATACAREJO — Dossiê para conferência interna: '+os+'\nFornecedor: '+(carga.fornecedor||'A conferir')+'\nMotorista: '+(carga.motorista||'A definir')+'\nSegue o relatório da carga para conferência. Anexo PDF a incluir manualmente.';
 return <><button type="button" className="ft-primary" onClick={()=>setOpen(v=>!v)}>Enviar para Pedro</button>{open&&<section aria-label="Enviar dossiê ao Pedro"><p>Conferência interna — {os}. Não encerra a carga nem registra envio automático.</p><button type="button" onClick={()=>loadReport(data,carga).save(os+'-DOSSIE.pdf')}>Baixar PDF do dossiê</button>{valid?<a className="ft-outline" href={'https://wa.me/'+phone+'?text='+encodeURIComponent(message)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp de Pedro</a>:<p role="alert">WhatsApp do Pedro não configurado em prévia interna.</p>}<p>Anexe o PDF na conversa e confirme o envio.</p><button type="button" className="ft-outline" onClick={()=>setOpen(false)}>Fechar envio</button></section>}</>;
}
function DriverChange({carga,options=[],onSave,busy}){
 const [open,setOpen]=useState(false),[id,setId]=useState(''),[query,setQuery]=useState(''),[error,setError]=useState('');
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const locked=carga.finalizadaEm||carga.fretePublicadaId||carga.ordemEnviadaEm||carga.status==='CANCELADA';
 return <div className="ow-actions"><button type="button" className="ft-outline" disabled={busy||!!locked} aria-expanded={open} onClick={()=>{setId('');setQuery('');setError('');setOpen(v=>!v);}}>Alterar motorista</button>
 {locked&&<small className="ft-hint">Carga enviada ou encerrada: revise a operação antes de trocar o motorista.</small>}
 {open&&!locked&&<div className="ow-preview" role="region" aria-label="Alterar motorista da carga">
 <label>Buscar motorista<input aria-label="Buscar motorista para esta carga" value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <label>Novo motorista<select aria-label="Novo motorista da carga" value={id} onChange={e=>setId(e.target.value)}><option value="">Selecione...</option>{options.filter(o=>o.value!==carga.motoristaId&&(o.value===id||normalize(o.search||o.label).includes(normalize(query)))).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
 <p className="ft-hint">Mantém a mesma OS. Motoristas com pendências liberadas podem ser previstos na carga; para expedição, confira documentos, veículo e capacidade. A ordem deverá ser conferida novamente.</p>
 {error&&<p role="alert">{error}</p>}
 <button type="button" className="ft-primary" disabled={busy||!id} onClick={async()=>{setError('');try{await onSave(carga,id);setOpen(false);}catch(e){setError(e.message||'Não foi possível alterar o motorista.');}}}>Salvar novo motorista</button>
 <button type="button" className="ft-outline" disabled={busy} onClick={()=>setOpen(false)}>Cancelar alteração</button>
 </div>}</div>;
}

export default function PedidosFT({data={},fleetLinks=[],fleetVehicles=[],currentUser,onGo,onOpenDocument,initialCargaId='',driverOptions=[],onChangeDriver,onSelectCarga,onDriverActions,onLinkVehicle,onAttachClientBoletos,onSyncSupplierDocs,onLinkSale,availableSales=[],onValidateDocument,onReleasePallets,onFinalize,onPurchaseActions,returnField=0,busy=false}) {
 const cargas=useMemo(()=>(data.cargas||[]).filter(x=>x?.id).slice().reverse(),[data.cargas]);
 const [selection,setSelection]=useState(initialCargaId);
 const [loadView,setLoadView]=useState(null);
 useForteLayer('pedidos-ft-lista-cargas',loadView,setLoadView);
 const [pendingFilter,setPendingFilter]=useState('');
 const pendingLoads=useMemo(()=>cargas.map(c=>({id:c.id,keys:dossierPending(buildPedidosFTDossier(data,c.id))})),[data,cargas]);
 const [scrollField,setScrollField]=useState(returnField||null);
 const [saleToLink,setSaleToLink]=useState('');
 const [syncStatus,setSyncStatus]=useState('');
 const [syncBusy,setSyncBusy]=useState(false);
 const synced=useRef(new Set());
 const syncLock=useRef(false);
 const activeCarga=useRef('');
 useEffect(()=>{if(!loadView&&scrollField){document.getElementById('ft-campo-'+scrollField)?.scrollIntoView?.({block:'start'});setScrollField(null);}},[loadView,scrollField,selection]);
 const loadHeading=useRef(null);
 useEffect(()=>{
  if(!loadView)return;
  loadHeading.current?.focus();
  loadHeading.current?.scrollIntoView?.({block:'start'});
 },[loadView]);
 const cargaId=cargas.some(c=>c.id===selection)?selection:(cargas.some(c=>c.id===initialCargaId)?initialCargaId:cargas[0]?.id||'');
 const d=useMemo(()=>buildPedidosFTDossier(data,cargaId),[data,cargaId]);
 activeCarga.current=cargaId;
 useEffect(()=>{if(cargaId&&cargaId!==initialCargaId)onSelectCarga?.(cargaId);setSaleToLink('');setSyncStatus('');},[cargaId]);
 async function syncDocs(id){if(!onSyncSupplierDocs||syncLock.current)return;syncLock.current=true;setSyncBusy(true);setSyncStatus('Consultando documentos recebidos…');try{const count=await onSyncSupplierDocs(id);if(activeCarga.current===id)setSyncStatus(count?count+' documento(s) vinculado(s). Aguardam conferência.':'Consulta concluída. Nenhum novo documento com vínculo seguro.');}catch(e){if(activeCarga.current===id)setSyncStatus(e.message||'Consulta indisponível.');}finally{syncLock.current=false;setSyncBusy(false);}}
 useEffect(()=>{if(syncBusy||syncLock.current||!validMaster(currentUser)||!d||d.carga.finalizadaEm||d.carga.status==='CANCELADA'||!onSyncSupplierDocs||synced.current.has(d.carga.id))return;synced.current.add(d.carga.id);syncDocs(d.carga.id);},[d?.carga?.id,syncBusy]);
 if(!validMaster(currentUser))return <section className="ft-app"><div className="ft-guard" role="alert"><h2>PEDIDOS FT — acesso restrito</h2><p>Esta primeira etapa está disponível somente para MASTER. Os acessos de Juliana e Pedro serão liberados após criar e validar as permissões por carga no servidor.</p></div></section>;
 const go=(target,field=0)=>onGo?.(target,d?.carga?.id||'',field);
 const jump=field=>document.getElementById('ft-campo-'+field)?.scrollIntoView?.({block:'start',behavior:'smooth'});
 if(loadView)return <section className="ft-app" aria-label="PEDIDOS FT">
  <header className="ft-top">
   <FtTitle heading={loadHeading} subtitle={loadView==='relatorios'?'Relatórios':'Todas as cargas'}/>
   <div className="ft-top-actions">
    <button type="button" className="ft-outline" onClick={()=>setLoadView(null)}>Voltar</button>
    <FtOptions onSelect={v=>{setPendingFilter('');setLoadView(v);}}/>
   </div>
  </header>
  <PedidosFTLoadPanel data={data} cargas={cargas} showReports={loadView==='relatorios'} pendingFilter={pendingFilter} onOpen={id=>{
   setSelection(id);onSelectCarga?.(id);setScrollField(pendingTypes.find(t=>t[0]===pendingFilter)?.[2]||null);
   setLoadView(null);
  }}/>
 </section>;
 if(!d)return <section className="ft-app" aria-label="PEDIDOS FT"><header className="ft-top"><FtTitle subtitle="Criação e acompanhamento de pedidos"/><FtOptions onSelect={setLoadView}/></header><Panel title="Nenhuma carga localizada"><p>Cadastre um pedido ao fornecedor para iniciar o primeiro dossiê.</p><button type="button" className="ft-primary" onClick={()=>go('novo-fornecedor')}>Criar pedido ao fornecedor</button></Panel></section>;
 const {carga:c,order,supplier,driver,clients,reconciliation:r,finance,pallets,documents,items,timeline}=d;
 const supplierOrderNumber=String(c.numeroPedidoFornecedor||order?.numeroPedidoFornecedor||'').trim();
 const savedPlates=(c?.placas||[]).filter(Boolean);
 const currentLink=fleetLinks.find(link=>link.fim_em==null&&link.motorista_operacional_id===(c?.motoristaId||driver?.id));
 const linkedVehicle=fleetVehicles.find(vehicle=>vehicle.id===currentLink?.veiculo_id);
 const driverPlates=[driver?.placa1,driver?.placa2,driver?.placa3,driver?.placa4].filter(Boolean);
 const registeredPlates=linkedVehicle?.placa?[linkedVehicle.placa,...(linkedVehicle.placas_carretas?.length?linkedVehicle.placas_carretas:driverPlates[0]===linkedVehicle.placa?driverPlates.slice(1):[])]:driverPlates;
 const displayedPlates=savedPlates.length?savedPlates:registeredPlates;
 const supplierDocs=documents.filter(doc=>!doc.clienteId&&!doc.vendaId);
 const customerDocs=documents.filter(doc=>doc.clienteId||doc.vendaId);
 const statusTone=r.status==='CONCILIADA'?'good':r.status==='DIVERGENTE'?'bad':'warn';
 const needsPalletAttention=pallets.status!=='REGRA CADASTRADA';
 return <section className="ft-app ft-overview" aria-label="PEDIDOS FT">
  <header className="ft-top">
   <FtTitle subtitle="Criação e acompanhamento de pedidos"/>
   <div className="ft-top-actions"><button type="button" className="ft-primary ft-create-btn" onClick={()=>go('novo-fornecedor')}>Novo pedido ao fornecedor</button><FtOptions onSelect={v=>{setPendingFilter('');setLoadView(v);}}/></div>
  </header>
  <details className="ft-card ft-pending-collapsed" aria-label="Central de pendências"><summary>Central de pendências · {pendingLoads.filter(l=>l.keys.some(k=>!['finalizada','cancelada'].includes(k))).length} carga(s) a conferir</summary><button type="button" className="ft-text-button" onClick={()=>{setPendingFilter('');setLoadView('cargas');}}>Todas as cargas</button><div className="ft-pending-grid">{pendingTypes.map(([key,label])=><button type="button" className="ft-outline" key={key} onClick={()=>{setPendingFilter(key);setLoadView('cargas');}}><strong>{pendingLoads.filter(l=>l.keys.includes(key)).length}</strong><span>{label}</span></button>)}</div><small>Uma carga pode ter mais de uma pendência. Selecione uma etapa para abrir a carga e o campo correspondente.</small></details>
  <div className="ft-picker"><label htmlFor="ft-carga">Nossa OS</label><select id="ft-carga" aria-label="Selecionar carga do PEDIDOS FT" value={cargaId} onChange={e=>{setSelection(e.target.value);onSelectCarga?.(e.target.value);}}>{cargas.map(x=>{const linked=(data.comprasFornecedor||[]).find(o=>o.id===x.compraFornecedorId||o.cargaId===x.id);return <option key={x.id} value={x.id}>{linked?.numero||x.numeroOS||'OS não vinculada'}</option>;})}</select>
   <Field label="Pedido oficial do fornecedor" value={supplierOrderNumber||'Aguardando retorno por e-mail ou WhatsApp'}/>
  </div>

  <nav className="ft-step-nav" aria-label="Etapas da OS">{['Compra e paletes','Motorista','Clientes','Conciliação e faturamento','Fechamento','Histórico'].map((label,i)=><button type="button" className="ft-outline" key={label} onClick={()=>jump(i+1)}><span>{i+1}</span> {label}</button>)}</nav>
  <Panel title="1. Compra, fornecedor e paletes" aside={<button type="button" className="ft-text-button" onClick={()=>go('fornecedor',1)}>Abrir compra</button>}>
   <Field label="Fornecedor" value={supplier?.nome||c.fornecedor}/>
   <Field label="Pagamento do fornecedor" value={order?.pagamento||c.condicaoFornecedor||'Não registrado'}/>
   <Field label="Vencimentos previstos" value={paymentScheduleText(order||c)||'Não registrados'}/>
   <Field label="Expedição (origem da carga)" value={c.localCarregamento||c.origem}/>
   <Field label="Destino" value={c.destino}/>
   <h4>Produtos comprados</h4>
   {items.map((item,i)=><div className="ft-line" key={item.produtoId||i}><span>{text(item.produto)}</span><b>{number(item.qtd)} sacos</b></div>)}
   {!items.length&&<p className="ft-hint">Nenhum produto na carga.</p>}
   <div className="ft-subsection"><div className="ft-subsection-heading"><h4>Paletes da carga</h4><Pill tone={needsPalletAttention?'warn':'good'}>{pallets.label}</Pill></div>
   <Field label="Regra de paletes definida em" value={supplier?.condicaoPaletes?'Cadastro do fornecedor':'Condição do pedido — conferir fornecedor'}/>
   <Field label="Quantidade registrada" value={pallets.quantity===null?'Pendente':number(pallets.quantity)+' paletes'}/>
   <Field label="Situação" value={pallets.status}/>
   {pallets.needsRelease&&onReleasePallets&&<button type="button" className="ft-outline" disabled={busy||!!c.finalizadaEm||c.status==='CANCELADA'} onClick={()=>onReleasePallets(c.id)}>Registrar liberação do fornecedor</button>}
   {pallets.needsRelease&&<p className="ft-warning" role="status">Solicitação de paletes: comprovação de liberação do vendedor pendente antes da expedição.</p>}
   <button type="button" className="ft-outline" onClick={()=>go('ordem',1)}>Ajustar quantidade de paletes</button>
   {needsPalletAttention&&!pallets.needsRelease&&<p className="ft-warning" role="status">Revise a preferência de paletes no cadastro do fornecedor e confira esta carga.</p>}
   </div>
   {order&&order.status!=='CANCELADO'&&onPurchaseActions?.(order)}
  </Panel>

  <Panel title="2. Motorista e carregamento" aside={<button type="button" className="ft-text-button" onClick={()=>go('ordem',2)}>Abrir ordem</button>}>
   <Field label="Motorista" value={driver?.nome||c.motorista}/>
   {onChangeDriver&&<DriverChange key={c.id} carga={c} options={driverOptions} onSave={onChangeDriver} busy={busy}/> }
   {driver&&onLinkVehicle&&<button type="button" className="ft-primary" disabled={busy} onClick={()=>onLinkVehicle(driver.id)}>Vincular motorista e veículo</button>}
   {driver&&<DriverIntake key={driver.id} driver={driver}/>}
   <Field label={savedPlates.length||!displayedPlates.length?'Placas':'Placas do cadastro'} value={displayedPlates.join(' / ')}/>
   {!savedPlates.length&&displayedPlates.length>0&&<p className="ft-hint">Conjunto cadastrado. Confira as placas ao gravar a ordem.</p>}
   <Field label="Proprietário" value={c.motoristaSnapshot?.proprietario||driver?.proprietario}/>
   <Field label="Expedição do pedido" value={c.localCarregamento||c.origem}/>
   {c.ordemRevisadaEm&&onDriverActions?.(c)}
   {!c.ordemRevisadaEm&&<p className="ft-hint">Grave e confira a ordem antes de gerar o PDF ou enviar ao motorista.</p>}
   <p className="ft-hint">Dados de Pix permanecem protegidos no FORTE FRETE e não são exibidos nesta consulta inicial.</p>
  </Panel>

  <Panel title="3. Clientes vinculados" aside={<button type="button" className="ft-text-button" onClick={()=>go('venda',3)}>Nova venda</button>}>
   {onLinkSale&&<div className="ft-client"><label>Vincular venda à OS<select aria-label="Vincular venda à OS" value={saleToLink} onChange={e=>setSaleToLink(e.target.value)}><option value="">Selecione uma venda disponível</option>{availableSales.filter(g=>g.rows.every(v=>!v.cargaId||v.cargaId===c.id)&&!g.rows.some(v=>(c.vendaIds||[]).includes(v.id)||v.cargaId===c.id)).map(g=><option key={g.id} value={g.id}>{g.numero} · {g.cliente}</option>)}</select></label><button type="button" className="ft-outline" disabled={!saleToLink||busy||!!c.finalizadaEm||c.status==='CANCELADA'} onClick={async()=>{try{await onLinkSale(c.id,saleToLink);setSaleToLink('');}catch{}}}>Vincular venda selecionada</button></div>}
   {clients.length?clients.map(client=><div className="ft-client" key={client.id}>
    <div className="ft-client-name"><b>{client.nome}</b><small>{[client.cidade,client.uf].filter(Boolean).join(' / ')||'Cidade não cadastrada'}</small></div>
    {client.items.map((item,i)=><div className="ft-client-item" key={item.id||i}><div><span>{text(item.produto)}</span><small>{text(item.condicaoPagamento)}</small>{item.ordemCompraCliente&&<small>OC do cliente: {item.ordemCompraCliente}{item.itemOrdemCompraCliente!=null?' · item '+item.itemOrdemCompraCliente:''}</small>}</div><div className="ft-right"><b>{number(item.qtd)} sacos</b><small>{item.precoUnitario==null?'Preço não informado':money(item.precoUnitario)+' / un.'}</small></div></div>)}
    {client.documents.length>0&&<small className="ft-hint">{client.documents.length} documento(s) vinculado(s)</small>}
   </div>):<p className="ft-hint">Ainda não há clientes atribuídos a esta carga.</p>}
  </Panel>

  <Panel title="4. Conciliação e faturamento — Juliana" aside={<Pill tone={statusTone}>{r.status}</Pill>}>
   <h4>Conciliação por produto</h4>
   <div className="ft-numbers">
    <div><small>Comprado</small><strong>{number(r.comprado)}</strong></div>
    <div><small>Vendido</small><strong>{number(r.distribuido)}</strong></div>
    <div><small>Saldo</small><strong>{number(r.saldo)}</strong></div>
   </div>
   {r.details.map(item=><div className="ft-line" key={item.produtoId}><span>{item.produto}</span><b>{number(item.comprado)} / {number(item.distribuido)} • saldo {number(item.saldo)}</b></div>)}
   <p className="ft-hint">O status verde confere a distribuição comercial por produto. Não equivale a nota fiscal autorizada ou boleto pago.</p>
   <div className="ft-subsection"><div className="ft-subsection-heading"><h4>Resumo financeiro da carga</h4><Pill tone={finance.completo&&r.status==='CONCILIADA'?'good':'warn'}>{finance.modalidadeFrete}</Pill></div>
   <Field label="Vendas de mercadorias" value={finance.receitaVendas===null?'Pendente':money(finance.receitaVendas)}/>
   <Field label="Compra do fornecedor" value={finance.custoFornecedor===null?'Pendente':money(finance.custoFornecedor)}/>
   <Field label="Diferença antes do frete" value={finance.diferencaAntesFrete===null?'Pendente':money(finance.diferencaAntesFrete)}/>
   <Field label={finance.modalidadeFrete==='FOB'?'(-) Frete FOB da carga':'Frete CIF incluído na compra'} value={finance.freteDescontado===null?'Frete pendente de registro':money(finance.freteDescontado)}/>
   <div className={'ft-financial-result'+(finance.resultadoAposFrete!==null&&finance.resultadoAposFrete<0?' ft-loss':'')}><span>RESULTADO COMERCIAL APÓS FRETE</span><strong>{finance.resultadoAposFrete===null?'PENDENTE':money(finance.resultadoAposFrete)}</strong></div>
   {finance.statusFrete==='FRETE_PENDENTE'&&<p className="ft-warning" role="status">Carga FOB: registre e confira o valor do frete da carga para calcular o resultado. Não considerar frete ausente como zero.</p>}
   {finance.statusFrete==='INCLUSO_NO_PRECO'&&<p className="ft-hint">Frete CIF já incluído no custo do fornecedor: não descontar duas vezes.</p>}
   {finance.statusFrete==='MODALIDADE_PENDENTE'&&<p className="ft-warning">Modalidade do frete ainda não definida; resultado pendente.</p>}
   <p className="ft-hint">Estimativa comercial antes de impostos, despesas e conciliação de pagamentos. Não equivale a lucro líquido.</p>
   </div>
   <div className="ft-subsection"><div className="ft-subsection-heading"><h4>Faturamento — Juliana</h4><Pill tone="warn">ACESSO EM PREPARAÇÃO</Pill></div>
   <h4>Documentos do fornecedor — recebimento automático</h4>
   {['PDF NF','XML NF','BOLETO FORNECEDOR'].map(cat=><div key={cat} className="ft-client"><b>{cat==='PDF NF'?'Nota fiscal — PDF':cat==='XML NF'?'XML da nota fiscal':'Boletos do fornecedor'}</b><DocList docs={supplierDocs.filter(doc=>doc.categoria===cat)} onOpenDocument={onOpenDocument}/></div>)}
   {onSyncSupplierDocs&&<button type="button" className="ft-outline" disabled={syncBusy||busy||!!c.finalizadaEm||c.status==='CANCELADA'} onClick={()=>syncDocs(c.id)}>Consultar documentos do fornecedor</button>}
   {syncStatus&&<p role="status">{syncStatus}</p>}
   <h4>Boletos dos clientes — anexar manualmente</h4>
   {!clients.length&&<p>Nenhuma venda vinculada a esta OS.</p>}
   {clients.map((client,index)=><div className="ft-client" key={client.id}><b>Cliente {index+1} — {client.nome}</b>{client.salesGroups.map(g=><div key={g.id}><small>{g.numero} · {g.formaPagamento||'Forma a conferir'} · {g.prazo||'Prazo a conferir'}</small>{onAttachClientBoletos&&<label className="ow-upload">Anexar boletos — {client.nome} ({g.numero})<input type="file" accept="application/pdf,.pdf" multiple disabled={busy||!!c.finalizadaEm||c.status==='CANCELADA'} onChange={async e=>{const files=Array.from(e.target.files||[]);e.target.value='';await onAttachClientBoletos(files,{cargaId:c.id,vendaId:g.id,categoria:'BOLETO CLIENTE'});}}/></label>}</div>)}<DocList docs={client.documents.filter(doc=>doc.categoria==='BOLETO CLIENTE')} onOpenDocument={onOpenDocument}/></div>)}
   {customerDocs.filter(doc=>doc.categoria!=='BOLETO CLIENTE').length>0&&<DocList docs={customerDocs.filter(doc=>doc.categoria!=='BOLETO CLIENTE')} onOpenDocument={onOpenDocument}/>}
   {onValidateDocument&&<p className="ft-hint">A conferência dos arquivos ocorre no campo 5 desta mesma OS.</p>}
   <p className="ft-hint">Anexar não emite, paga ou envia boleto. Login próprio da Juliana depende da validação de permissões por carga.</p>
   </div>
  </Panel>

  <Panel title="5. Fechamento — Pedro" aside={<Pill tone="warn">ACESSO EM PREPARAÇÃO</Pill>}>
   <p>Documentos do fornecedor e arquivos registrados por Juliana, sem misturar outras cargas.</p>
   <DocList docs={documents} onOpenDocument={onOpenDocument} onValidate={onValidateDocument&&!c.finalizadaEm&&c.status!=='CANCELADA'?doc=>onValidateDocument(c.id,doc):undefined}/>
   <PedroClosing key={c.id} data={data} carga={c} order={order}/>
   {onFinalize&&<button type="button" className="ft-outline" disabled={busy||!!c.finalizadaEm||c.status==='CANCELADA'} onClick={()=>onFinalize(c.id)}>Conferir fechamento / solicitar confirmação</button>}
   <details><summary>Outras ações da carga</summary><button type="button" className="ft-outline" onClick={()=>go('cargas',5)}>Ajustes e comprovantes da carga</button></details>
   <div className="ft-doc-count">Documentos vinculados a esta carga: <b>{documents.length}</b></div>
   <p className="ft-hint">Sincronização de Gmail e WhatsApp, conferência e encerramento dependem da próxima etapa de integração.</p>
  </Panel>

  <Panel title="6. Histórico desta carga">
   {timeline.length?<ol className="ft-timeline">{timeline.map((event,i)=><li key={i}><time>{when(event.when)}</time><span>{event.label}</span></li>)}</ol>:<p className="ft-hint">Nenhum evento com data registrada para esta carga.</p>}
  </Panel>
  <p className="ft-hint">O relatório reúne o resumo e a lista de anexos vinculados. O pacote imprimível com os PDFs originais será desenvolvido na etapa de fechamento do Pedro.</p><div className="ft-footer"><button type="button" className="ft-primary" onClick={()=>loadReport(data,c).save((order?.numero||c.numeroOS||'OS-NAO-VINCULADA')+'-DOSSIE.pdf')}>Baixar relatório PDF da carga</button><button type="button" className="ft-outline" onClick={()=>{setPendingFilter('');setLoadView('cargas');}}>Painel de cargas</button></div>
 </section>;
}
