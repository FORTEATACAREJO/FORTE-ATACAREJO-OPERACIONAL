import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analisarMotoristaOperacional,gravarMotorista,mensagemGravacao,resumoMotoristas} from '../apps/web/src/frete-motorista.mjs';

const completo={nome:'Motorista Operacional',cpf:'111.222.333-44',telefone:'(34) 99999-0000',cnhNumero:'12345678901',proprietario:'Transportadora',chavePix:'pix-operacional',favorecidoPix:'Transportadora',placa1:'abc1d23',capacidadeMaximaKg:'48500'};

test('grava motorista inativo no operacional e repetir não duplica',()=>{
 const primeira=gravarMotorista([],completo,{id:'mot-1',agora:'2026-11-09T12:00:00Z'});
 assert.equal(primeira.acao,'inserir');
 assert.equal(primeira.registro.ativo,false);
 assert.equal(primeira.registro.placa1,'ABC1D23');
 assert.equal(primeira.registro.capacidadeMaximaKg,48500);
 assert.equal(primeira.registro.tipoMotorista,'TRANSPORTE DE CARGA');
 const repetida=gravarMotorista(primeira.motoristas,completo,{id:'mot-1',agora:'2026-11-09T12:00:00Z'});
 assert.equal(repetida.acao,'preservar');
 assert.equal(repetida.escreve,false);
 assert.equal(repetida.motoristas.length,1);
 const liberada=gravarMotorista(primeira.motoristas,completo,{id:'mot-1',agora:'2026-11-09T13:00:00Z',liberar:true});
 assert.equal(liberada.registro.ativo,true);
 assert.equal(liberada.motoristas.length,1);
});
test('cadastro incompleto, segredo e versão mais nova não são gravados',()=>{
 const incompleto=gravarMotorista([],{...completo,cpf:'123'},{id:'mot-2'});
 assert.equal(incompleto.escreve,false);
 assert.equal(incompleto.registro,null);
 assert.equal(incompleto.motoristas.length,0);
 const segredo=analisarMotoristaOperacional({...completo,senha:'nao-copiar',documento:{tipo:'CNH',arquivo:'bytes'}});
 assert.equal(segredo.apto,false);
 assert.equal(JSON.stringify(segredo).includes('nao-copiar'),false);
 assert.equal(JSON.stringify(mensagemGravacao(incompleto)).includes('11122233344'),false);
 const base=gravarMotorista([],completo,{id:'mot-1',agora:'2026-11-09T12:00:00Z'}).motoristas;
 const conflito=gravarMotorista(base,{...completo,telefone:'34988887777'},{id:'mot-1',agora:'2026-11-08T12:00:00Z'});
 assert.equal(conflito.acao,'conflito');
 assert.equal(conflito.motoristas[0].telefone,'34999990000');
});
test('resumo e a interface não apontam o cadastro para o site antigo',()=>{
 const relatorio=JSON.stringify(resumoMotoristas([{id:'1',ativo:true,teste:false},{id:'2',ativo:false},{teste:true,nome:'oculto'}]));
 assert.equal(JSON.parse(relatorio).total,2);
 assert.doesNotMatch(relatorio,/oculto|pix-operacional/);
 const fontes=['apps/web/src/App.jsx','apps/web/src/DriverDirectory.jsx','apps/web/src/FreteMotoristaPainel.jsx'].map(arquivo=>readFileSync(new URL('../'+arquivo,import.meta.url),'utf8')).join('\n');
 assert.equal(fontes.includes('window.open("https://forte-frete.onrender.com"'),false);
 assert.equal(fontes.includes('CADASTRO LEGADO'),false);
 assert.equal(fontes.includes('exclusivo do Forte Frete'),false);
 assert.match(fontes,/GRAVAR NO OPERACIONAL/);
});
