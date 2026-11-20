import React,{useEffect,useMemo,useState} from 'react';
import WhatsappInbox from './WhatsappInbox.jsx';
import {jsPDF} from 'jspdf';
import {supabase,getAuthContext} from './supabase.js';

const PHONE='(64) 99917-2700';
const blankCampaign=()=>({id:null,title:'',channel:'WHATSAPP',kind:'APRESENTACAO',subject:'',body:'',template_name:'',segment:'TODOS',scheduled_at:'',status:'RASCUNHO'});
const blankContact=()=>({name:'',whatsapp:'',email:'',segment:'CLIENTES',consent_whatsapp:false,consent_email:false,consent_source:''});
const products=['Cimento CP II-F-32','Cimento CP V','Cimento CP IV','Cimento Extra Forte 40 kg','Argamassa AC1','Argamassa AC2','Argamassa AC3','Cal hidratada CH-III 15 kg'];
const examples=[
 {title:'Apresentação institucional',kind:'APRESENTACAO',subject:'Forte Atacarejo | Apresentação comercial',body:'Olá! Somos a Forte Atacarejo. Nossa equipe reúne mais de 25 anos de experiência em distribuição de cimento e materiais de construção. Atendemos Goiás, Minas Gerais e Mato Grosso com frota própria, rapidez e atendimento sem burocracia. Gostaríamos de apresentar nosso portfólio e estudar o fornecimento para sua obra ou empresa. Podemos conversar?'},
 {title:'Linha de cimentos ensacados',kind:'PRODUTOS',subject:'Cimentos ensacados para sua obra | Forte Atacarejo',body:'Olá! A Forte Atacarejo oferece cimentos ensacados para obras, revendas e construções, com opções CP II-F-32, CP V, CP IV e Extra Forte 40 kg. Consulte disponibilidade, quantidades e logística para sua região. Conte com nossa frota própria e agilidade no atendimento.'},
 {title:'Argamassas e cal',kind:'PRODUTOS',subject:'Argamassas e cal hidratada | Forte Atacarejo',body:'A Forte Atacarejo apresenta sua linha de argamassas AC1, AC2 e AC3 e cal hidratada CH-III de 15 kg, com atendimento comercial em Minas Gerais, Goiás e Mato Grosso. Fale conosco para solicitar cotação e programação de entrega.'},
 {title:'Novidades e promoções',kind:'MARKETING',subject:'Novidades da Forte Atacarejo',body:'Olá! Temos novidades na linha de materiais de construção da Forte Atacarejo. Consulte ofertas, condições comerciais e disponibilidade de estoque com nossa equipe. Se preferir não receber comunicações promocionais, responda SAIR.'}
];
const tabs=[['mensagens','Mensagens','▣'],['campanhas','Campanhas','◉'],['agenda','Programações','◷'],['contatos','Contatos','♙'],['materiais','Apresentações','▤']];
const d=v=>String(v||'').replace(/\D/g,'');
function downloadPresentation(){
 const doc=new jsPDF({unit:'mm',format:'a4'});
 const navy=[14,41,72],gold=[241,174,53],ink=[38,55,75];
 doc.setFillColor(...navy);doc.rect(0,0,210,52,'F');
 doc.setFillColor(...gold);doc.rect(0,49,210,3,'F');
 doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(22);doc.text('FORTE ATACAREJO',16,23);
 doc.setFont('helvetica','normal');doc.setFontSize(11);doc.text('DISTRIBUICAO DE CIMENTO E MATERIAIS DE CONSTRUCAO',16,33);
 doc.setFontSize(10);doc.text('Equipe com mais de 25 anos de experiencia no setor',16,41);
 doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('SOLUCOES PARA SUA OBRA',16,67);
 doc.setFont('helvetica','normal');doc.setFontSize(10.5);
 const introduction='Atendimento comercial em Minas Gerais, Goias e Mato Grosso, com lojas fisicas, rede de pontos de apoio, frota propria e entregas ageis, sem burocracia.';
 doc.text(doc.splitTextToSize(introduction,178),16,77);
 doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('PRODUTOS',16,103);
 doc.setFont('helvetica','normal');doc.setFontSize(10.5);
 const productsList=['Cimento CP II-F-32','Cimento CP V','Cimento CP IV','Cimento Extra Forte 40 kg','Argamassa AC1 / AC2 / AC3','Cal hidratada CH-III 15 kg'];
 productsList.forEach((item,i)=>doc.text('- '+item,17,113+i*8));
 doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('DIFERENCIAIS',16,171);
 doc.setFont('helvetica','normal');doc.setFontSize(10.5);
 doc.text('- Frota propria e entregas programadas',17,181);
 doc.text('- Mais de 70 pontos de apoio em Goias',17,189);
 doc.text('- Mais de 80 pontos de apoio em Minas Gerais',17,197);
 doc.text('- Pontos de apoio no Mato Grosso',17,205);
 doc.setFillColor(245,248,251);doc.roundedRect(13,221,184,54,3,3,'F');
 doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('DADOS CADASTRAIS',17,230);
 doc.setFont('helvetica','normal');doc.setFontSize(9.8);
 doc.text('Matriz: Monte Carmelo/MG | CNPJ 49.832.961/0001-51',17,240);
 doc.text('Filial: Caldas Novas/GO | CNPJ 49.832.961/0002-32',17,249);
 doc.text('WhatsApp comercial: (64) 99917-2700',17,259);
 doc.text('www.forteatacarejo.com.br',17,267);
 doc.save('FORTE_ATACAREJO_Apresentacao_Comercial.pdf');
}
function formatDate(value){if(!value)return 'Não definida';const x=new Date(value);return Number.isNaN(x.getTime())?'Não definida':x.toLocaleString('pt-BR');}
function localInputDate(value){if(!value)return '';const x=new Date(value);if(Number.isNaN(x.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate())+'T'+pad(x.getHours())+':'+pad(x.getMinutes());}
function eligible(contacts,campaign){
  return contacts.filter(c=>(campaign.segment==='TODOS'||c.segment===campaign.segment)&&(
    (campaign.channel==='WHATSAPP'&&c.consent_whatsapp&&!c.opted_out_whatsapp&&!!d(c.whatsapp))||
    (campaign.channel==='EMAIL'&&c.consent_email&&!c.opted_out_email&&!!c.email)||
    (campaign.channel==='AMBOS'&&((c.consent_whatsapp&&!c.opted_out_whatsapp&&!!d(c.whatsapp))||(c.consent_email&&!c.opted_out_email&&!!c.email)))
  ));
}
export default function ForteAtende(){
  const [tab,setTab]=useState('mensagens'),[campaign,setCampaign]=useState(blankCampaign),[contact,setContact]=useState(blankContact);
  const [campaigns,setCampaigns]=useState([]),[contacts,setContacts]=useState([]),[busy,setBusy]=useState(false),[alert,setAlert]=useState(''),[ready,setReady]=useState(false),[search,setSearch]=useState('');
  const empresa=getAuthContext()?.profile?.empresa_id;
  const isAdmin=['MASTER','ADMINISTRADOR','ADMIN'].includes(String(getAuthContext()?.profile?.perfil||'').toUpperCase());
  const qualified=useMemo(()=>eligible(contacts,campaign),[contacts,campaign]);
  const scoped=useMemo(()=>campaigns.filter(c=>tab!=='agenda'||c.status==='PLANEJADA'||c.status==='PAUSADA'),[campaigns,tab]);
  useEffect(()=>{load().catch(e=>setAlert(e.message));},[empresa]);
  async function load(){
    if(!empresa)return;
    const [cp,ct]=await Promise.all([
      supabase.from('forte_atende_campaigns').select('*').eq('empresa_id',empresa).order('updated_at',{ascending:false}).limit(250),
      supabase.from('forte_atende_contacts').select('*').eq('empresa_id',empresa).order('created_at',{ascending:false}).limit(1000)
    ]);
    if(cp.error||ct.error)throw Error('A área de campanhas depende da implantação do cadastro seguro. Mensagens continuam acessíveis.');
    setCampaigns(cp.data||[]);setContacts(ct.data||[]);setReady(true);
  }
  async function task(fn){if(busy)return;setBusy(true);setAlert('');try{await fn();}catch(e){setAlert(e.message||String(e));}finally{setBusy(false);}}
  async function saveCampaign(status='RASCUNHO'){
    if(!isAdmin)throw Error('Apenas administradores podem criar campanhas.');
    if(!campaign.title.trim()||!campaign.body.trim())throw Error('Informe nome e mensagem da campanha.');
    if(status==='PLANEJADA'){
      if(!campaign.scheduled_at||new Date(campaign.scheduled_at)<=new Date())throw Error('Informe uma data e horário futuros.');
      if(qualified.length===0)throw Error('Nenhum contato com autorização válida para os canais e segmento escolhidos.');
      if(campaign.channel!=='EMAIL'&&!campaign.template_name.trim())throw Error('Informe o nome de um modelo de marketing já aprovado na Meta.');
      if(campaign.channel!=='WHATSAPP'&&!campaign.subject.trim())throw Error('Informe o assunto do e-mail.');
    }
    const payload={empresa_id:empresa,title:campaign.title.trim(),kind:campaign.kind,channel:campaign.channel,subject:campaign.subject.trim(),body:campaign.body.trim(),template_name:campaign.template_name.trim(),segment:campaign.segment,status,scheduled_at:campaign.scheduled_at?new Date(campaign.scheduled_at).toISOString():null};
    let r;if(campaign.id)r=await supabase.from('forte_atende_campaigns').update(payload).eq('id',campaign.id).eq('empresa_id',empresa).select().single();
    else r=await supabase.from('forte_atende_campaigns').insert(payload).select().single();
    if(r.error)throw Error('Falha ao salvar campanha: '+r.error.message);
    setCampaign({...r.data,scheduled_at:localInputDate(r.data.scheduled_at)});
    await load();
    setAlert(status==='PLANEJADA'?'Programação registrada para conferência. A execução automática ainda não está habilitada.':'Rascunho salvo com segurança.');
  }
  async function pause(c){if(!isAdmin)throw Error('Apenas administradores podem pausar programações.');const r=await supabase.from('forte_atende_campaigns').update({status:'PAUSADA'}).eq('id',c.id).eq('empresa_id',empresa);if(r.error)throw Error(r.error.message);await load();setAlert('Programação pausada.');}
  async function saveContact(){
    if(!isAdmin)throw Error('Apenas administradores podem cadastrar contatos e autorizações.');
    if(!contact.name.trim()||(!d(contact.whatsapp)&&!contact.email.trim()))throw Error('Informe nome e pelo menos um contato.');
    if((contact.consent_whatsapp||contact.consent_email)&&!contact.consent_source.trim())throw Error('Registre a origem da autorização comercial.');
    const payload={empresa_id:empresa,name:contact.name.trim(),whatsapp:d(contact.whatsapp),email:contact.email.trim().toLowerCase(),segment:contact.segment,consent_whatsapp:contact.consent_whatsapp,consent_email:contact.consent_email,consent_source:contact.consent_source.trim(),consent_at:(contact.consent_whatsapp||contact.consent_email)?new Date().toISOString():null};
    const r=await supabase.from('forte_atende_contacts').insert(payload);
    if(r.error)throw Error(r.error.message);
    setContact(blankContact());await load();setAlert('Contato cadastrado; permissões de contato registradas.');
  }
  async function stopContact(c,channel){
    if(!isAdmin)throw Error('Somente administradores podem atualizar preferências de contato.');
    const key=channel==='WHATSAPP'?'opted_out_whatsapp':'opted_out_email';
    const r=await supabase.from('forte_atende_contacts').update({[key]:true}).eq('id',c.id).eq('empresa_id',empresa);
    if(r.error)throw Error(r.error.message);
    await load();setAlert('Preferência de não recebimento registrada.');
  }
  function useExample(ex){setCampaign({...blankCampaign(),title:ex.title,kind:ex.kind,subject:ex.subject,body:ex.body});setTab('campanhas');setAlert('Texto carregado. Ajuste e salve antes de qualquer envio.');}
  function edit(c){setCampaign({...c,scheduled_at:localInputDate(c.scheduled_at)});setTab('campanhas');setAlert('Campanha carregada para edição.');}
  return <div className="at-shell">
    <aside className="at-sidebar">
      <div className="at-brand"><img src="/forte-atende-icon.svg" alt="FORTE ATENDE"/><div><b>FORTE ATENDE</b><small>Central comercial</small></div></div>
      <div className="at-line"></div>
      <nav aria-label="Menu FORTE ATENDE">{tabs.map(([key,label,icon])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);setAlert('');}}><span>{icon}</span>{label}</button>)}</nav>
      <div className="at-sidebar-bottom"><span className="at-small">WHATSAPP BUSINESS</span><strong>{PHONE}</strong><small>Conexão Meta existente preservada</small></div>
    </aside>
    <main className="at-main">
      <header className="at-header"><div><span className="at-eyebrow">FORTE ATACAREJO LTDA.</span><h1>{tabs.find(t=>t[0]===tab)?.[1]}</h1><p>Mensagens, relacionamento e apresentações em um só lugar.</p></div><a className="at-external" href="/" target="_blank" rel="noopener noreferrer">Abrir FORTE OP</a></header>
      {alert&&<p className="at-notice" role="status">{alert}</p>}
      {tab==='mensagens'&&<section className="at-inbox"><WhatsappInbox client={supabase}/></section>}
      {tab==='campanhas'&&<div className="at-columns">
        <section className="at-card">
          <h2>Criar ou editar campanha</h2><p className="at-muted">Prepare uma comunicação por WhatsApp, e-mail ou pelos dois canais.</p>
          <div className="at-form">
            <label>Nome da campanha<input value={campaign.title} onChange={e=>setCampaign({...campaign,title:e.target.value})} placeholder="Ex.: Portfólio para construtoras"/></label>
            <div className="at-two"><label>Canal<select value={campaign.channel} onChange={e=>setCampaign({...campaign,channel:e.target.value})}><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">E-mail</option><option value="AMBOS">WhatsApp e e-mail</option></select></label>
            <label>Finalidade<select value={campaign.kind} onChange={e=>setCampaign({...campaign,kind:e.target.value})}><option value="APRESENTACAO">Apresentação da empresa</option><option value="PRODUTOS">Apresentação de produtos</option><option value="MARKETING">Marketing / transmissão</option><option value="COMUNICADO">Comunicado comercial</option></select></label></div>
            <label>Público<select value={campaign.segment} onChange={e=>setCampaign({...campaign,segment:e.target.value})}><option value="TODOS">Todos com permissão</option><option value="CLIENTES">Clientes</option><option value="CONSTRUTORAS">Construtoras</option><option value="REVENDEDORAS">Revendas</option><option value="FORNECEDORES">Fornecedores</option></select></label>
            {campaign.channel!=='WHATSAPP'&&<label>Assunto do e-mail<input value={campaign.subject} onChange={e=>setCampaign({...campaign,subject:e.target.value})} placeholder="Assunto da apresentação"/></label>}
            {campaign.channel!=='EMAIL'&&<label>Nome do modelo aprovado na Meta<input value={campaign.template_name} onChange={e=>setCampaign({...campaign,template_name:e.target.value})} placeholder="Ex.: forte_apresentacao_v1"/><small>Preencha apenas com um modelo efetivamente aprovado na conta Meta.</small></label>}
            <label>Mensagem<textarea rows="7" maxLength={4000} value={campaign.body} onChange={e=>setCampaign({...campaign,body:e.target.value})} placeholder="Digite a mensagem comercial..."/></label>
            <label>Programar para (data e horário)<input type="datetime-local" value={campaign.scheduled_at||''} onChange={e=>setCampaign({...campaign,scheduled_at:e.target.value})}/></label>
            <div className="at-soft"><strong>{qualified.length} contato(s) elegível(is)</strong><small>Contatos sem autorização ou com opt-out não entram na seleção.</small></div>
            <div className="at-actions"><button className="at-primary" disabled={busy||!ready||!isAdmin} onClick={()=>task(()=>saveCampaign('RASCUNHO'))}>Salvar rascunho</button><button disabled={busy||!ready||!isAdmin} onClick={()=>task(()=>saveCampaign('PLANEJADA'))}>Registrar programação</button><button className="at-ghost" onClick={()=>{setCampaign(blankCampaign());setAlert('');}}>Nova campanha</button></div>
            <p className="at-warning">Nenhuma mensagem será enviada por esta tela enquanto os canais e o processamento programado não estiverem homologados.</p>
          </div>
        </section>
        <section className="at-card at-list"><h2>Campanhas cadastradas</h2>{!campaigns.length?<p className="at-muted">Nenhuma campanha salva.</p>:campaigns.map(c=><button key={c.id} className="at-item" onClick={()=>edit(c)}><strong>{c.title}</strong><small>{c.channel} · {c.status} · {formatDate(c.scheduled_at)}</small></button>)}</section>
      </div>}
      {tab==='agenda'&&<section className="at-card"><h2>Programações e transmissões</h2><p className="at-muted">Histórico das programações registradas, sujeitas à aprovação e ativação do processamento seguro.</p>{!scoped.length?<div className="at-empty">Ainda não há programações. Crie uma campanha e escolha data e horário.</div>:<div className="at-schedule">{scoped.map(c=><div className="at-schedule-item" key={c.id}><div><strong>{c.title}</strong><p>{c.channel} · {c.segment} · {formatDate(c.scheduled_at)}</p><small>{c.status==='PLANEJADA'?'Aguardando homologação do envio automático':c.status}</small></div><div className="at-actions"><button onClick={()=>edit(c)}>Editar</button>{c.status==='PLANEJADA'&&<button disabled={!isAdmin||busy} onClick={()=>task(()=>pause(c))}>Pausar</button>}</div></div>)}</div>}</section>}
      {tab==='contatos'&&<div className="at-columns"><section className="at-card"><h2>Cadastrar contato autorizado</h2><p className="at-muted">Cadastre somente contatos comerciais e registre autorização para marketing.</p><div className="at-form"><label>Nome<input value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})}/></label><label>WhatsApp (com DDD)<input value={contact.whatsapp} onChange={e=>setContact({...contact,whatsapp:e.target.value})}/></label><label>E-mail<input type="email" value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})}/></label><label>Segmento<select value={contact.segment} onChange={e=>setContact({...contact,segment:e.target.value})}><option value="CLIENTES">Clientes</option><option value="CONSTRUTORAS">Construtoras</option><option value="REVENDEDORAS">Revendas</option><option value="FORNECEDORES">Fornecedores</option></select></label><label className="at-checkbox"><input type="checkbox" checked={contact.consent_whatsapp} onChange={e=>setContact({...contact,consent_whatsapp:e.target.checked})}/> Autorizou comunicações comerciais por WhatsApp</label><label className="at-checkbox"><input type="checkbox" checked={contact.consent_email} onChange={e=>setContact({...contact,consent_email:e.target.checked})}/> Autorizou comunicações comerciais por e-mail</label><label>Origem da autorização<input value={contact.consent_source} onChange={e=>setContact({...contact,consent_source:e.target.value})} placeholder="Ex.: formulário do site / autorização documentada"/></label><button className="at-primary" disabled={!ready||!isAdmin||busy} onClick={()=>task(saveContact)}>Salvar contato</button></div></section>
      <section className="at-card at-list"><h2>Contatos ({contacts.length})</h2><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar nome, telefone ou e-mail"/>{contacts.filter(c=>(c.name+' '+c.whatsapp+' '+c.email).toLowerCase().includes(search.toLowerCase())).map(c=><div key={c.id} className="at-contact"><strong>{c.name}</strong><small>{c.whatsapp||'Sem telefone'} · {c.email||'Sem e-mail'}<br/>{c.segment}</small><div className="at-tags"><span>{c.consent_whatsapp&&!c.opted_out_whatsapp?'WhatsApp autorizado':'WhatsApp sem permissão'}</span><span>{c.consent_email&&!c.opted_out_email?'E-mail autorizado':'E-mail sem permissão'}</span></div><div className="at-actions">{c.consent_whatsapp&&!c.opted_out_whatsapp&&<button disabled={busy||!isAdmin} onClick={()=>task(()=>stopContact(c,'WHATSAPP'))}>Bloquear WhatsApp</button>}{c.consent_email&&!c.opted_out_email&&<button disabled={busy||!isAdmin} onClick={()=>task(()=>stopContact(c,'EMAIL'))}>Bloquear e-mail</button>}</div></div>)}</section></div>}
      {tab==='materiais'&&<section className="at-card"><h2>Biblioteca comercial Forte Atacarejo</h2><p className="at-muted">Modelos editáveis para e-mail, WhatsApp e futuras transmissões.</p><div className="at-actions" style={{marginBottom:18}}><button className="at-primary" onClick={downloadPresentation}>Baixar apresentação PDF</button></div><div className="at-template-grid">{examples.map(ex=><article className="at-template" key={ex.title}><span className="at-eyebrow">{ex.kind}</span><h3>{ex.title}</h3><p>{ex.body}</p><button className="at-primary" onClick={()=>useExample(ex)}>Usar na campanha</button></article>)}</div><div className="at-products"><h3>Portfólio de produtos</h3><p>{products.join(' · ')}</p><p><strong>Frota própria, rapidez e atendimento sem burocracia.</strong></p><p className="at-muted">Material comercial anexo só poderá ser enviado automaticamente quando o canal estiver homologado. A caixa de mensagens oficial permanece no menu Mensagens.</p></div></section>}
      <footer className="at-footer">FORTE ATENDE · Uso interno · Integração Meta existente preservada · E-mail corporativo pendente de habilitação</footer>
    </main>
  </div>;
}
