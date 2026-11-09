import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
test('PWA principal tem a nova identidade e preserva URL de instalação',()=>{
 const m=JSON.parse(read('apps/web/public/manifest.webmanifest'));
 assert.equal(m.name,'FORTE ATACAREJO OPERACIONAL');
 assert.equal(m.id,'/');
 assert.equal(m.start_url,'/');
});
test('Title e metatags do aplicativo operacional usam a nova marca',()=>{
 const html=read('apps/web/index.html');
 assert.match(html,/<title>FORTE ATACAREJO OPERACIONAL/);
 assert.match(html,/content="FORTE ATACAREJO OPERACIONAL"/);
});
test('Atalho de financeiro legado preserva redirecionamento funcional',()=>{
 const html=read('apps/web/financeiro.html');
 assert.match(html,/url=\/\?app=financeiro/);
});
test('site incorporado não aponta para o serviço institucional removido',()=>{
 const html=read('apps/web/public/site/index.html');
 assert.doesNotMatch(html,/site-forte-atacarejo\.onrender\.com/);
 assert.match(html,/href="\/"/);
});
test('Fiscal permanece fora do manifesto e da PWA operacional',()=>{
 const m=JSON.parse(read('apps/web/public/manifest.webmanifest'));
 assert.doesNotMatch(m.description,/emiss[aã]o fiscal/i);
});
