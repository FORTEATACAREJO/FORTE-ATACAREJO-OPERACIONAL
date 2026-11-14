/* Controles de instalação, compartilhamento e abertura externa do PWA.
 * Safari no iOS não oferece prompt de instalação por JavaScript:
 * orientar o usuário a usar Compartilhar > Adicionar à Tela de Início.
 */
(function(){
  'use strict';
  if (!document.body || document.getElementById('ft-app-actions')) return;

  var ua=navigator.userAgent||'';
  var ios=/iPhone|iPad|iPod/i.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  var android=/Android/i.test(ua);
  var chromeAndroid=android && /Chrome\//i.test(ua) && !/; wv\)|\bwv\b/i.test(ua);
  var safariIOS=ios && /Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  var standalone=window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  var deferredInstall=null;

  var style=document.createElement('style');
  style.textContent=[
    '#ft-app-actions{background:#eaf0f7;border-bottom:1px solid #cdd8e5;color:#17334d;padding:10px 16px;font:inherit}',
    '#ft-app-actions *{box-sizing:border-box}',
    '#ft-app-actions .ft-actions-inner{max-width:1060px;margin:auto;display:flex;flex-wrap:wrap;align-items:center;gap:9px}',
    '#ft-app-actions .ft-actions-label{font-size:12px;font-weight:750;margin-right:4px}',
    '#ft-app-actions .ft-action-btn{flex:1 1 142px;min-height:43px;border:1px solid #b7c7d8;border-radius:10px;background:white;color:#102640;padding:9px 11px;font-size:13px;font-weight:750;cursor:pointer;text-align:center}',
    '#ft-app-actions .ft-action-btn.ft-primary{background:#d4a743;border-color:#bd953a;color:#102640}',
    '#ft-app-actions .ft-action-btn:focus-visible{outline:3px solid #1675cf;outline-offset:2px}',
    '#ft-app-actions .ft-action-btn:disabled{opacity:.6;cursor:default}',
    '#ft-app-actions .ft-actions-guide{max-width:1060px;margin:10px auto 0;background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:13px 15px;line-height:1.5}',
    '#ft-app-actions .ft-actions-guide[hidden]{display:none!important}',
    '#ft-app-actions .ft-guide-top{display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '#ft-app-actions .ft-guide-title{font-size:14px;font-weight:800}',
    '#ft-app-actions .ft-guide-text{margin:8px 0 10px;font-size:13px;white-space:pre-line}',
    '#ft-app-actions .ft-guide-bottom{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '#ft-app-actions .ft-guide-bottom button,#ft-app-actions .ft-guide-bottom a{background:#102640;color:white;border:0;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:700;text-decoration:none;cursor:pointer}',
    '#ft-app-actions .ft-guide-bottom input{flex:1 1 240px;min-width:0;min-height:35px;border:1px solid #cbd5e1;border-radius:7px;padding:7px;font-size:12px}',
    '#ft-app-actions .ft-close{border:0;background:transparent;color:#203a57;padding:5px 8px;cursor:pointer;font-size:18px}',
    '@media(max-width:600px){#ft-app-actions .ft-actions-label{flex-basis:100%}#ft-app-actions .ft-action-btn{flex:1 1 135px}#ft-app-actions .ft-actions-inner{gap:7px}}',
    '@media print{#ft-app-actions{display:none!important}}'
  ].join('');
  document.head.appendChild(style);

  var bar=document.createElement('nav');
  bar.id='ft-app-actions';
  bar.setAttribute('aria-label','Instalar ou compartilhar FORTECOMPANNY+ IA');
  bar.innerHTML=
    '<div class="ft-actions-inner">'+
      '<span class="ft-actions-label">FORTECOMPANNY+ IA no celular</span>'+
      '<button id="ft-install" class="ft-action-btn ft-primary" type="button">⬇ Instalar aplicativo</button>'+
      '<button id="ft-share" class="ft-action-btn" type="button">↗ Compartilhar</button>'+
      '<button id="ft-open-browser" class="ft-action-btn" type="button">🌐 Abrir no navegador</button>'+
    '</div>'+
    '<section class="ft-actions-guide" id="ft-guide" hidden aria-live="polite">'+
      '<div class="ft-guide-top"><strong class="ft-guide-title" id="ft-guide-title"></strong>'+
      '<button type="button" class="ft-close" id="ft-guide-close" aria-label="Fechar instruções">×</button></div>'+
      '<p class="ft-guide-text" id="ft-guide-text"></p>'+
      '<div class="ft-guide-bottom">'+
        '<input type="text" id="ft-guide-link" aria-label="Link do aplicativo" readonly>'+
        '<button type="button" id="ft-copy">Copiar link</button>'+
        '<a id="ft-whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a>'+
      '</div>'+
    '</section>';
  var header=document.querySelector('header');
  if(header)header.insertAdjacentElement('afterend',bar);
  else document.body.insertBefore(bar,document.body.firstChild);

  function el(id){return document.getElementById(id)}
  var installBtn=el('ft-install');
  var browserBtn=el('ft-open-browser');
  var appUrl=location.origin+location.pathname+location.search;
  // Compartilhamento sempre aponta para a entrada do aplicativo, não para dados de consulta.
  var shareUrl=location.origin+'/';
  el('ft-guide-link').value=shareUrl;
  el('ft-whatsapp').href='https://wa.me/?text='+encodeURIComponent('FORTECOMPANNY+ IA: '+shareUrl);
  browserBtn.textContent=ios?'🌐 Abrir no Safari':android?'🌐 Abrir no Chrome':'🌐 Abrir no navegador';
  if(standalone){installBtn.disabled=true;installBtn.textContent='✓ Aplicativo instalado'}

  function showGuide(title,message,url){
    el('ft-guide-title').textContent=title;
    el('ft-guide-text').textContent=message;
    el('ft-guide-link').value=url||shareUrl;
    el('ft-guide').hidden=false;
  }
  el('ft-guide-close').addEventListener('click',function(){el('ft-guide').hidden=true});

  function installGuide(){
    if(ios){
      showGuide('Instalar no iPhone ou iPad',
        '1. Abra este link no Safari.\n2. No Safari, toque em Compartilhar (quadrado com seta para cima).\n3. Selecione Adicionar à Tela de Início e confirme em Adicionar.\nSe estiver dentro de outro aplicativo, use Abrir no Safari ou copie o link abaixo.',shareUrl);
    }else if(android){
      showGuide('Instalar no Android',
        'Abra o endereço no Google Chrome. Toque no menu ⋮ e escolha Instalar aplicativo ou Adicionar à tela inicial. Confirme a instalação. Se o navegador não mostrar a opção, verifique se a página foi aberta no Chrome, fora do navegador interno do WhatsApp ou de outros aplicativos.',shareUrl);
    }else{
      showGuide('Instalação do aplicativo',
        'Abra a página no Chrome ou Edge e use Instalar aplicativo na barra de endereço ou no menu do navegador. A disponibilidade depende do navegador e das condições de instalação.',shareUrl);
    }
  }

  window.addEventListener('beforeinstallprompt',function(event){
    event.preventDefault();
    deferredInstall=event;
    if(!standalone){installBtn.disabled=false;installBtn.textContent='⬇ Instalar aplicativo'}
  });
  window.addEventListener('appinstalled',function(){
    standalone=true;deferredInstall=null;
    installBtn.disabled=true;installBtn.textContent='✓ Aplicativo instalado';
    showGuide('Aplicativo instalado','O FORTECOMPANNY+ IA está disponível na tela inicial ou na lista de aplicativos.',shareUrl);
  });
  installBtn.addEventListener('click',async function(){
    if(deferredInstall){
      var promptEvent=deferredInstall;deferredInstall=null;
      try{
        await promptEvent.prompt();
        var choice=await promptEvent.userChoice;
        if(choice && choice.outcome!=='accepted') installGuide();
      }catch(err){installGuide()}
    }else installGuide();
  });

  async function copyLink(value){
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(value);return true;
      }
    }catch(err){}
    try{
      var input=el('ft-guide-link');input.value=value;input.focus();input.select();
      return document.execCommand('copy');
    }catch(err){return false}
  }
  el('ft-copy').addEventListener('click',async function(){
    var value=el('ft-guide-link').value;
    var copied=await copyLink(value);
    el('ft-copy').textContent=copied?'Link copiado!':'Selecione o link';
    if(!copied)el('ft-guide-link').select();
  });

  el('ft-share').addEventListener('click',async function(){
    if(navigator.share){
      try{
        await navigator.share({title:'FORTECOMPANNY+ IA',text:'Consulta fiscal orientativa',url:shareUrl});
        return;
      }catch(err){if(err && err.name==='AbortError')return}
    }
    showGuide('Compartilhar aplicativo',
      'Copie o endereço ou use o botão do WhatsApp. O link abre a versão pública no navegador, sem compartilhar dados preenchidos na consulta.',shareUrl);
  });

  browserBtn.addEventListener('click',async function(){
    if(ios){
      showGuide('Abrir no Safari',
        safariIOS?'Esta página já está no Safari. Para instalar, use Compartilhar > Adicionar à Tela de Início.':
          'O iPhone não permite que esta página force a abertura do Safari. Copie o link abaixo, abra o Safari e cole-o na barra de endereços. Depois, use Compartilhar > Adicionar à Tela de Início.',appUrl);
      return;
    }
    if(android){
      showGuide('Abrir no Chrome',
        chromeAndroid?'Se você já está no Chrome, use o menu ⋮ > Instalar aplicativo ou Adicionar à tela inicial.':
          'Tentando abrir o Google Chrome. Se não abrir, copie o link abaixo e cole na barra de endereços do Chrome. Depois, use ⋮ > Instalar aplicativo.',appUrl);
      if(!chromeAndroid){
        var intent='intent://'+location.host+location.pathname+location.search+
          '#Intent;scheme='+location.protocol.replace(':','')+
          ';package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(appUrl)+';end';
        location.href=intent;
      }
      return;
    }
    showGuide('Abrir no navegador','Abra ou copie o endereço abaixo para visitar o FORTECOMPANNY+ IA em outro navegador.',appUrl);
  });

  if('serviceWorker' in navigator && window.isSecureContext){
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});
  }
})();