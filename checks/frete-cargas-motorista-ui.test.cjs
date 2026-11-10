const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const {JSDOM}=require('jsdom');

test('a tela do motorista mostra a própria carga e esconde cadastro alheio',async()=>{
 const code=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Painel from './apps/web/src/FreteCargasMotorista.jsx';
createRoot(document.getElementById('root')).render(<Painel painel={{motorista:{id:'mot',nome:'Motorista da sessao',placa:'ABC1D23',situacao:'LIBERADO PARA CARGAS',chavePix:'chave-nao-mostrar'},cargas:[{id:'c1',codigo:'CG-PROPRIA',fase:'A CAMINHO',localCarregamento:'Arcos',destino:'Catalão',pesoKg:40000,produto:'Cimento',numeroPedidoFornecedor:'PED-1',modalidadeFrete:'FOB',documentos:[{categoria:'COMPROVANTE ENTREGA',situacao:'RECEBIDO',storagePath:'secreto/arquivo.pdf'}]}],contasPagar:[{titulo:'TITULO-SIGILOSO'}]}}/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic'});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.test/?app=frete',runScripts:'outside-only',pretendToBeVisual:true});
 try{
  dom.window.eval(code.outputFiles[0].text);
  await new Promise(r=>setTimeout(r,30));
  const texto=dom.window.document.body.textContent;
  assert.match(texto,/Minhas cargas/);
  assert.match(texto,/CG-PROPRIA/);
  assert.match(texto,/COMPROVANTE ENTREGA: RECEBIDO/);
  assert.equal(texto.includes('chave-nao-mostrar'),false);
  assert.equal(texto.includes('TITULO-SIGILOSO'),false);
  assert.equal(texto.includes('secreto/arquivo.pdf'),false);
  assert.equal(texto.includes('GRAVAR NO OPERACIONAL'),false);
  assert.equal(texto.includes('LIBERAR PARA CARGAS'),false);
  assert.equal(dom.window.document.querySelector('a[href*="forte-frete"]'),null);
 }finally{dom.window.close();}
});
