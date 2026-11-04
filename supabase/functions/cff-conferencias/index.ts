import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {budgetForReview, reviewedItems, reviewVersion} from "./domain.mjs";

const origins = new Set(["https://forte-vendas.onrender.com", "https://forte-vendas-app.onrender.com"]);
const historyColumns = "id,orcamento_id,versao,conferencia,created_at";

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": origins.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  const reply = (body: unknown, status = 200) => Response.json(body, {status,headers});
  if (!origins.has(origin)) return reply({error:"Origem não permitida."},403);
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
  if (request.method !== "POST") return reply({error:"Método não permitido."},405);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return reply({error:"Entre para conferir orçamentos."},401);
    const {data:{user},error:authError} = await db.auth.getUser(token);
    if (authError || !user) return reply({error:"Sessão inválida."},401);
    const [access, profile] = await Promise.all([
      db.rpc("access_module_context",{p_user:user.id,p_app:"vendas"}),
      db.from("fc_perfis").select("empresa_id").eq("user_id",user.id).maybeSingle(),
    ]);
    if (access.error || profile.error) return reply({error:"Não foi possível conferir o acesso."},503);
    if (!access.data?.allowed || !["MASTER","ADMINISTRADOR"].includes(access.data.role) || !profile.data?.empresa_id) {
      return reply({error:"CFF disponível à administração autorizada no FORTE VENDAS."},403);
    }
    const company = profile.data.empresa_id;
    const body = await request.json();
    if (!["LISTAR","CONFERIR"].includes(body?.acao)) return reply({error:"Ação inválida."},400);
    const state = await db.from("fc_app_state").select("estado,updated_at").eq("empresa_id",company).maybeSingle();
    if (state.error || !state.data) return reply({error:"Painel da empresa indisponível."},503);
    const rows = state.data.estado?.vendasBalcao || [];

    if (body.acao === "LISTAR") {
      const budgets = rows.map(budgetForReview).filter(Boolean).reverse().slice(0,100);
      const history = await db.from("fc_cff_conferencias").select(historyColumns).eq("empresa_id",company)
        .order("created_at",{ascending:false}).limit(100);
      if (history.error) return reply({error:"Histórico de conferências indisponível."},503);
      return reply({
        orcamentos:await Promise.all(budgets.map(async budget=>({...budget,versao:await reviewVersion(budget)}))),
        historico:history.data,
      });
    }

    const budget = budgetForReview(rows.find(row=>row.id===body.orcamentoId));
    if (!budget) return reply({error:"Orçamento indisponível para conferência."},409);
    const version = await reviewVersion(budget);
    if (version !== body.versao) return reply({error:"O saldo mudou. Atualize e confira novamente."},409);
    let reviewed;
    try { reviewed = reviewedItems(budget,body.quantidades,body.justificativa); }
    catch (error) { return reply({error:error instanceof Error ? error.message : "Conferência inválida."},400); }
    const conference = {...budget,...reviewed};
    const result = await db.rpc("fc_cff_registrar",{
      p_empresa:company,p_estado_versao:state.data.updated_at,p_orcamento:budget.id,
      p_versao:version,p_conferencia:conference,p_autor:user.id,
    });
    if (result.error?.code === "23505") return reply({error:"Este saldo já foi conferido. Consulte o histórico."},409);
    if (result.error) return reply({error:"Não foi possível registrar a conferência."},503);
    if (!result.data) return reply({error:"O painel foi atualizado. Confira novamente antes de salvar."},409);
    return reply(result.data,201);
  } catch {
    return reply({error:"Não foi possível concluir a operação."},400);
  }
});
