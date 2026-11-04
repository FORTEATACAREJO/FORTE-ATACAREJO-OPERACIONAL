export const unique=values=>[...new Set(values.map(v=>String(v??'').trim()).filter(Boolean))];
export const address=x=>x?.endereco||[x?.logradouro,x?.numero,x?.bairro,x?.cidade,x?.uf].filter(Boolean).join(', ');
export const baseTerms=['À VISTA','ANTECIPADO','7 DIAS','14 DIAS','21 DIAS','28 DIAS','7/14/21 DIAS','7/14/21/28 DIAS'];
export const terms=data=>unique([...baseTerms,...(data.condicoesPagamento||[])]);
export function salePrice(data,clienteId,produtoId){
 const p=data.produtos.find(x=>x.id===produtoId),r=(data.precosClientes||[]).find(x=>x.clienteId===clienteId&&x.produtoId===produtoId);
 const price=r?.precoFinal!=null?Number(r.precoFinal):Number(p?.precoTabela||0)*(1-Number(r?.descontoPct||0)/100);
 return Number.isFinite(price)&&price>0?String(Math.round(price*100)/100):'';
}
export function purchaseRules(data,form){return (data.custosFornecedor||[]).filter(x=>x.fornecedorId===form.fornecedorId&&x.produtoId===form.produtoId);}
export function purchaseDefaults(data,form,patch={}){
 const next={...form,...patch},f=data.fornecedores.find(x=>x.id===next.fornecedorId);
 if(Object.hasOwn(patch,'fornecedorId'))Object.assign(next,{email:f?.email||'',whatsapp:f?.whatsapp||'',origem:f?.origem||'',modalidadeFrete:['FOB','CIF'].includes(f?.modalidadeFrete)?f.modalidadeFrete:'FOB',condicao:f?.condicaoPagamento||'14 DIAS',precoCompra:'',custoId:''});
 const rules=purchaseRules(data,next).filter(x=>x.condicaoPagamento===next.condicao);
 if(Object.hasOwn(patch,'fornecedorId')||Object.hasOwn(patch,'produtoId')||Object.hasOwn(patch,'condicao')){
  const r=rules.length===1?rules[0]:null;next.precoCompra=r&&Number(r.custoUnitario)>0?String(r.custoUnitario):'';next.custoId=r?.id||'';
 }
 return next;
}
export function saleDefaults(data,form,clienteId){
 const c=data.clientes.find(x=>x.id===clienteId),condition=c?.condicaoPagamento||'',numeric=/\d/.test(condition);
 const method=c?.formaPagamento||(/PIX/i.test(condition)?'PIX':/DINHEIRO/i.test(condition)?'DINHEIRO':numeric?'BOLETO':'PIX');
 return {...form,clienteId,email:c?.email||'',whatsapp:c?.whatsapp||c?.telefone||'',destino:address(c),obra:'',vendedorId:data.vendedores.some(x=>x.id===c?.vendedorResponsavelId)?c.vendedorResponsavelId:'',formaPagamento:method,condicaoPagamento:numeric?condition:'14 DIAS',fretePorTon:c?.fretePorTon!=null?String(c.fretePorTon):'140',precoUnitario:salePrice(data,clienteId,form.produtoId)};
}
export function palletSuggestion(data,produtoId,qtd){const p=data.produtos.find(x=>x.id===produtoId);const per=Number(p?.qtdPorPallet)||({50:40,40:50,20:100}[Number(p?.pesoKg)]||0);return per&&Number(qtd)>0?String(Math.ceil(Number(qtd)/per)):'';}
export function withPallets(data,form,patch){const next={...form,...patch};if(next.pallet==='SEM PALLETS')next.palletQuantidade='0';else if(next.pallet&&['qtd','produtoId','pallet'].some(k=>Object.hasOwn(patch,k)))next.palletQuantidade=palletSuggestion(data,next.produtoId,next.qtd);return next;}
