// Screen grants for the unified PWA. A module flag never opens Financeiro or the rest of Vendas.
export function appFlagsFrom(permissions){
 if(!permissions||Array.isArray(permissions)||typeof permissions!=='object')return {};
 return Object.fromEntries(['vendas','venda-externa','carga-direta','frete','financeiro','site'].filter(key=>permissions[key]===true).map(key=>[key,true]));
}
export function screenAllowed({screen,action='visualizar',groupId='',groupAllowed,appFlags={},financeMode=false}){
 if(financeMode)return groupAllowed(groupId,action);
 const flag=key=>appFlags[key]===true;
 if(screen==='externas'&&flag('venda-externa'))return true;
 if((screen==='clientes'||screen==='diretas')&&flag('carga-direta'))return true;
 if(screen==='motorista')return flag('frete')||groupAllowed('vendas',action)||groupAllowed('logistica',action);
 return groupAllowed(groupId,action);
}
