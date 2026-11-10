const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const {JSDOM}=require('jsdom');

test('o painel grava, evita duplicata e libera o motorista sem sair do operacional',async()=>{
 const code=await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Painel from './apps/web/src/FreteMotoristaPainel.jsx';
function Harness(){const [rows,setRows]=useState([]);window.rows=()=>rows;return <Painel motoristas={rows} canEdit onSave={resultado=>setRows(resultado.motoristas)}/>;}
createRoot(document.getElementById('root')).render(<Harness/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic'});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.test',runScripts:'outside-only'});
 const wait=async fn=>{for(let i=0;i<50;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}assert.fail('painel não atualizou');};
 try{
  dom.window.eval(code.outputFiles[0].text);
  await wait(()=>dom.window.document.querySelector('[name=nome]'));
  const preencher=(name,value)=>{const input=dom.window.document.querySelector(`[name=${name}]`);const set=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  for(const [name,value] of [['nome','Motorista Operacional'],['cpf','11122233344'],['telefone','34999990000'],['cnhNumero','12345678901'],['proprietario','Transportadora'],['placa1','ABC1D23'],['capacidadeMaximaKg','48500'],['chavePix','pix-operacional'],['favorecidoPix','Transportadora'],['documentoTipo','CNH'],['storageBucket','documentos'],['storagePath','frete/cnh-1']])preencher(name,value);
  dom.window.document.querySelector('button[type=submit]').click();
  await wait(()=>dom.window.document.querySelector('[role=status]').textContent.includes('ainda inativo'));
  assert.equal(dom.window.rows().length,1);
  assert.equal(dom.window.rows()[0].ativo,false);
  assert.equal(dom.window.rows()[0].documentos[0].storagePath,'frete/cnh-1');
  assert.equal(dom.window.document.querySelector('a[href*="forte-frete"]'),null);
  dom.window.document.querySelector('button[type=submit]').click();
  await wait(()=>dom.window.document.querySelector('[role=status]').textContent.includes('já estava igual'));
  assert.equal(dom.window.rows().length,1);
  dom.window.document.querySelectorAll('button')[dom.window.document.querySelectorAll('button').length-1];
  [...dom.window.document.querySelectorAll('button')].find(botao=>botao.textContent.includes('LIBERAR PARA CARGAS')).click();
  await wait(()=>dom.window.document.querySelector('[role=status]').textContent.includes('liberado'));
  assert.equal(dom.window.rows()[0].ativo,true);
  assert.equal(dom.window.rows().length,1);
  assert.equal(dom.window.document.querySelector('[name=chavePix]').value,'pix-operacional');
  assert.doesNotMatch(dom.window.document.querySelector('[role=status]').textContent,/pix-operacional|11122233344/);
 }finally{dom.window.close();}
});
