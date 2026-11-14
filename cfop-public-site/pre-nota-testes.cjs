/* node cfop-public-site/pre-nota-testes.cjs — sem dependências externas.
 * Testes informativos: valida hipóteses, bloqueios e totais; NÃO homologam legislação.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const root=__dirname;
const context={window:{},globalThis:{}};
vm.createContext(context);
for(const file of ["classificacao.js","pre-nota-engine.js"]){
 vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
}
const fiscal=context.window.FORTE_PRE_NOTA,api=context.window.FORTE_CLASSIFICACAO;
const base={
 mode:"saida",nature:"venda",date:"2026-11-14",
 sender:{kind:"company",document:"49832961000151",name:"Empresa remetente",uf:"MG",ie:""},
 recipient:{kind:"company",document:"12345678000195",name:"Empresa destinataria",uf:"GO",ie:""},
 buyerContributor:"yes",sellerSource:"third_party",stEvidence:"no_st",
 items:[{description:"Cimento CP II E-32 50 kg",ncm:"25232990",cest:"0500100",purpose:"revenda",quantity:40,unitPrice:33}]
};
let count=0;
function test(name,input,want){
 const result=fiscal.analyze(input,api);
 const value=result.items[0].fields.cfop.value;
 assert.equal(value,want,name);
 assert.equal(result.amount,1320,name+" valor da mercadoria");
 count++;
 process.stdout.write("OK "+name+" -> "+value+"\n");
}
test("Venda interestadual comum",base,"6.102");
test("Venda a não contribuinte",{...base,recipient:{kind:"person",document:"12345678909",name:"Comprador",uf:"GO"},buyerContributor:"no"},"6.108");
test("Compra revenda ST",{...base,mode:"entrada",nature:"compra",stEvidence:"prior_st"},"2.403");
test("Compra de ativo",{...base,mode:"entrada",nature:"compra",items:[{...base.items[0],purpose:"ativo"}]},"2.551");
test("Compra uso/consumo sujeita ST",{...base,mode:"entrada",nature:"compra",stEvidence:"prior_st",items:[{...base.items[0],purpose:"consumo"}]},"2.407");
test("Compra uso/consumo sem ST",{...base,mode:"entrada",nature:"compra",items:[{...base.items[0],purpose:"consumo"}]},"2.556");
test("Remessa especial",{...base,nature:"remessa"},"Não determinado");
test("Sem prova ST",{...base,stEvidence:"unknown"},"Não determinado");
test("UF SP incluída na cobertura nacional",{...base,recipient:{...base.recipient,uf:"SP"}},"6.102");
test("UF inválida permanece bloqueada",{...base,recipient:{...base.recipient,uf:"ZZ"}},"Não determinado");
test("CPF sem IE na saída",{...base,sender:{kind:"person",document:"12345678909",name:"Pessoa",uf:"MG"}},"Não determinado");
test("Documento do destinatário vazio",{...base,recipient:{...base.recipient,document:""}},"Não determinado");
test("Mesmo estabelecimento",{...base,recipient:{...base.recipient,document:base.sender.document}},"Não determinado");
test("Uso em obra não generalizado",{...base,mode:"entrada",nature:"compra",items:[{...base.items[0],purpose:"obra"}]},"Não determinado");
// 729 combinações nacionais: o CFOP-base segue a tabela nacional, sem validar impostos estaduais.
const ufs="AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
for(const from of ufs)for(const to of ufs){
  const result=fiscal.analyze({...base,sender:{...base.sender,uf:from},recipient:{...base.recipient,uf:to}},api);
  assert.equal(result.items[0].fields.cfop.value,from===to?"5.102":"6.102");
  assert.equal(result.items[0].fields.legislacaoUF.status,"pendente");
  count++;
}
process.stdout.write("OK 729 rotas nacionais — CFOP indicativo, legislação estadual pendente\n");
const multi=fiscal.analyze({...base,items:[base.items[0],{...base.items[0],quantity:2,unitPrice:11}]},api);
assert.equal(multi.amount,1342);
count++;
process.stdout.write("OK multi-item total R$ "+multi.amount+"\n");
process.stdout.write("Concluídos: "+count+" testes. Hipóteses NÃO substituem homologação legal.\n");