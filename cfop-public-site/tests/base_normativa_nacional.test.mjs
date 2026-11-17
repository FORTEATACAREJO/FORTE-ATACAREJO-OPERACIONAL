import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../base-normativa-nacional.js',import.meta.url),'utf8');
const win={};vm.runInNewContext(src,{window:win},{timeout:1000});
const api=win.FORTE_BASE_NORMATIVA;
test('todos os 26 estados e DF estão cobertos pelo controle de fontes, sem rota ou XML',()=>{
 assert.equal(api.UFS.length,27);
 assert.equal(new Set(api.UFS).size,27);
 assert.equal(api.TOPICS.length,13);
 assert.equal(api.coverage([...api.UFS].map(uf=>({uf}))).federativeUnitsRegistered,27);
 assert.equal(api.coverage([...api.UFS].map(uf=>({uf}))).xmlRequired,false);
});
test('link de portal oficial sem dispositivo legal não configura ato normativo revisado',()=>{
 const r=api.analyzeAct({uf:'SP',tema:'ICMS_GERAL',fonte_url:'https://legislacao.fazenda.sp.gov.br/Paginas/Home.aspx'});
 assert.equal(r.legallyDocumented,false);
 assert.equal(r.taxRuleApproved,false);
 assert.equal(r.xmlRequired,false);
});
test('fonte falsa, HTTP e host semelhante a gov.br são rejeitados',()=>{
 assert.equal(api.officialSource('https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18'),true);
 assert.equal(api.officialSource('https://legislacao.fazenda.sp.gov.br.evil.net/x'),false);
 assert.equal(api.officialSource('http://www.gov.br/receita'),false);
});
test('ato sintético documentado pode ser revisado sem NF-e e sem aprovar imposto',()=>{
 const act={uf:'SP',tema:'ICMS_GERAL',fonte_url:'https://legislacao.fazenda.sp.gov.br/Paginas/ato-ficticio',
 ato_normativo:'ATO SIMULADO SEM VALOR LEGAL',dispositivo:'Art. 1º fictício',publicado_em:'2026-01-10',
 inicio_vigencia:'2026-02-01',alteracoes_conferidas:true,excecoes_conferidas:true,
 texto_integral_conferido:true,aprovacao:'aprovada',revisor:'Revisor fictício para teste',revisado_em:'2026-11-16'};
 const r=api.analyzeAct(act);
 assert.equal(r.legallyDocumented,true);
 assert.equal(r.taxRuleApproved,false);
 assert.equal(r.canIssue,false);
});
test('ato retroativo sem justificativa permanece pendente de revisão',()=>{
 const act={uf:'BR',tema:'IBS_CBS',fonte_url:'https://www.gov.br/fazenda/ato-ficticio',
 ato_normativo:'Ato de teste',dispositivo:'Art. 1º',publicado_em:'2026-06-01',
 inicio_vigencia:'2026-01-01',alteracoes_conferidas:true,excecoes_conferidas:true,
 texto_integral_conferido:true,aprovacao:'aprovada',revisor:'Revisor de teste',revisado_em:'2026-11-16'};
 const r=api.analyzeAct(act);
 assert.equal(r.legallyDocumented,false);
 assert.ok(r.issues.some(x=>/anterior à publicação/.test(x)));
});
test('mudança de página ou NCM informado não equivale a homologação tributária',()=>{
 const data=api.coverage([{uf:'SP'},{uf:'MT'}],[{uf:'SP',fonte_url:'https://www.gov.br/'}]);
 assert.equal(data.federativeUnitsRegistered,2);
 assert.equal(data.byUF.SP.actsDocumentallyReviewed,0);
 assert.equal(data.byUF.SP.fiscalRulesHomologated,0);
 assert.equal(data.ruleApprovalRequiresScenario,true);
});
