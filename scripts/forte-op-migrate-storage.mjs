/**
 * FORTE-OP: migração segura dos seis anexos privados do antigo Frete.
 * Execução: credenciais de servidor por variáveis de ambiente, nunca no GitHub nem no navegador.
 * NÃO concede acesso a motoristas nem altera registros antigos.
 */
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';

const SOURCE_BUCKET='motorista-documentos';
const TARGET_BUCKET='forte-op-frete-documentos';
const required=['FRETE_LEGACY_SUPABASE_URL','FRETE_LEGACY_SERVICE_ROLE_KEY','FORTE_OP_SUPABASE_URL','FORTE_OP_SERVICE_ROLE_KEY'];
const missing=required.filter(key=>!process.env[key]);
if(missing.length)throw new Error('Variáveis de ambiente ausentes: '+missing.join(', '));
const execute=process.argv.includes('--execute')&&process.env.FORTE_OP_MIGRATION_ALLOWED==='1';
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const source=createClient(process.env.FRETE_LEGACY_SUPABASE_URL,process.env.FRETE_LEGACY_SERVICE_ROLE_KEY,opts);
const target=createClient(process.env.FORTE_OP_SUPABASE_URL,process.env.FORTE_OP_SERVICE_ROLE_KEY,opts);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const assertOk=(result,operation)=>{if(result.error)throw new Error(operation+': '+result.error.message);return result.data;};
const archive=assertOk(await target.from('forte_op_frete_legado')
  .select('dados')
  .eq('tabela_origem','storage_objects')
  .limit(100),'Ler metadados de destino');
const files=archive.map(row=>row.dados).filter(row=>row&&typeof row.name==='string');
if(files.length!==6)throw new Error('Inventário não corresponde aos seis arquivos esperados; conferência obrigatória.');
if(new Set(files.map(f=>f.name)).size!==files.length)throw new Error('Nomes duplicados no inventário.');
console.log('FORTE-OP: encontrados',files.length,'arquivos privados; modo',execute?'cópia':'somente conferência');
let copied=0,verified=0,failures=0;
for(let index=0;index<files.length;index++){
 try{
  const file=files[index],name=file.name;
  if(!name||name.startsWith('/')||name.includes('..')||name.includes('\\'))throw Error('Caminho inseguro.');
  const downloaded=assertOk(await source.storage.from(SOURCE_BUCKET).download(name),'Ler arquivo de origem');
  const bytes=Buffer.from(await downloaded.arrayBuffer());
  const expectedBytes=Number(file.metadata?.size);
  if(!Number.isSafeInteger(expectedBytes)||bytes.length!==expectedBytes)throw Error('Tamanho da origem não confere com o inventário.');
  const sha=digest(bytes);
  const existing=assertOk(await target.from('forte_op_frete_storage_integridade')
    .select('sha256_hex,file_size').eq('object_path',name).maybeSingle(),'Conferir integridade');
  if(existing){
    if(existing.sha256_hex!==sha||Number(existing.file_size)!==bytes.length)throw Error('Divergência de integridade em arquivo já migrado.');
  }else if(execute){
    let upload=await target.storage.from(TARGET_BUCKET).upload(name,bytes,{
      upsert:false,contentType:file.metadata?.mimetype||downloaded.type||'application/octet-stream'
    });
    if(upload.error){
      if(!/already exists|duplicate/i.test(upload.error.message||''))throw upload.error;
      const prior=assertOk(await target.storage.from(TARGET_BUCKET).download(name),'Conferir arquivo já existente');
      if(digest(Buffer.from(await prior.arrayBuffer()))!==sha)throw Error('Arquivo de destino diferente; sem sobrescrever.');
    }else copied++;
  }
  if(execute){
    const finalFile=assertOk(await target.storage.from(TARGET_BUCKET).download(name),'Verificar arquivo no destino');
    const finalBytes=Buffer.from(await finalFile.arrayBuffer());
    if(finalBytes.length!==bytes.length||digest(finalBytes)!==sha)throw Error('SHA256 de destino diferente.');
    assertOk(await target.from('forte_op_frete_storage_integridade').upsert({
      bucket:TARGET_BUCKET,object_path:name,file_size:bytes.length,sha256_hex:sha
    },{onConflict:'object_path'}),'Salvar comprovante de integridade');
    verified++;
  }
  console.log('Arquivo',index+1,'de',files.length,':',execute?'integridade conferida':'origem conferida');
 }catch(error){
  failures++;
  // Não imprimir caminho, CPF, chave Pix nem conteúdo dos documentos no terminal.
  console.error('Arquivo',index+1,'de',files.length,': falha de validação.');
 }
}
console.log(JSON.stringify({total:files.length,copied,verified,failures,completed:execute&&verified===files.length&&failures===0}));
if(failures||execute&&verified!==files.length)process.exitCode=1;
