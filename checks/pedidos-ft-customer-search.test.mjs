import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerDisplayName,customerSearchText,customerMatches} from '../apps/web/src/customer-search.mjs';

test('nome fantasia vem primeiro sem substituir a identidade fiscal do cliente',()=>{
 const c={id:'c1',nome:'ENGENHARIA ALFA LTDA',razaoSocial:'ENGENHARIA ALFA LTDA',nomeFantasia:'Casa da Obra',documento:'12.345.678/0001-90'};
 assert.equal(customerDisplayName(c),'Casa da Obra • ENGENHARIA ALFA LTDA');
 for(const q of ['casa','CASA DA OBRA','obra','engenharia','ALFA','12345678000190','12.345.678']) assert(customerMatches(c,q),q);
 assert(!customerMatches(c,'cliente diferente'));
 assert.match(customerSearchText(c),/Casa da Obra/);
});
test('cliente sem nome fantasia continua pesquisável e a grafia legada é suportada',()=>{
 const c={nome:'Cliente sem fantasia',documento:'123.456.789-00'};
 assert.equal(customerDisplayName(c),'Cliente sem fantasia');
 assert(customerMatches(c,'12345678900'));
 assert(customerMatches({...c,fantasia:'Construtora São José'},'sao jose'));
 assert.equal(customerDisplayName({...c, nomeFantasia:'CLIENTE SEM FANTASIA'}),'CLIENTE SEM FANTASIA');
 assert.equal(customerDisplayName({}),'Cliente sem nome');
});
