import {test,expect} from '@playwright/test';

const origin=process.env.FORTE_QA_UNIFICADA_URL;
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,aud:'authenticated',role:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}.Zml4dHVyZQ`;

test.skip(!origin,'Requer build de homologação com endpoint simulado.');
test('catálogo público, publicação autorizada e sessão comum entre áreas',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 let published=false;
 const product={id:'cimento-1',nome:'Cimento de teste',marca:'CSN',pesoKg:50};
 const calls=[];
 await page.route('https://fixture-unificacao.supabase.co/**',async route=>{
  const url=new URL(route.request().url());
  const body=route.request().postDataJSON()||{};
  const method=route.request().method();
  const reply=(json,status=200)=>route.fulfill({status,json,headers:{
   'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS',
  }});
  if(method==='OPTIONS')return reply({});
  if(url.pathname.endsWith('/auth/v1/user'))return reply(user);
  if(url.pathname.endsWith('/access-standard')){
   calls.push([body.app,body.action]);
   if(body.action==='LOGIN')return reply({access_token:token,refresh_token:'fixture-refresh'});
   if(body.action==='LEGAL_STATUS')return reply({accepted:true});
   return reply({allowed:true,status:'APROVADO',role:'MASTER',name:'Master de teste',isAdmin:false});
  }
  if(url.pathname.endsWith('/forte-notifications'))return reply({allowed:true,count:0,items:[]});
  if(url.pathname.endsWith('/access_current_module'))return reply({allowed:true,role:'MASTER'});
  if(url.pathname.endsWith('/site-catalogo')){
   if(method==='GET')return reply({produtos:published?[{nome:product.nome,marca:product.marca,pesoKg:50,descricao:'Descrição revisada',foto:null}]:[]});
   if(body.acao==='LISTAR')return reply({produtos:[product],publicacoes:[]});
   if(body.acao==='SALVAR'){
    expect(body).toMatchObject({produtoId:product.id,publicado:true,descricao:'Descrição revisada'});
    published=true;
    return reply({publicacao:{produto_id:product.id,publicado:true,descricao:body.descricao,versao:'fixture-version'}});
   }
  }
  if(url.pathname.endsWith('/mobile-vendas-externas'))return reply({clientes:[],produtos:[],vendas:[],comissoes:[]});
  if(url.pathname.endsWith('/cff-conferencias'))return reply({orcamentos:[],historico:[]});
  return reply({error:'Chamada sem fixture'},400);
 });
 await page.goto(origin+'/site.html');
 await expect(page.getByRole('status')).toContainText('Consulte os produtos');
 await page.goto(origin+'/admin.html');
 const gate=page.locator('.forte-access');
 await expect(page.locator('#protected-content')).toBeHidden();
 await gate.locator('input[name=cpf]').fill('52998224725');
 await gate.locator('input[name=password]').fill('123456');
 await gate.getByRole('button',{name:'ENTRAR',exact:true}).click();
 await page.getByRole('combobox',{name:'Produto',exact:true}).selectOption(product.id);
 await page.getByRole('textbox',{name:'Descrição pública'}).fill('Descrição revisada');
 await page.getByRole('checkbox',{name:'Exibir no catálogo público'}).check();
 await page.getByRole('button',{name:'Salvar publicação'}).click();
 await expect(page.getByText('Produto publicado.',{exact:true})).toBeVisible();
 await page.goto(origin+'/site.html');
 const card=page.locator('#catalog-products .card');
 await expect(card.getByRole('heading')).toHaveText(product.nome);
 await card.getByRole('link',{name:'SOLICITAR ORÇAMENTO'}).click();
 await expect(page.getByLabel('Produto',{exact:true})).toHaveValue('Cimento de teste - 50 kg');
 await page.goto(origin+'/venda-externa.html');
 await expect(page.locator('.forte-externa')).toBeVisible();
 await page.goto(origin+'/cff.html');
 await expect(page.getByRole('heading',{name:'Controle de Faturamento Fiscal'})).toBeVisible();
 expect(calls.filter(([,action])=>action==='LOGIN')).toEqual([['site','LOGIN']]);
 expect(calls).toContainEqual(['venda-externa','STATUS']);
 expect(calls).toContainEqual(['vendas','STATUS']);
 expect(errors).toEqual([]);
});
