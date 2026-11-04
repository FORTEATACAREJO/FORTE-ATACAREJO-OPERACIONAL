import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build,preview} from 'vite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../apps/web/',import.meta.url));
const qa=fileURLToPath(new URL('./',import.meta.url));
const tmpOutput=await mkdtemp(join(tmpdir(),'forte-unificacao-'));
const define={
  'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://fixture-unificacao.supabase.co'),
  'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('publishable-fixture'),
};
await build({root,define,build:{outDir:tmpOutput}});
const server=await preview({root,build:{outDir:tmpOutput},preview:{host:'127.0.0.1',port:0}});
try {
  const origin='http://127.0.0.1:'+server.httpServer.address().port;
  const child=spawn(process.execPath,[
    fileURLToPath(new URL('./node_modules/@playwright/test/cli.js',import.meta.url)),
    'test','tests/unificacao-fixture.spec.mjs',...process.argv.slice(2),
  ],{cwd:qa,env:{...process.env,FORTE_QA_UNIFICADA_URL:origin},stdio:'inherit'});
  process.exitCode=await new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('exit',code=>resolve(code??1));
  });
} finally {
  server.httpServer.closeAllConnections();
  await new Promise(resolve=>server.httpServer.close(resolve));
  await rm(tmpOutput,{recursive:true,force:true});
}
