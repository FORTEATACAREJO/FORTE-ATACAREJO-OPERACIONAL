import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {loteSintetico,empresaId} from './frete-snapshot-fixture.mjs';

test('a área admin completa pendência real e não grava cadastro fictício nem o banco antigo',async()=>{
 const codigo=await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Painel from './apps/web/src/FretePendenciasPainel.jsx';
function Harness(){const [rows,setRows]=useState([]);window.rows=()=>rows;return <Painel canEdit onPromover={resultado=>setRows(resultado.motoristas)}/>;}
createRoot(document.getElementById('root')).render(<Harness/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic'});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.test',runScripts:'outside-only'});
 Object.defineProperty(dom.window,'crypto',{value:globalThis.crypto,configurable:true});
 dom.window.TextEncoder=TextEncoder;
 dom.window.TextDecoder=TextDecoder;
 const esperar=async fn=>{for(let i=0;i<80;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,15));}assert.fail('painel não atualizou');};
 try{
  dom.window.eval(codigo.outputFiles[0].text);
  await esperar(()=>dom.window.document.querySelector('[name=lote]'));
  const definir=(name,value)=>{const input=dom.window.document.querySelector(`[name="${name}"]`);const proto=input.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
  definir('empresaId',empresaId);
  definir('lote',JSON.stringify(loteSintetico()));
  [...dom.window.document.querySelectorAll('button')].find(botao=>botao.textContent.includes('LER LOTE')).click();
  await esperar(()=>dom.window.document.querySelector('[role=status]').textContent.includes('sem dado fictício'));
  assert.equal(dom.window.document.body.textContent.includes('nao-copiar'),false);
  assert.equal(dom.window.document.body.textContent.includes('NÃO INFORMADO'),false);
  assert.equal(dom.window.document.body.textContent.includes('tok-segredo'),false);
  assert.match(dom.window.document.body.textContent,/pendência/);
  const cnh=dom.window.document.querySelector('input[name$=":cnh"]');
  assert.ok(cnh);
  const set=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
  set.call(cnh,'CNH-COMPLEMENTAR');
  cnh.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  cnh.closest('tr').querySelector('button').click();
  await esperar(()=>/Valor recusado|Complemento aceito|Ainda há campos/.test(dom.window.document.querySelector('[role=status]').textContent));
  assert.equal(dom.window.document.body.textContent.includes('NÃO INFORMADO'),false);
  [...dom.window.document.querySelectorAll('button')].find(botao=>botao.textContent.includes('PREPARAR INATIVOS')).click();
  await esperar(()=>dom.window.document.querySelector('[role=status]').textContent.includes('banco antigo permanece'));
  assert.equal(dom.window.rows().every(item=>item.ativo===false),true);
  assert.equal(dom.window.rows().some(item=>item.nome==='Motorista Sintético 1'),true);
  assert.equal(dom.window.document.querySelector('a[href*="onrender"]'),null);
  const fontes=readFileSync(new URL('../apps/web/src/App.jsx',import.meta.url),'utf8');
  assert.match(fontes,/FretePendenciasPainel/);
  assert.match(fontes,/!freteMode && canAccessTab\("motorista", "editar"\)/);
 }finally{dom.window.close();}
});
