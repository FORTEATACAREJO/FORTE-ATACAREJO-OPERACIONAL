import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../ficha-exportacao.js',import.meta.url),'utf8');

function runtime(){
 const element=()=>({value:'',hidden:true,checked:false,disabled:false,textContent:'',events:{},addEventListener(k,fn){this.events[k]=fn},focus(){},select(){},click(){this.clicked=true},remove(){}});
 const ids=['exportDetails','exportGenerate','exportCopy','exportDownload','exportPersonalData','exportJsonPreview','exportStatus'];
 const els=Object.fromEntries(ids.map(x=>[x,element()]));
 const requests={copied:[],blobs:[],download:null};
 const doc={getElementById:k=>els[k],createElement:()=>element(),body:{appendChild(a){requests.download=a}}};
 class FakeBlob{constructor(parts,options){this.parts=parts;this.options=options}}
 class FakeURL extends URL{
  static createObjectURL(blob){requests.blobs.push(blob);return 'blob:demo'}
  static revokeObjectURL(){}
 }
 const win={};
 vm.runInNewContext(source,{window:win,document:doc,navigator:{clipboard:{writeText:async value=>requests.copied.push(value)}},Blob:FakeBlob,URL:FakeURL,setTimeout:()=>0},{timeout:1000});
 return {win,els,requests};
}
function fixture(){
 return {
  input:{product:'Argamassa 49.832.961/0002-32',profile:'revenda',nature:'venda_revenda',goodsOrigin:'terceiros',priorSt:'sim',buyerTaxStatus:'unknown'},
  from:{uf:'GO',cnpj:'49832961000232',name:'FORTE ATACAREJO',registrations:[]},
  to:{uf:'MG',cnpj:'15512971000198',name:'EMPRESA DESTINO',registrations:[]},
  info:{code:'32149000',official:{entry:{nivel:'8'}},suggest:{cest:'1000300'},cests:[{cest:'1000300'}]},
  fiscal:{cfop:'6.102 ou 6.108',confidence:'Alternativas',st:'Em análise',difal:'A verificar',costWarning:'Possível ST adicional',sources:[{label:'SEF/MG',url:'https://www.fazenda.mg.gov.br/'}],pending:['Conferir IE']},
  audit:{stage:'nao_homologado',canIssue:false,issues:[{code:'IE',text:'IE não confirmada'}]},
  rules:{verifiedRules:[],verifiedRuleCount:0}
 };
}
test('consulta não homologada é a única elegível para exportação orientativa',()=>{
 const {win}=runtime();
 const obj=fixture();obj.audit.canIssue=true;
 assert.throws(()=>win.FORTE_FICHA_EXPORTACAO.setSnapshot(obj));
});
test('documentos e nomes nunca são exportados sem autorização',()=>{
 const {win,els}=runtime();
 win.FORTE_FICHA_EXPORTACAO.setSnapshot(fixture());els.exportGenerate.events.click();
 const body=els.exportJsonPreview.value;
 assert.ok(!body.includes('49832961000232'));
 assert.ok(!body.includes('15512971000198'));
 assert.ok(!body.includes('FORTE ATACAREJO'));
 assert.ok(!body.includes('EMPRESA DESTINO'));
 assert.ok(!body.includes('49.832.961/0002-32'));
 assert.match(body,/documento omitido/);
});
test('a ficha está marcada como orientação, não NF-e',()=>{
 const {win,els}=runtime();win.FORTE_FICHA_EXPORTACAO.setSnapshot(fixture());
 els.exportGenerate.events.click();const data=JSON.parse(els.exportJsonPreview.value);
 assert.equal(data.nfe.emitida,false);
 assert.equal(data.nfe.transmitida,false);
 assert.equal(data.validacao.can_use_for_automatic_issuing,false);
 assert.equal(data.tipo,'consulta_orientativa_nao_homologada');
 assert.equal(data.schema_version,'1.0.0');
});
test('NCM e CEST são apresentados como sugestões e fonte legal preservada',()=>{
 const {win,els}=runtime();win.FORTE_FICHA_EXPORTACAO.setSnapshot(fixture());
 els.exportGenerate.events.click();const data=JSON.parse(els.exportJsonPreview.value);
 assert.equal(data.produtos[0].ncm,'32149000');
 assert.equal(data.produtos[0].cest,'1000300');
 assert.equal(data.produtos[0].ncm_status,'codigo_encontrado_classificacao_a_confirmar');
 assert.equal(data.fiscal_orientativo.fundamento_fontes[0].url,'https://www.fazenda.mg.gov.br/');
});
test('incluir identificadores exige escolha explícita e nova geração',()=>{
 const {win,els}=runtime();win.FORTE_FICHA_EXPORTACAO.setSnapshot(fixture());
 els.exportGenerate.events.click();
 els.exportPersonalData.checked=true;els.exportPersonalData.events.change();
 assert.equal(els.exportDownload.disabled,true);
 els.exportGenerate.events.click();const data=JSON.parse(els.exportJsonPreview.value);
 assert.equal(data.operacao.remetente.cnpj_ou_cpf,'49832961000232');
 assert.equal(data.operacao.destinatario.razao_social,'EMPRESA DESTINO');
});
test('alterar ou limpar a consulta bloqueia a reutilização de uma ficha antiga',()=>{
 const {win,els}=runtime();win.FORTE_FICHA_EXPORTACAO.setSnapshot(fixture());
 els.exportGenerate.events.click();win.FORTE_FICHA_EXPORTACAO.clearSnapshot();
 assert.equal(els.exportDetails.hidden,true);
 assert.equal(els.exportCopy.disabled,true);
 assert.equal(els.exportJsonPreview.value,'');
});
test('copiar e baixar são operações locais, sem transmissão automática',async()=>{
 const {win,els,requests}=runtime();win.FORTE_FICHA_EXPORTACAO.setSnapshot(fixture());
 els.exportGenerate.events.click();await els.exportCopy.events.click();els.exportDownload.events.click();
 assert.equal(requests.copied.length,1);
 assert.equal(requests.blobs.length,1);
 assert.match(requests.download.download,/FORTECOMPANNY_ficha_orientativa/);
});
