import {paymentScheduleText} from '../../../supabase/functions/orders-workflow/supplier-payment-terms.mjs';
import {useEffect,useMemo,useRef,useState} from 'react';
import {buildPedidosFTDossier} from './pedidos-ft-model.mjs';
import {loadReport} from './orders-reports';
import './pedidos-ft.css';
import PedidosFTLoadPanel from './PedidosFTLoadPanel.jsx';

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
function Panel({title,children,aside}){return <section className="ft-card"><div className="ft-card-heading"><h3>{title}</h3>{aside}</div>{children}</section>;}
function Field({label,value}){return <div className="ft-field"><span>{label}</span><b>{text(value)}</b></div>;}
function Pill({children,tone='neutral'}){return <span className={'ft-pill ft-'+tone}>{children}</span>;}
function DocList({docs,onOpenDocument}){return docs.length?<ul className="ft-doc-list">{docs.map((d,i)=><li key={d.id||i}><div><b>{d.categoria||'Documento'}</b><small>{d.filename||'Arquivo sem nome'} • {d.validationStatus||'Pendente de validação'}</small></div><button type="button" className="ft-outline" disabled={!d.storagePath||!d.storageBucket} onClick={()=>onOpenDocument(d)}>Abrir</button></li>)}</ul>:<p className="ft-hint">Nenhum documento vinculado com segurança a esta carga.</p>;}

