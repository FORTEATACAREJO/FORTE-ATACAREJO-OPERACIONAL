import {sanitizarPainelMotorista} from './frete-acesso.mjs';

export default function FreteCargasMotorista({painel,erro=''}){
 const visao=sanitizarPainelMotorista(painel);
 if(erro)return <section className="card frete-cargas"><h2>Minhas cargas</h2><p role="alert">{erro}</p></section>;
 if(!painel)return <section className="card frete-cargas"><h2>Minhas cargas</h2><p role="status">Carregando suas cargas…</p></section>;
 return <section className="card frete-cargas">
  <h2>Minhas cargas</h2>
  <p>{visao.motorista?.nome?`${visao.motorista.nome} • ${visao.motorista.placa||'placa a conferir'} • ${visao.motorista.situacao||'liberado'}`:visao.motivo||'Nenhuma carga liberada para este cadastro.'}</p>
  {!visao.cargas.length&&<p>Não há carga atribuída. Cadastro em conferência não entra em carga.</p>}
  <ul>{visao.cargas.map(carga=><li key={carga.id||carga.codigo}>
   <b>{carga.codigo||'Carga'}</b>
   <span>{carga.fase||carga.status||'Em andamento'}</span>
   <span>{[carga.localCarregamento,carga.destino].filter(Boolean).join(' → ')||'Origem e destino a conferir'}</span>
   <span>{Number(carga.pesoKg||0).toLocaleString('pt-BR')} kg • {carga.produto||'Produto a conferir'}</span>
   <span>Pedido {carga.numeroPedidoFornecedor||'aguardando'} • {carga.modalidadeFrete||'frete a conferir'} • {carga.placa||visao.motorista?.placa||''}</span>
   {carga.documentos.map(doc=><small key={doc.categoria}>{doc.categoria}: {doc.situacao||'recebido'}</small>)}
  </li>)}</ul>
 </section>;
}
