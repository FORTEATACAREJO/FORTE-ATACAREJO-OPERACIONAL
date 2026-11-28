import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../supabase/functions/order-communications/index.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../apps/web/src/PedidosFT.jsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261127210129_ft_internal_recipients_history.sql',import.meta.url),'utf8');
test('configuração interna usa MASTER, empresa autenticada e histórico de revisões',()=>{
 const config=server.slice(server.indexOf("if(['INTERNAL_RECIPIENTS_GET'"),server.indexOf("if(body.action==='INTERNAL_DOSSIER_SEND')"));
 assert.match(config,/p\.perfil!=='MASTER'/);assert.match(config,/eq\('empresa_id',p\.empresa_id\)/);assert.match(config,/changed_by:user\.id/);assert.match(config,/body\.revision!==/);
 assert.match(migration,/enable row level security/);assert.match(migration,/revoke all .* from public,anon,authenticated,service_role/);assert.match(migration,/grant select,insert .* to service_role/);
});
test('envio interno busca o destinatário vigente no servidor',()=>{
 const send=server.slice(server.indexOf("if(body.action==='INTERNAL_DOSSIER_SEND')"),server.indexOf("if(body.action!==\'DISPATCH\')",server.indexOf("if(body.action===\'INTERNAL_DOSSIER_SEND\')")));
 assert.match(send,/config=await readRecipients\(\)/);assert.match(send,/role==='PEDRO'\?config\.fechamento_whatsapp:config\.faturamento_whatsapp/);assert.doesNotMatch(send,/body\.(to|telefone|whatsapp)/);
 assert.match(ui,/Salvar destinatários/);assert.match(ui,/INTERNAL_RECIPIENTS_SAVE/);
});
