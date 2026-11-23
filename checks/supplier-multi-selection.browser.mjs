import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.FORTE_PLAYWRIGHT_MODULE||'../qa/node_modules/playwright/index.mjs');
import path from 'node:path';

const root=process.cwd();
const fixture={
 fornecedores:[{id:'cip',nome:'CIPLAN',cnpj:'00057240000122',
  modalidadeFrete:'CIF',condicaoPaletes:'SEM_PALETES',prazosPagamento:['14 dias'],
  produtosNegociados:[{produtoId:'p1',custoUnitario:31}]
 }],
 unidades:[{id:'go',nome:'Filial',cnpj:'49832961000232'}],
 produtos:[
  {id:'p1',nome:'CIMENTO CIPLAN CP II 50 KG',marca:'CIPLAN',finalidade:'REVENDA'},
  {id:'p2',nome:'CIMENTO CIPLAN EXTRA FORTE 40 KG',marca:'CIPLAN',finalidade:'REVENDA'},
  {id:'p3',nome:'CIMENTO CIPLAN ARI 40 KG',marca:'CIPLAN',finalidade:'REVENDA'},
  {id:'uso',nome:'INSUMO INTERNO',finalidade:'USO CONSUMO'}
 ]
};
const source=`import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Registry from './apps/web/src/PedidosFTQuickRegistry.jsx';
function App(){
 const [data,setData]=useState(${JSON.stringify(fixture)});
 const [closed,setClosed]=useState(false);
 const save=async (kind,item)=>{
  window.savedSupplier=item;
  setData(state=>({...state,fornecedores:state.fornecedores.map(f=>f.id===item.id?item:f)}));
 };
 return closed?<p>Cadastro salvo com sucesso</p>:
  <Registry request={{kind:'fornecedores',mode:'edit',id:'cip'}} data={data}
   onSave={save} onClose={()=>setClosed(true)}/>;
}
createRoot(document.getElementById('root')).render(<App/>);`;
const bundle=await build({stdin:{contents:source,resolveDir:root,sourcefile:'supplier-bulk-harness.jsx',loader:'jsx'},bundle:true,jsx:'automatic',write:false,format:'iife',outfile:'supplier-bulk.js',
 plugins:[{name:'mock-supabase',setup(b){
  b.onResolve({filter:/^\.\/supabase(?:\.js)?$/},()=>({path:'mock',namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase=null;export const getAuthContext=()=>null;'}));
 }}]
});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
for(const size of [{width:390,height:844},{width:1200,height:980}]){
 const page=await browser.newPage({viewport:size});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://fixture.test/**',route=>route.fulfill({contentType:'text/html',body:'<html lang="pt-BR"><head><meta name="viewport" content="width=device-width"></head><body><div id="root"></div></body></html>'}));
 await page.goto('https://fixture.test');
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:js});
 const modal=page.getByRole('dialog',{name:'Cadastro rápido de Fornecedor'});
 await modal.waitFor();
 assert.equal(await modal.getByRole('checkbox',{name:'14 dias',exact:true}).isChecked(),true);
 await modal.getByRole('combobox',{name:'Forma de pagamento',exact:true}).selectOption('BOLETO');
 const custom=modal.getByLabel('Outros prazos em dias');
 await custom.fill('7,14,21,28');
 assert.equal(await custom.inputValue(),'7,14,21,28');
 await modal.getByRole('button',{name:'+ Adicionar prazos'}).click();
 assert.equal(await custom.inputValue(),'');
 for(const day of ['7 dias','14 dias','21 dias','28 dias'])assert.equal(await modal.getByRole('checkbox',{name:day,exact:true}).isChecked(),true);
 // Outras sintaxes acrescentam só os vencimentos ainda não presentes.
 await custom.fill('7/14/21');
 await modal.getByRole('button',{name:'+ Adicionar prazos'}).click();
 await custom.fill('7,abc');
 await modal.getByRole('button',{name:'+ Adicionar prazos'}).click();
 assert.equal(await modal.getByRole('alert').count(),1);
 assert.match(await modal.getByRole('alert').innerText(),/Use números separados/);
 await custom.fill('');
 await page.waitForFunction(()=>document.querySelector('.ft-supplier-due-summary')?.textContent?.includes('7/14/21/28 dias'));
 assert.match(await modal.locator('.ft-supplier-due-summary').innerText(),/7\/14\/21\/28 dias/);
 await modal.getByLabel('Pesquisar produtos para vincular').fill('CIPLAN');
 assert.equal(await modal.getByRole('checkbox',{name:/CIMENTO CIPLAN/}).count(),2,'Dois produtos ainda não vinculados');
 await modal.getByRole('button',{name:'Marcar todos os exibidos (2)'}).click();
 await modal.getByRole('button',{name:'VINCULAR 2 PRODUTOS SELECIONADOS'}).click();
 assert.equal(await modal.locator('.ft-supplier-linked-product').count(),3);
 await modal.getByLabel('Custo negociado CIMENTO CIPLAN EXTRA FORTE 40 KG').fill('30');
 await modal.getByLabel('Custo negociado CIMENTO CIPLAN ARI 40 KG').fill('28');
 await modal.getByRole('button',{name:'Salvar e voltar ao pedido'}).click();
 await page.getByText('Cadastro salvo com sucesso',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>window.savedSupplier);
 assert.equal(saved.condicaoPagamento,'7/14/21/28 dias');
 assert.deepEqual(saved.prazosNegociadosDias,[7,14,21,28]);
 assert.deepEqual(saved.prazosPagamento,['7/14/21/28 dias']);
 assert.equal(saved.formaPagamentoPadrao,'BOLETO');
 assert.deepEqual(saved.produtosNegociados.map(x=>x.produtoId),['p1','p2','p3']);
 assert.deepEqual(saved.produtosNegociados.map(x=>x.custoUnitario),[31,30,28]);
 assert.deepEqual(errors,[]);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
 console.log('PASS: fornecedor prazos multi, método independente e produtos em lote, largura '+size.width);
 await page.close();
}
await browser.close();
