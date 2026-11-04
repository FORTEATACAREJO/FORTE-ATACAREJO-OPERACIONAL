import assert from 'node:assert/strict';
import test from 'node:test';
import {compareFreightStorage,copyFreightStorage} from '../tools/frete/conferir-storage.mjs';

function fixture(tree,{isPublic=false}={}) {
  return {storage:{
    getBucket:async()=>({data:{public:isPublic}}),
    from(bucket){
      const files=tree[bucket]??={};
      return {
        async list(directory,{offset,limit}){
          const prefix=directory?directory+'/':'';
          const entries=new Map();
          for(const path of Object.keys(files)){
            if(!path.startsWith(prefix))continue;
            const [name,...children]=path.slice(prefix.length).split('/');
            entries.set(name,{name,id:children.length?null:path});
          }
          return {data:[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(offset,offset+limit)};
        },
        async download(path){return {data:new Blob([files[path]])};},
        async upload(path,blob,{upsert}){
          assert.equal(upsert,false);
          if(Object.hasOwn(files,path))return {error:{message:'exists'}};
          files[path]=await blob.text();
          return {data:{path}};
        },
      };
    },
  }};
}

test('restoration compares SHA-256 across nested folders and lists only aggregate discrepancies',async()=>{
  const bucket='motorista-documentos';
  const originals=Object.fromEntries(Array.from({length:101},(_,i)=>['fixture/'+i,'same '+i]));
  const before=fixture({[bucket]:{...originals,'removed/file':'old'}});
  const after=fixture({[bucket]:{...originals,'fixture/100':'corrupt','extra/file':'new'}});
  const result=await compareFreightStorage(before,after);
  assert.deepEqual(result.find(item=>item.bucket===bucket),{
    bucket,origem:102,restaurado:102,ausentes:1,excedentes:1,divergentes:1,
  });
  assert(!JSON.stringify(result).includes('fixture/100'));
  assert((await compareFreightStorage(before,before)).every(item=>!item.ausentes&&!item.excedentes&&!item.divergentes));
});

test('a publicly exposed restored bucket fails the verification',async()=>{
  await assert.rejects(compareFreightStorage(fixture({}),fixture({},{isPublic:true})),/Bucket ausente ou público/);
});


test('copy fills missing objects, leaves matching objects intact and can be retried',async()=>{
  const bucket='motorista-documentos';
  const source=fixture({[bucket]:{'driver/a.pdf':'A','driver/b.pdf':'B'}});
  const stored={[bucket]:{'driver/a.pdf':'A'}};
  const target=fixture(stored);
  for(let attempt=0;attempt<2;attempt++){
    const result=await copyFreightStorage(source,target);
    assert(result.every(row=>!row.ausentes&&!row.excedentes&&!row.divergentes));
    assert.deepEqual(stored[bucket],{'driver/a.pdf':'A','driver/b.pdf':'B'});
  }
});

test('a divergent destination prevents copying even to other buckets',async()=>{
  const source=fixture({'forte-frete-cadastros':{'new.pdf':'source'},'motorista-documentos':{'old.pdf':'expected'}});
  const stored={'motorista-documentos':{'old.pdf':'different'}};
  await assert.rejects(copyFreightStorage(source,fixture(stored)),/divergentes/);
  assert.deepEqual(stored['forte-frete-cadastros'],{});
  assert.equal(stored['motorista-documentos']['old.pdf'],'different');
});
