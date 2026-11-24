import {requireCapacity} from './capacity.mjs';
import {phone} from './communications.mjs';
export function driverOrderSnapshot(c){
 return {
  id:c.id,codigo:c.codigo,numeroOS:c.numeroOS||'',
  protocolo:c.protocolo||'',numeroPedidoFornecedor:c.numeroPedidoFornecedor,
  fornecedor:c.fornecedor,unidade:c.unidade,origem:c.localCarregamento||c.origem,
  destino:c.destino,motoristaId:c.motoristaId,motorista:c.motorista,
  veiculoId:c.veiculoId||'',vinculoFrotaId:c.vinculoFrotaId||'',
  transportadoraNome:c.transportadoraNome||c.motoristaSnapshot?.transportadoraNome||'',
  placas:[...(c.placas||[])],pesoKg:c.pesoKg,
  regraPallets:c.regraPallets,palletQuantidade:c.palletQuantidade,
  justificativaPallets:c.justificativaPallets,
  liberacaoPalletsFornecedor:c.liberacaoPalletsFornecedor,
  ordemRevisadaEm:c.ordemRevisadaEm||'',
  motoristaSnapshot:Object.fromEntries(['cpf','cnhNumero','rntrc'].map(k=>[k,c.motoristaSnapshot?.[k]])),
  itens:(c.itens||[]).map(i=>({produto:i.produto,qtd:i.qtd,pesoKg:i.pesoKg}))
 };
}
export function driverDispatchCheck(s,j){
 const c=(s.cargas||[]).find(c=>c.id===j.cargaId),m=(s.motoristas||[]).find(m=>m.id===c?.motoristaId&&m.ativo!==false);
 if(!c||c.status==='CANCELADA'||c.finalizadaEm||!c.ordemRevisadaEm||!c.numeroPedidoFornecedor)throw Error('Ordem indisponível. Confira e grave a ordem antes de enviar.');
 if(!m||/PENDENTE|ANALISE|ANÁLISE|RECUSADO|CONFERENCIA|AGUARDANDO|PRE_CADASTRO|REPROVADO|INATIVO/.test(String(m.statusCadastro||'').toUpperCase()))throw Error('Motorista aguarda aprovação.');
 if(String(c.regraPallets||'').startsWith('Solicitar')&&!c.liberacaoPalletsFornecedor?.evidencia)throw Error('Liberação de pallets pendente.');
 // Para veículos vinculados manualmente, a placa e a capacidade vêm da
 // ordem revisada, nunca de uma placa histórica no cadastro do motorista.
 const linked=Boolean(c.vinculoFrotaId&&c.veiculoId);
 const plateSnapshot=linked?[...(c.placas||[])]:[m.placa1,m.placa2,m.placa3,m.placa4].filter(Boolean);
 const driverForCapacity=linked?{
  ...m,placa1:c.placas?.[0]||'',
  placa2:c.placas?.[1]||'',placa3:c.placas?.[2]||'',placa4:c.placas?.[3]||'',
  capacidadeMaximaKg:Number(c.motoristaSnapshot?.capacidadeMaximaKg)||0,
  capacidadeAlvoKg:Number(c.motoristaSnapshot?.capacidadeAlvoKg)||0,
  freteVeiculoId:c.veiculoId
 }:m;
 requireCapacity(driverForCapacity,c.pesoKg,c.confirmacaoCapacidade?.snapshot);
 if(j.snapshot!==JSON.stringify(driverOrderSnapshot(c))||j.to!==phone(m.whatsapp||m.telefone)||JSON.stringify(c.placas)!==JSON.stringify(plateSnapshot))
  throw Error('Ordem, motorista ou WhatsApp alterado. Prepare novamente o envio.');
 return c;
}
export function queueDriverOrder(s,c,at,event){
 const m=(s.motoristas||[]).find(m=>m.id===c.motoristaId),to=phone(m?.whatsapp||m?.telefone);if(!to)throw Error('Cadastre o WhatsApp do motorista com DDD.');
 const order=driverOrderSnapshot(c),snapshot=JSON.stringify(order);s.comunicacoes??=[];
 const prior=s.comunicacoes.find(j=>j.audience==='MOTORISTA'&&j.cargaId===c.id&&j.snapshot===snapshot&&j.to===to&&j.state!=='CANCELLED');if(prior){driverDispatchCheck(s,prior);return prior;}
 const key=c.id+':ORDEM_MOTORISTA:'+event;
 const j={id:key,key,kind:'ORDEM_MOTORISTA',audience:'MOTORISTA',canal:'WHATSAPP',to,motoristaId:c.motoristaId,cargaId:c.id,reference:c.numeroPedidoFornecedor,snapshot,order,items:order.itens,message:'FORTE ATACAREJO — Ordem de carregamento. Protocolo '+(c.protocolo||c.codigo)+'. Nossa OS '+(c.numeroOS||'a conferir')+'. Pedido da indústria '+c.numeroPedidoFornecedor+'. Retirada: '+order.origem+'. Destino: '+c.destino+'. Placas: '+c.placas.join(' / ')+'.',state:'QUEUED',createdAt:at};driverDispatchCheck(s,j);s.comunicacoes.push(j);return j;
}
export function recordDriverDispatch(s,j,at){if(j.audience!=='MOTORISTA')return;const c=driverDispatchCheck(s,j);Object.assign(c,{ordemMotoristaEnviada:true,ordemEnviadaEm:at,ordemCanal:'WHATSAPP BUSINESS',ordemDestinatario:j.to,ordemMensagemId:j.providerId,fase:'ORDEM ENVIADA — AGUARDANDO ENTREGA WHATSAPP'});}
