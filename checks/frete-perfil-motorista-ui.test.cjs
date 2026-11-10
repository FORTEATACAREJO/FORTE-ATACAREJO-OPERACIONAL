const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const {JSDOM}=require('jsdom');

test('o motorista aceita a carga de homologação no celular sem Pix e sem o site antigo',async()=>{
 const code=await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Painel from './apps/web/src/FreteMotoristaOperacao.jsx';
const inicial=[{id:'c1',codigo:'HML-001',origem:'Arcos',destino:'Caldas Novas',produto:'Cimento',pesoKg:30000,status:'OFERECIDA',sandbox:true}];
function Harness(){const [rows,setRows]=useState(inicial);window.rows=()=>rows;return <Painel userId="motorista-1" cargas={rows} onChange={proxima=>setRows(atual=>atual.map(item=>item.id===proxima.id?proxima:item))}/>;}
createRoot(document.getElementById('root')).render(<Harness/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic'});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.test',runScripts:'outside-only',pretendToBeVisual:true});
 dom.window.innerWidth=390;
 const wait=async fn=>{for(let i=0;i<50;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}assert.fail('painel não atualizou');};
 try{
  dom.window.eval(code.outputFiles[0].text);
  await wait(()=>dom.window.document.querySelector('[data-frete-operacao]'));
  const texto=()=>dom.window.document.body.textContent;
  assert.match(texto(),/HML-001/);
  assert.equal(dom.window.document.querySelector('a[href*="forte-frete"]'),null);
  assert.doesNotMatch(texto(),/pix|cpf|senha|token/i);
  const aceitar=[...dom.window.document.querySelectorAll('button')].find(botao=>botao.textContent.includes('ACEITAR CARGA'));
  assert.ok(aceitar);
  assert.equal(aceitar.style.minHeight,'44px');
  const recusar=[...dom.window.document.querySelectorAll('button')].find(botao=>botao.textContent.includes('RECUSAR CARGA'));
  recusar.click();
  await wait(()=>dom.window.document.querySelector('[role=status]').textContent.includes('motivo'));
  assert.equal(dom.window.rows()[0].status,'OFERECIDA');
  aceitar.click();
  await wait(()=>dom.window.document.querySelector('[role=status]').textContent.includes('continua inativo'));
  assert.equal(dom.window.rows()[0].status,'ACEITA');
  assert.equal(dom.window.rows()[0].ativo,undefined);
  const campo=dom.window.document.querySelector('[name=sha256]');
  const set=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
  set.call(campo,'a'.repeat(64));
  campo.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  campo.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  dom.window.document.querySelector('form').requestSubmit();
  await wait(()=>dom.window.document.querySelector('[role=status]').textContent.includes('não foi copiado'));
  assert.equal(dom.window.rows()[0].anexoSha256,'a'.repeat(64));
  assert.equal(dom.window.rows()[0].anexoPath,'motorista-1/c1/comprovante');
  assert.equal(dom.window.document.querySelector('a[href*="forte-frete"]'),null);
  assert.equal(dom.window.innerWidth,390);
 }finally{dom.window.close();}
});
