import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';

const buckets = ['forte-frete-cadastros','motorista-documentos','vendas-ordens-frete'];
const pageSize = 100;

async function inventory(client, name) {
  const bucket = await client.storage.getBucket(name);
  if (bucket.error || bucket.data?.public !== false) throw Error('Bucket ausente ou público: '+name);
  const storage = client.storage.from(name);
  const files = new Map();
  const pending = [''];
  for (const directory of pending) {
    for (let offset=0;;offset+=pageSize) {
      const page = await storage.list(directory,{limit:pageSize,offset,sortBy:{column:'name',order:'asc'}});
      if (page.error || !Array.isArray(page.data)) throw Error('Falha ao inventariar: '+name);
      for (const entry of page.data) {
        const path = directory ? directory+'/'+entry.name : entry.name;
        if (entry.id == null) {
          pending.push(path);
          continue;
        }
        if (files.has(path)) throw Error('Inventário mudou durante a consulta: '+name);
        const file = await storage.download(path);
        if (file.error || !file.data) throw Error('Falha ao verificar os bytes em: '+name);
        const hash = createHash('sha256');
        for await (const chunk of Readable.fromWeb(file.data.stream())) hash.update(chunk);
        files.set(path,hash.digest('hex'));
      }
      if (page.data.length<pageSize) break;
    }
  }
  return files;
}

export async function compareFreightStorage(source,restored) {
  const results = [];
  for (const name of buckets) {
    const [before,after] = await Promise.all([inventory(source,name),inventory(restored,name)]);
    results.push({
      bucket:name,
      origem:before.size,
      restaurado:after.size,
      ausentes:[...before.keys()].filter(path=>!after.has(path)).length,
      excedentes:[...after.keys()].filter(path=>!before.has(path)).length,
      divergentes:[...before].filter(([path,hash])=>after.has(path)&&after.get(path)!==hash).length,
    });
  }
  return results;
}

async function main() {
  const configs = ['ORIGEM','RESTAURADO'].map(label=>({
    url:new URL(process.env['FORTE_FRETE_'+label+'_URL']||'about:blank'),
    key:process.env['FORTE_FRETE_'+label+'_SERVICE_KEY'],
  }));
  if (configs.some(({url,key})=>url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password||url.search||url.hash||!key) ||
      configs[0].url.origin===configs[1].url.origin) {
    throw Error('Configure URLs HTTPS de dois projetos distintos e as respectivas chaves de serviço.');
  }
  const clients = configs.map(({url,key})=>createClient(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false}}));
  const results = await compareFreightStorage(...clients);
  console.log(JSON.stringify(results,null,2));
  if (results.some(item=>item.ausentes||item.excedentes||item.divergentes)) process.exitCode=1;
}

if (process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
