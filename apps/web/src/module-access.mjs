// Screen grants for the unified PWA. A module flag never opens Financeiro or the rest of Vendas.
export function appFlagsFrom(permissions){
 if(!permissions||Array.isArray(permissions)||typeof permissions!=='object')return {};
 return Object.fromEntries(['vendas','venda-externa','carga-direta','frete','financeiro','site'].filter(key=>permissions[key]===true).map(key=>[key,true]));
}
export function resolverEntrada(modulos=[]){
 const lista=Array.isArray(modulos)?modulos:[];
 const vendas=lista.find(item=>item?.app==='vendas'&&item.allowed===true);
 if(vendas)return {modo:'operacional',app:'vendas',role:vendas.role||'',permissions:vendas.permissions||{}};
 const frete=lista.find(item=>item?.app==='frete'&&item.allowed===true);
 if(frete)return {modo:'frete',app:'frete',role:frete.role||'',permissions:frete.permissions||{frete:true}};
 return {modo:'bloqueado',motivo:'Aguarde aprovação específica no Forte Vendas ou no módulo de Frete.'};
}
export function screenAllowed({screen,action='visualizar',groupId='',groupAllowed,appFlags={},financeMode=false,freteMode=false}){
 if(freteMode)return screen==='motorista';
 if(financeMode)return groupAllowed(groupId,action);
 const flag=key=>appFlags[key]===true;
 if(screen==='externas'&&flag('venda-externa'))return true;
 if((screen==='clientes'||screen==='diretas')&&flag('carga-direta'))return true;
 if(screen==='motorista')return flag('frete')||groupAllowed('vendas',action)||groupAllowed('logistica',action);
 return groupAllowed(groupId,action);
}