export default function PedidosFT({data={},currentUser,onGo,onOpenDocument,initialCargaId=''}) {
 const cargas=useMemo(()=>(data.cargas||[]).filter(x=>x?.id).slice().reverse(),[data.cargas]);
 const [selection,setSelection]=useState(initialCargaId);
 const [loadView,setLoadView]=useState(null);
 const loadHeading=useRef(null);
 useEffect(()=>{
  if(!loadView)return;
  loadHeading.current?.focus();
  loadHeading.current?.scrollIntoView?.({block:'start'});
 },[loadView]);
 const cargaId=cargas.some(c=>c.id===selection)?selection:(cargas.some(c=>c.id===initialCargaId)?initialCargaId:cargas[0]?.id||'');
 const d=useMemo(()=>buildPedidosFTDossier(data,cargaId),[data,cargaId]);
 if(!validMaster(currentUser))return <section className="ft-app"><div className="ft-guard" role="alert"><h2>PEDIDOS FT — acesso restrito</h2><p>Esta primeira etapa está disponível somente para MASTER. Os acessos de Juliana e Pedro serão liberados após criar e validar as permissões por carga no servidor.</p></div></section>;
 const go=target=>onGo?.(target,d?.carga?.id||'');
 if(loadView)return <section className="ft-app" aria-label="PEDIDOS FT">
  <header className="ft-top">
   <FtTitle heading={loadHeading} subtitle={loadView==='relatorios'?'Relatórios':'Todas as cargas'}/>
   <div className="ft-top-actions">
    <button type="button" className="ft-outline" onClick={()=>setLoadView(null)}>Voltar</button>
    <FtOptions onSelect={setLoadView}/>
   </div>
  </header>
  <PedidosFTLoadPanel data={data} cargas={cargas} showReports={loadView==='relatorios'} onOpen={id=>{
   setSelection(id);
   setLoadView(null);
  }}/>
 </section>;
 if(!d)return <section className="ft-app" aria-label="PEDIDOS FT"><header className="ft-top"><FtTitle subtitle="Criação e acompanhamento de pedidos"/><FtOptions onSelect={setLoadView}/></header><Panel title="Nenhuma carga localizada"><p>Cadastre um pedido ao fornecedor para iniciar o primeiro dossiê.</p><button type="button" className="ft-primary" onClick={()=>go('fornecedor')}>Criar pedido ao fornecedor</button></Panel></section>;
 const {carga:c,order,supplier,driver,clients,reconciliation:r,finance,pallets,documents,items,timeline}=d;
 const supplierDocs=documents.filter(doc=>!doc.clienteId&&!doc.vendaId);
 const customerDocs=documents.filter(doc=>doc.clienteId||doc.vendaId);
 const statusTone=r.status==='CONCILIADA'?'good':r.status==='DIVERGENTE'?'bad':'warn';
 const needsPalletAttention=pallets.status!=='REGRA CADASTRADA';
 return <section className="ft-app ft-overview" aria-label="PEDIDOS FT">
  <header className="ft-top">
   <FtTitle subtitle="Criação e acompanhamento de pedidos"/>
   <div className="ft-top-actions"><button type="button" className="ft-primary ft-create-btn" onClick={()=>go('fornecedor')}>Novo pedido ao fornecedor</button><FtOptions onSelect={setLoadView}/></div>
  </header>
  <div className="ft-picker"><label htmlFor="ft-carga">Selecionar carga</label><select id="ft-carga" aria-label="Selecionar carga do PEDIDOS FT" value={cargaId} onChange={e=>setSelection(e.target.value)}>{cargas.map(x=><option key={x.id} value={x.id}>{x.codigo||x.id} • {x.fornecedor||'Fornecedor a definir'}</option>)}</select></div>
  <div className="ft-summary">
   <div><small>CARGA</small><strong>{text(c.codigo||c.id)}</strong></div>
   <div><small>FORNECEDOR</small><strong>{text(supplier?.nome||c.fornecedor)}</strong></div>
   <div><small>PEDIDO OFICIAL</small><strong>{text(c.numeroPedidoFornecedor||order?.numeroPedidoFornecedor||'Aguardando')}</strong></div>
  </div>
  <div className="ft-protocol" aria-label="Protocolo do pedido"><span>PROTOCOLO DO PEDIDO</span><strong>{c.protocolo||order?.protocolo||"Aguardando identificação do motorista"}</strong><small>Primeiro nome do motorista + data do pedido (DDMMAA), tudo junto</small></div>
  <div className="ft-status">
   <Pill tone={statusTone}>{r.status==='CONCILIADA'?'Comercial conciliado':r.status==='DIVERGENTE'?'Quantidade divergente':'Comercial em aberto'}</Pill>
   <Pill tone="warn">Faturamento: conferir</Pill>
   <Pill tone="neutral">Fechamento: conferir</Pill>
  </div>

  <Panel title="1. Compra e fornecedor" aside={<button type="button" className="ft-text-button" onClick={()=>go('fornecedor')}>Abrir compra</button>}>
   <Field label="Número interno" value={order?.numero||c.codigo}/>
   <Field label="Protocolo PEDIDOS FT" value={c.protocolo||order?.protocolo||"Aguardando motorista"}/>
   <Field label="Pagamento do fornecedor" value={order?.pagamento||c.condicaoFornecedor||'Não registrado'}/>
   <Field label="Vencimentos previstos" value={paymentScheduleText(order||c)||'Não registrados'}/>
   <Field label="Expedição / retirada" value={c.localCarregamento||c.origem}/>
   <Field label="Destino" value={c.destino}/>
   <h4>Produtos comprados</h4>
   {items.map((item,i)=><div className="ft-line" key={item.produtoId||i}><span>{text(item.produto)}</span><b>{number(item.qtd)} sacos</b></div>)}
   {!items.length&&<p className="ft-hint">Nenhum produto na carga.</p>}
  </Panel>

  <Panel title="2. Paletes da carga" aside={<Pill tone={needsPalletAttention?'warn':'good'}>{pallets.label}</Pill>}>
   <Field label="Origem da regra" value={supplier?.condicaoPaletes?'Cadastro do fornecedor':'Condição do pedido — conferir fornecedor'}/>
   <Field label="Quantidade registrada" value={pallets.quantity===null?'Pendente':number(pallets.quantity)+' paletes'}/>
   <Field label="Situação" value={pallets.status}/>
   {pallets.needsRelease&&<p className="ft-warning" role="status">Solicitação de paletes: comprovação de liberação do vendedor pendente antes da expedição.</p>}
   {needsPalletAttention&&!pallets.needsRelease&&<p className="ft-warning" role="status">Revise a preferência de paletes no cadastro do fornecedor e confira esta carga.</p>}
  </Panel>

  <Panel title="3. Motorista e carregamento" aside={<button type="button" className="ft-text-button" onClick={()=>go('ordem')}>Abrir ordem</button>}>
   <Field label="Motorista" value={driver?.nome||c.motorista}/>
   <Field label="Placas" value={(c.placas||[]).join(' / ')||driver?.placa1}/>
   <Field label="Proprietário" value={c.motoristaSnapshot?.proprietario||driver?.proprietario}/>
   <Field label="Origem da ordem" value={c.localCarregamento||c.origem}/>
   <p className="ft-hint">Dados de Pix permanecem protegidos no FORTE FRETE e não são exibidos nesta consulta inicial.</p>
  </Panel>

  <Panel title="4. Clientes vinculados" aside={<button type="button" className="ft-text-button" onClick={()=>go('venda')}>Abrir vendas</button>}>
   {clients.length?clients.map(client=><div className="ft-client" key={client.id}>
    <div className="ft-client-name"><b>{client.nome}</b><small>{[client.cidade,client.uf].filter(Boolean).join(' / ')||'Cidade não cadastrada'}</small></div>
    {client.items.map((item,i)=><div className="ft-client-item" key={item.id||i}><div><span>{text(item.produto)}</span><small>{text(item.condicaoPagamento)}</small></div><div className="ft-right"><b>{number(item.qtd)} sacos</b><small>{item.precoUnitario==null?'Preço não informado':money(item.precoUnitario)+' / un.'}</small></div></div>)}
    {client.documents.length>0&&<small className="ft-hint">{client.documents.length} documento(s) vinculado(s)</small>}
   </div>):<p className="ft-hint">Ainda não há clientes atribuídos a esta carga.</p>}
  </Panel>

  <Panel title="5. Conciliação por produto" aside={<Pill tone={statusTone}>{r.status}</Pill>}>
   <div className="ft-numbers">
    <div><small>Comprado</small><strong>{number(r.comprado)}</strong></div>
    <div><small>Vendido</small><strong>{number(r.distribuido)}</strong></div>
    <div><small>Saldo</small><strong>{number(r.saldo)}</strong></div>
   </div>
   {r.details.map(item=><div className="ft-line" key={item.produtoId}><span>{item.produto}</span><b>{number(item.comprado)} / {number(item.distribuido)} • saldo {number(item.saldo)}</b></div>)}
   <p className="ft-hint">O status verde confere a distribuição comercial por produto. Não equivale a nota fiscal autorizada ou boleto pago.</p>
  </Panel>

  <Panel title="Resumo financeiro da carga" aside={<Pill tone={finance.completo&&r.status==='CONCILIADA'?'good':'warn'}>{finance.modalidadeFrete}</Pill>}>
   <Field label="Vendas de mercadorias" value={finance.receitaVendas===null?'Pendente':money(finance.receitaVendas)}/>
   <Field label="Compra do fornecedor" value={finance.custoFornecedor===null?'Pendente':money(finance.custoFornecedor)}/>
   <Field label="Diferença antes do frete" value={finance.diferencaAntesFrete===null?'Pendente':money(finance.diferencaAntesFrete)}/>
   <Field label={finance.modalidadeFrete==='FOB'?'(-) Frete FOB da carga':'Frete CIF incluído na compra'} value={finance.freteDescontado===null?'Frete pendente de registro':money(finance.freteDescontado)}/>
   <div className={'ft-financial-result'+(finance.resultadoAposFrete!==null&&finance.resultadoAposFrete<0?' ft-loss':'')}><span>RESULTADO COMERCIAL APÓS FRETE</span><strong>{finance.resultadoAposFrete===null?'PENDENTE':money(finance.resultadoAposFrete)}</strong></div>
   {finance.statusFrete==='FRETE_PENDENTE'&&<p className="ft-warning" role="status">Carga FOB: registre e confira o valor do frete da carga para calcular o resultado. Não considerar frete ausente como zero.</p>}
   {finance.statusFrete==='INCLUSO_NO_PRECO'&&<p className="ft-hint">Frete CIF já incluído no custo do fornecedor: não descontar duas vezes.</p>}
   {finance.statusFrete==='MODALIDADE_PENDENTE'&&<p className="ft-warning">Modalidade do frete ainda não definida; resultado pendente.</p>}
   <p className="ft-hint">Estimativa comercial antes de impostos, despesas e conciliação de pagamentos. Não equivale a lucro líquido.</p>
  </Panel>

  <Panel title="6. Faturamento — Juliana" aside={<Pill tone="warn">ACESSO EM PREPARAÇÃO</Pill>}>
   <p>Os documentos de cada cliente desta carga aparecerão aqui, após vinculação e conferência.</p>
   <DocList docs={customerDocs} onOpenDocument={onOpenDocument}/>
   <p className="ft-hint">Login próprio, envio de boletos e ações fiscais serão habilitados somente depois das validações de autorização por carga.</p>
  </Panel>

  <Panel title="7. Fechamento — Pedro" aside={<Pill tone="warn">ACESSO EM PREPARAÇÃO</Pill>}>
   <p>Documentos do fornecedor e arquivos registrados por Juliana, sem misturar outras cargas.</p>
   <DocList docs={supplierDocs} onOpenDocument={onOpenDocument}/>
   <div className="ft-doc-count">Documentos vinculados a esta carga: <b>{documents.length}</b></div>
   <p className="ft-hint">Sincronização de Gmail e WhatsApp, conferência e encerramento dependem da próxima etapa de integração.</p>
  </Panel>

  <Panel title="8. Histórico desta carga">
   {timeline.length?<ol className="ft-timeline">{timeline.map((event,i)=><li key={i}><time>{when(event.when)}</time><span>{event.label}</span></li>)}</ol>:<p className="ft-hint">Nenhum evento com data registrada para esta carga.</p>}
  </Panel>
  <p className="ft-hint">O relatório reúne o resumo e a lista de anexos vinculados. O pacote imprimível com os PDFs originais será desenvolvido na etapa de fechamento do Pedro.</p><div className="ft-footer"><button type="button" className="ft-primary" onClick={()=>loadReport(data,c).save((c.codigo||c.id)+'-DOSSIE.pdf')}>Baixar relatório PDF da carga</button><button type="button" className="ft-outline" onClick={()=>setLoadView('cargas')}>Painel de cargas</button></div>
 </section>;
}
