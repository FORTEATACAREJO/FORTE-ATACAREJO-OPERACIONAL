import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFields,identifyFile,validToken,validateScope,scopeAllows,suggestedFields} from '../supabase/functions/driver-cadastro/validation.mjs';
test('parcial e campos opcionais',()=>{assert.deepEqual(validateFields({nome:' Teste ',cpf:'',endereco:''}),{nome:'Teste'});assert.deepEqual(validateFields({}),{});});
test('não aceita campos sensíveis ou inválidos',()=>{for(const v of [{chavePix:'x'},{cpf:'123'},{cnh:'123'},{validade:'2026-02-31'},{nome:'x'.repeat(301)},{nome:'a\n'}])assert.throws(()=>validateFields(v));});
test('valida conteúdo do arquivo e formato do token',()=>{assert.equal(identifyFile(Uint8Array.from([255,216,255])).mime,'image/jpeg');assert.throws(()=>identifyFile(Uint8Array.from([60,104,116,109,108])));assert(validToken('a'.repeat(64)));assert(!validToken('a'.repeat(63)));});

test('pendências: somente chaves autorizadas, sem valores pessoais',()=>{const s=validateScope({fields:['cnh','cnh'],documents:['cnhDigital']});assert.deepEqual(s,{fields:['cnh'],documents:['cnhDigital']});assert(scopeAllows(s,'fields','cnh'));assert(!scopeAllows(s,'fields','cpf'));assert(!scopeAllows(s,'documents','cavalo'));assert(scopeAllows(null,'fields','cpf'));assert.throws(()=>validateScope({fields:['pix'],documents:[]}));assert.throws(()=>validateScope({fields:[],documents:[]}));assert(!suggestedFields({cpf:'52998224725'}).includes('cpf'));});

test('validade da CNH não é sugerida automaticamente, mas permanece solicitável',()=>{assert.deepEqual(suggestedFields({nome:'Teste',cpf:'52998224725',whatsapp:'11999999999',cnh:'01234567890',categoria_cnh:'AE'}),[]);assert.deepEqual(validateScope({fields:['validade'],documents:[]}),{fields:['validade'],documents:[]});assert.deepEqual(validateFields({validade:'2032-01-01'}),{validade:'2032-01-01'});});
