// Preserve original route IDs and permissions; expose three work panels and one logistics panel.
export function workspaceNavigation(canGroup,canScreen,unread=0){
 const item=(id,label,description,icon,screens=[],groups=[])=>({id,label,description,icon,screens,groups});
 const main=[item('home','Início','Painel único FORTE-OP','home',['home'])];
 if(canScreen('painelUnicoVendas'))main.push(item('painelUnicoVendas','Vendas','Pedidos, documentos e histórico','file',['painelUnicoVendas']));
 if(canScreen('externas'))main.push(item('externas','Vendas externas','Pedidos e representantes sem sair do aplicativo','users',['externas']));
 if(canScreen('clientes'))main.push(item('clientes','Carga direta','Vendas e entregas diretas','truck',['clientes','diretas']));
 if(canScreen('balcao'))main.push(item('balcao','Balcão','Vendas de balcão e entregas','money',['balcao']));
 if(canScreen('painelCompras'))main.push(item('painelCompras','Compras','Compras e pedidos ao fornecedor','box',['painelCompras','comprasFornecedor','compraForte']));
 if(canScreen('paletes'))main.push(item('paletes','Pallets','Estoque e contas correntes','box',['paletes']));
 if(canScreen('painelCargas'))main.push(item('painelCargas','Cargas','Expedição e logística','truck',['painelCargas','ordensCarregamento','planejamento','todasCargas']));
 if(canScreen('freteSolicitacoes'))main.push(item('freteSolicitacoes','Frete','Solicitações e sincronização do frete','truck',['freteSolicitacoes','motorista']));
 if(canGroup('financeiro'))main.push(item('group:financeiro','Financeiro','Contas, cobranças e tesouraria','money',[],['financeiro']));
 const tools=[
 ['vendas','Outras operações de venda','Balcão e representantes','file'],
 ['patio','Estoque do galpão','Consulta do estoque físico','box'],
 ['logistica','Operação logística','Ferramentas operacionais','truck'],
 ['conferencia','Conferência de documentos','Anexos e divergências','check'],
 ['financeiro','Financeiro e cobranças','Contas, boletos e tesouraria','money'],
 ['cobrancas','Cobranças','Boletos de clientes','money'],
 ['fornecedores','Fornecedores','Cadastros e condições comerciais','box'],
 ['cadastros','Cadastros e usuários','Clientes, produtos e acessos','users'],
 ['relatorios','Relatórios','Consulta e desempenho','file'],
 ['integracoes','Integrações','WhatsApp, Gmail, bancos e cartões','grid']
 ];
 const more=tools.filter(([g])=>canGroup(g)&&!(g==='cobrancas'&&canGroup('financeiro'))).map(([g,label,description,icon])=>item('group:'+g,label,description,icon,[],g==='financeiro'?['financeiro','cobrancas']:[g]));
 if(canScreen('whatsapp'))more.unshift(item('whatsapp','WhatsApp — Central'+(unread?' ('+unread+')':''),'Conversas, respostas e anexos','users',['whatsapp']));
 return{main,more};
}
export function workspaceItemActive(item,screen,group){
 if(item.id===screen||item.screens.includes(screen))return true;
 if(['whatsapp','painelUnicoVendas','clientes','diretas','balcao','externas','painelCompras','comprasFornecedor','compraForte','paletes','painelCargas','ordensCarregamento','planejamento','todasCargas'].includes(screen))return false;
 return item.groups.includes(group);
}
