import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';

const buckets = ['forte-frete-cadastros','motorista-documentos','vendas-ordens-frete'];
const pageSize = 100;

async function checksum(blob) {
  const hash = createHash('sha256');
  for await (const chunk of Readable.fromWeb(blob.stream())) hash.update(chunk);
  return hash.digest('hex');
}

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
        files.set(path,await checksum(file.data));
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

export async function copyFreightStorage(source,restored) {
  const snapshots = [];
  for (const name of buckets) {
    const [before,after] = await Promise.all([inventory(source,name),inventory(restored,name)]);
    if ([...after].some(([path,hash])=>before.get(path)!==hash)) {
      throw Error('Destino contém objetos excedentes ou divergentes em: '+name);
    }
    snapshots.push({name,before,after});
  }

  for (const {name,before,after} of snapshots) {
    const origin = source.storage.from(name);
    const target = restored.storage.from(name);
    for (const [path,hash] of before) {
      if (after.has(path)) continue;
      const file = await origin.download(path);
      if (file.error || !file.data || await checksum(file.data)!==hash) {
        throw Error('Origem mudou durante a cópia em: '+name);
      }
      const saved = await target.upload(path,file.data,{upsert:false,contentType:file.data.type||undefined});
      if (saved.error) throw Error('Falha ao copiar um objeto em: '+name);
    }
  }
  return compareFreightStorage(source,restored);
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
  const args = process.argv.slice(2);
  const copying = args.length===1 && args[0]==='--copiar';
  if (args.length && !copying) throw Error('Argumento inválido. Use --copiar para escrever em homologação.');
  if (copying && (configs[0].url.origin!=='https://nkynfboqwfxhhxcsrawl.supabase.co' ||
      configs[1].url.origin!=='https://qlgjerxbvupipjsvecwk.supabase.co')) {
    throw Error('Cópia autorizada somente do FORTE FRETE para a branch isolada de homologação.');
  }
  const clients = configs.map(({url,key})=>createClient(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false}}));
  const results = await (copying?copyFreightStorage:compareFreightStorage)(...clients);
  console.log(JSON.stringify(results,null,2));
  if (results.some(item=>item.ausentes||item.excedentes||item.divergentes)) process.exitCode=1;
}

if (process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
