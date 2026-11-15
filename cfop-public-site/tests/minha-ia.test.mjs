import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const code=readFileSync(new URL("../minha-ia.js",import.meta.url),"utf8");
function fake(){
 const mk=()=>({
  value:"",textContent:"",hidden:false,open:false,selectedOptions:[{textContent:"Venda para revenda"}],
  events:{},addEventListener(name,fn){this.events[name]=fn},focus(){this.focused=true},
  querySelector(){return null},querySelectorAll(){return []}
 });
 const ids=["aiProvider","aiStatus","aiOpen","aiCopy","aiManualPrompt","aiSettings","nature","goodsOrigin","priorStContainer","priorSt","product","buyerTaxStatus","results"];
 const e=Object.fromEntries(ids.map(k=>[k,mk()]));
 e.product.value="Cimento CP II";
 e.goodsOrigin.selectedOptions=[{textContent:"Comprado de terceiros"}];
 e.priorSt.selectedOptions=[{textContent:"Sim, retida na compra"}];
 e.results.querySelector=x=>x==="p.muted"?{textContent:"Perfil: Revenda · Venda para revenda · GO → MG"}:x===".result-value"?{textContent:"6.403 hipótese"}:null;
 e.results.querySelectorAll=x=>x===".result-compact>div strong"?[{textContent:"Cimento CP II"},{textContent:"2523.29.90"},{textContent:"05.001.00"}]:[];
 const d={getElementById:k=>e[k],querySelector:sel=>sel==='input[name="userProfile"]:checked'?{value:"revenda"}:null};
 const calls={open:[],copy:[],save:[]};
 const nav={clipboard:{writeText:async text=>calls.copy.push(text)}};
 const storage={getItem:()=>null,setItem:(k,v)=>calls.save.push([k,v]),removeItem:()=>{}};
 const w={open:(url,where,flags)=>{calls.open.push({url,where,flags});return null}};
 vm.runInNewContext(code,{document:d,window:w,navigator:nav,localStorage:storage},{timeout:1000});
 return{e,calls};
}
test("sem IA escolhida abre configuracao e nunca envia prompt",async()=>{
 const {e,calls}=fake();
 await e.aiOpen.events.click();
 assert.equal(e.aiSettings.open,true);
 assert.equal(calls.open.length,0);
 assert.equal(calls.copy.length,0);
});
test("usuário escolhe ChatGPT e a preferência fica no aparelho",async()=>{
 const {e,calls}=fake();
 e.aiProvider.value="chatgpt";e.aiProvider.events.change();
 await e.aiOpen.events.click();
 assert.equal(calls.save[0][1],"chatgpt");
 assert.equal(calls.open[0].url,"https://chatgpt.com/");
 assert.equal(calls.open[0].flags,"noopener,noreferrer");
 assert.match(calls.copy[0],/Cimento CP II/);
 assert.match(calls.copy[0],/GO;/);
});
test("solicitação não transmite dados de pessoa ou empresa do cadastro",async()=>{
 const {e,calls}=fake();
 e.product.value="Produto 49832961000232";
 e.aiProvider.value="gemini";e.aiProvider.events.change();
 await e.aiOpen.events.click();
 const text=calls.copy[0];
 assert.doesNotMatch(text,/49832961000232/);
 assert.doesNotMatch(text,/RIVANANA IMOVEIS/);
 assert.equal(calls.open[0].url,"https://gemini.google.com/app");
});
test("outra IA funciona sem direcionamento forçado",async()=>{
 const {e,calls}=fake();
 e.aiProvider.value="outro";e.aiProvider.events.change();
 await e.aiOpen.events.click();
 assert.equal(calls.open.length,0);
 assert.equal(calls.copy.length,1);
});
test("ausência de clipboard fornece texto manual",async()=>{
 const {e,calls}=fake();
 e.aiProvider.value="claude";e.aiProvider.events.change();
 await e.aiCopy.events.click();
 // A simulação tem clipboard: o botão copia sem abrir outro site.
 assert.equal(calls.open.length,0);
 assert.equal(calls.copy.length,1);
});
