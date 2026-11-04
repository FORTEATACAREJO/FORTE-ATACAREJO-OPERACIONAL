import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {catalogProduct, publicationInput, publicCatalog, resaleProducts} from "./domain.mjs";

const origins = new Set(["https://forte-vendas.onrender.com","https://forte-vendas-app.onrender.com"]);
const columns = "produto_id,publicado,descricao,foto,versao";

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": origins.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  const reply = (body: unknown,status = 200) => Response.json(body,{status,headers});
  if (origin && !origins.has(origin)) return reply({error:"Origem não permitida."},403);
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
  if (!["GET","POST"].includes(request.method)) return reply({error:"Método não permitido."},405);
  if (request.method === "POST" && !origins.has(origin)) return reply({error:"Origem não permitida."},403);

  try {
    const company = Deno.env.get("SITE_CATALOGO_EMPRESA_ID");
    if (!company) return reply({error:"Catálogo ainda indisponível."},503);
    const db = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    let userId: string | undefined;
    let body;
    if (request.method === "POST") {
      const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
      if (!token) return reply({error:"Entre para administrar o catálogo."},401);
      const {data,error} = await db.auth.getUser(token);
      if (error || !data.user) return reply({error:"Sessão inválida."},401);
      userId = data.user.id;
      const [access,profile] = await Promise.all([
        db.rpc("access_module_context",{p_user:userId,p_app:"site"}),
        db.from("fc_perfis").select("empresa_id").eq("user_id",userId).maybeSingle(),
      ]);
      if (access.error || profile.error) return reply({error:"Não foi possível conferir o acesso."},503);
      if (profile.data?.empresa_id !== company || !access.data?.allowed ||
          !["MASTER","ADMINISTRADOR"].includes(access.data.role)) {
        return reply({error:"Publicação restrita à administração aprovada no site."},403);
      }
      body = await request.json();
      if (!["LISTAR","SALVAR"].includes(body?.acao)) return reply({error:"Ação inválida."},400);
    }

    const state = await db.from("fc_app_state").select("produtos:estado->produtos").eq("empresa_id",company).maybeSingle();
    if (state.error || !state.data) return reply({error:"Catálogo ainda indisponível."},503);
    const products = state.data.produtos || [];
    if (body?.acao === "SALVAR") {
      let entry;
      try { entry = publicationInput(body); }
      catch (error) { return reply({error:error instanceof Error ? error.message : "Publicação inválida."},400); }
      const productId = body.produtoId;
      if (typeof productId !== "string" || !productId || productId.length > 200) {
        return reply({error:"Produto inválido."},400);
      }
      if (entry.publicado && !resaleProducts(products).some(item => item.id === productId)) {
        return reply({error:"Somente produtos ativos de revenda podem ser publicados."},409);
      }
      const fields = {...entry,versao:crypto.randomUUID(),updated_by:userId,updated_at:new Date().toISOString()};
      const saved = body.versao
        ? await db.from("fc_site_catalogo").update(fields).eq("empresa_id",company).eq("produto_id",productId)
          .eq("versao",body.versao).select(columns).maybeSingle()
        : await db.from("fc_site_catalogo").insert({...fields,empresa_id:company,produto_id:productId}).select(columns).single();
      if (saved.error?.code === "23505" || (!saved.error && !saved.data)) {
        return reply({error:"Outra pessoa alterou este produto. Atualize antes de salvar."},409);
      }
      if (saved.error) return reply({error:"Não foi possível salvar a publicação."},503);
      return reply({publicacao:saved.data});
    }
    const query = db.from("fc_site_catalogo").select(columns).eq("empresa_id",company);
    const listings = await (body ? query : query.eq("publicado",true));
    if (listings.error) return reply({error:"Catálogo ainda indisponível."},503);
    if (!body) return reply({produtos:publicCatalog(products,listings.data)});
    return reply({
      produtos:resaleProducts(products).map(item => ({id:item.id,...catalogProduct(item)})),
      publicacoes:listings.data,
    });
  } catch {
    return reply({error:"Não foi possível concluir a consulta."},503);
  }
});
