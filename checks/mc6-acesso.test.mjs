import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {autorizarMc6} from '../apps/web/src/mc6-acesso.mjs';

const engenharia={userId:'ensaio-1',origem:'app_metadata',appMetadata:{papel:'engenharia'}};

test('mc6 só lê o schema próprio e recusa frete, metadado de usuário e hardware',()=>{
 assert.equal(autorizarMc6({}).permitido,false);
 assert.equal(autorizarMc6({sessao:{userId:'1',origem:'user_metadata',userMetadata:{papel:'engenharia'}}}).motivo,'perfil_engenharia_ausente');
 assert.equal(autorizarMc6({sessao:engenharia,projectRef:'nkynfboqwfxhhxcsrawl'}).motivo,'projeto_ainda_e_frete_legado');
 assert.equal(autorizarMc6({sessao:engenharia,schema:'public'}).motivo,'schema_fora_do_mc6');
 assert.equal(autorizarMc6({sessao:engenharia,comando:'ligar motor'}).motivo,'hardware_sem_validacao');
 assert.equal(autorizarMc6({sessao:engenharia,comando:'partir solda'}).motivo,'hardware_sem_validacao');
 const leitura=autorizarMc6({sessao:engenharia});
 assert.equal(leitura.permitido,true);
 assert.equal(leitura.esquema,'mc6');
 assert.equal(leitura.cad,'');
 assert.equal(leitura.hardware,false);
 const fontes=['apps/web/src/App.jsx','apps/web/src/Mc6Acesso.jsx','apps/web/src/mc6-acesso.mjs'].map(arquivo=>readFileSync(new URL('../'+arquivo,import.meta.url),'utf8')).join('\n');
 assert.equal(fontes.includes('Mc6Acesso'),true);
 assert.equal(fontes.includes("import Mc6Acesso"),false);
});
test('a tela pede login e não aciona equipamento',async()=>{
 const codigo=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Painel from './apps/web/src/Mc6Acesso.jsx';
createRoot(document.getElementById('root')).render(<Painel provedor="ensaio" sessao={{userId:'ensaio-1',origem:'app_metadata',appMetadata:{papel:'engenharia'}}}/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic'});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.test',runScripts:'outside-only'});
 const esperar=async fn=>{for(let i=0;i<50;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('tela não atualizou');};
 try{
  dom.window.eval(codigo.outputFiles[0].text);
  await esperar(()=>dom.window.document.querySelector('form'));
  dom.window.document.querySelector('form').requestSubmit();
  await esperar(()=>dom.window.document.querySelector('[role=status]').textContent.includes('Leitura'));
  assert.match(dom.window.document.body.textContent,/schema mc6/);
  [...dom.window.document.querySelectorAll('button')].find(botao=>botao.textContent.includes('ACIONAR EQUIPAMENTO')).click();
  await esperar(()=>dom.window.document.querySelector('[role=status]').textContent.includes('hardware bloqueado'));
  assert.equal(dom.window.document.body.textContent.includes('nkynfboqwfxhhxcsrawl'),false);
 }finally{dom.window.close();}
});
