import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFields,identifyFile,validToken} from '../supabase/functions/driver-cadastro/validation.mjs';
test('parcial e campos opcionais',()=>{assert.deepEqual(validateFields({nome:' Teste ',cpf:'',endereco:''}),{nome:'Teste'});assert.deepEqual(validateFields({}),{});});
test('não aceita campos sensíveis ou inválidos',()=>{for(const v of [{chavePix:'x'},{cpf:'123'},{cnh:'123'},{validade:'2026-02-31'},{nome:'x'.repeat(301)},{nome:'a\n'}])assert.throws(()=>validateFields(v));});
test('valida conteúdo do arquivo e formato do token',()=>{assert.equal(identifyFile(Uint8Array.from([255,216,255])).mime,'image/jpeg');assert.throws(()=>identifyFile(Uint8Array.from([60,104,116,109,108])));assert(validToken('a'.repeat(64)));assert(!validToken('a'.repeat(63)));});
