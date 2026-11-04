import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const norm=(v="")=>String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"",url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}),admin=createClient(url,service);
  const{data:{user}}=await userClient.auth.getUser();if(!user)throw new Error("NÃO AUTORIZADO");
  const{data:p}=await admin.from("fc_perfis").select("*").eq("user_id",user.id).maybeSingle();if(!p?.ativo)throw new Error("PERFIL INATIVO");
  const scope=await admin.rpc('access_module_context',{p_user:user.id,p_app:'venda-externa'});if(scope.error||!scope.data?.allowed)throw Error('APLICATIVO AGUARDANDO APROVAÇÃO');p.perfil=scope.data.role;
  const reqs=await admin.from("access_requests").select("app,status,managed_account").eq("user_id",user.id);if(reqs.error||reqs.data?.some((x:any)=>x.managed_account)&&!reqs.data?.some((x:any)=>x.app==="venda-externa"&&x.status==="APROVADO"))throw new Error("APLICATIVO AGUARDANDO APROVAÇÃO");if(p.status_aprovacao!=="APROVADO"||p.trocar_senha)throw new Error("ACESSO BLOQUEADO");const role=norm(p.perfil),priv=/MASTER|ADMINISTRADOR/.test(role);if(!priv&&!/VENDEDOR.*EXTERNO/.test(role)&&p.permissoes?.["venda-externa"]!==true)throw new Error("PERFIL SEM ACESSO À VENDA EXTERNA");
  const {data:row,error:stateError}=await admin.from("fc_app_state").select("*").eq("empresa_id",p.empresa_id).maybeSingle();
  if(stateError||!row)throw new Error("PAINEL DA EMPRESA NÃO LOCALIZADO. CONTATE O ADMINISTRADOR.");
  const s=row.estado||{},body=await req.json(),sellerId="auth-"+user.id;
  const mine=(x:any)=>priv||[sellerId,user.id,p.id,p.nome,user.email].some(v=>v&&[x.vendedorId,x.vendedorResponsavelId,x.vendedor,x.vendedorNome,x.criadoPor].some(y=>norm(y)===norm(v)));
  if(body.acao==="LISTAR"){
   const clientes=(s.clientes||[]).filter((x:any)=>x.ativo!==false&&mine(x));
   const produtos=(s.produtos||[]).filter((x:any)=>x.ativo!==false).map((x:any)=>{const pc=(s.precosClientes||[]).find((z:any)=>z.produtoId===x.id&&clientes.some((c:any)=>c.id===z.clienteId));return{id:x.id,nome:x.nome,preco:Number(pc?.precoFinal||x.precoTabela||0)}});
   const vendas=(s.vendasExternas||[]).filter(mine).slice().reverse();const comissoes=(s.comissoes||[]).filter(mine).slice().reverse();
   return new Response(JSON.stringify({clientes,produtos,vendas,comissoes}),{headers:cors});
  }
  if(body.acao==="CRIAR_PROPOSTA"){
   const cliente=(s.clientes||[]).find((x:any)=>x.id===body.clienteId&&x.ativo!==false&&mine(x));const produto=(s.produtos||[]).find((x:any)=>x.id===body.produtoId&&x.ativo!==false);const qtd=Number(body.qtd);if(!cliente||!produto||!Number.isSafeInteger(qtd)||qtd<=0)throw new Error("DADOS INVÁLIDOS");
   const pc=(s.precosClientes||[]).find((x:any)=>x.clienteId===cliente.id&&x.produtoId===produto.id),preco=Number(pc?.precoFinal||produto.precoTabela||0);if(!Number.isFinite(preco)||preco<=0||!Number.isFinite(qtd*preco))throw new Error("PREÇO NÃO CONFIGURADO");
   const item={id:"vx-"+crypto.randomUUID(),numeroVenda:"VX-"+Date.now(),clienteId:cliente.id,cliente:cliente.nome,produtoId:produto.id,produto:produto.nome,qtd,precoUnitario:preco,total:qtd*preco,condicao:body.condicao,observacao:body.observacao||"",vendedorId:sellerId,vendedorNome:p.nome||user.email,origemComercial:"VX",status:"AGUARDANDO APROVAÇÃO",destinoPainel:"AGUARDANDO ROTEAMENTO",criadoEm:new Date().toISOString()};
   const estado={...s,vendasExternas:[...(s.vendasExternas||[]),item],auditoria:[...(s.auditoria||[]),{id:"aud-"+crypto.randomUUID(),acao:"PROPOSTA EXTERNA CRIADA",detalhe:item.numeroVenda+" • "+cliente.nome,usuario:p.nome,dataHora:item.criadoEm}]};
   const nextVersion=Number(row.versao)+1;
   if(!Number.isSafeInteger(nextVersion)||nextVersion<1)throw Error("VERSÃO OPERACIONAL INVÁLIDA.");
   const saved=await admin.from("fc_app_state").update({estado,updated_by:user.id,versao:nextVersion})
    .eq("empresa_id",p.empresa_id).eq("versao",row.versao).select("empresa_id");
   if(saved.error)throw new Error("NÃO FOI POSSÍVEL GRAVAR A PROPOSTA.");
   if(saved.data?.length!==1)throw new Error("O PAINEL FOI ATUALIZADO POR OUTRO USUÁRIO. TENTE NOVAMENTE.");
   return new Response(JSON.stringify(item),{headers:cors});
  }
  throw new Error("AÇÃO INVÁLIDA");
 }catch(e){return new Response(JSON.stringify({error:String(e.message||e)}),{status:400,headers:cors})}
});
