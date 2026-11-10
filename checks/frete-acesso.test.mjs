import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motoristaSelecionavelParaCarga,sanitizarPainelMotorista} from '../apps/web/src/frete-acesso.mjs';

test('cadastro em conferência não entra na seleção da carga',()=>{
 assert.equal(motoristaSelecionavelParaCarga({id:'1',ativo:false,statusCadastro:'PRONTO PARA CONFERÊNCIA'}),false);
 assert.equal(motoristaSelecionavelParaCarga({id:'2',ativo:true,statusCadastro:'AGUARDANDO APROVAÇÃO'}),false);
 assert.equal(motoristaSelecionavelParaCarga({id:'3',ativo:true,statusCadastro:'LIBERADO PARA CARGAS'}),true);
 assert.equal(motoristaSelecionavelParaCarga({id:'4',nome:'Legado',placa1:'ABC1D23'}),true);
 assert.equal(motoristaSelecionavelParaCarga({id:'5',teste:true,ativo:true}),false);
});

test('painel do motorista descarta pix, preço e arquivo',()=>{
 const painel=sanitizarPainelMotorista({
  motivo:'',
  motorista:{id:'mot',nome:'Motorista da sessao',placa:'ABC1D23',situacao:'LIBERADO PARA CARGAS',cpf:'52998224725',chavePix:'chave-nao-mostrar'},
  cargas:[{id:'c1',codigo:'CG-PROPRIA',fase:'A CAMINHO',pesoKg:40000,produto:'Cimento',chavePix:'chave-nao-mostrar',freteValor:9999,documentos:[{categoria:'COMPROVANTE ENTREGA',situacao:'RECEBIDO',storagePath:'secreto/arquivo.pdf'}]}],
  contasPagar:[{titulo:'TITULO-SIGILOSO'}]
 });
 const texto=JSON.stringify(painel);
 assert.equal(painel.cargas.length,1);
 assert.equal(painel.cargas[0].codigo,'CG-PROPRIA');
 assert.equal(painel.cargas[0].documentos[0].categoria,'COMPROVANTE ENTREGA');
 assert.equal(texto.includes('chave-nao-mostrar'),false);
 assert.equal(texto.includes('TITULO-SIGILOSO'),false);
 assert.equal(texto.includes('secreto/arquivo.pdf'),false);
 assert.equal(texto.includes('52998224725'),false);
 assert.equal(texto.includes('9999'),false);
});
