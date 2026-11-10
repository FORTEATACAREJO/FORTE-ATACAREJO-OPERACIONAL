const BLOQUEIO=/PENDENTE|ANALISE|RECUSADO|CONFERENCIA|AGUARDANDO/;
const statusDe=valor=>String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();

export function motoristaSelecionavelParaCarga(motorista){
 if(!motorista||motorista.ativo===false||motorista.teste===true)return false;
 return !BLOQUEIO.test(statusDe(motorista.statusCadastro));
}

export function sanitizarPainelMotorista(painel){
 const origem=painel&&typeof painel==='object'?painel:{};
 const pessoa=origem.motorista&&typeof origem.motorista==='object'?origem.motorista:null;
 const motorista=pessoa?{id:pessoa.id||'',nome:pessoa.nome||'',placa:pessoa.placa||'',situacao:pessoa.situacao||''}:null;
 const cargas=(Array.isArray(origem.cargas)?origem.cargas:[]).map(carga=>({
  id:carga?.id||'',codigo:carga?.codigo||'',fase:carga?.fase||'',status:carga?.status||'',placa:carga?.placa||'',
  pesoKg:Number(carga?.pesoKg||0),localCarregamento:carga?.localCarregamento||'',destino:carga?.destino||'',
  dataCarregamento:carga?.dataCarregamento||'',numeroPedidoFornecedor:carga?.numeroPedidoFornecedor||'',
  modalidadeFrete:carga?.modalidadeFrete||'',produto:carga?.produto||'',
  documentos:(Array.isArray(carga?.documentos)?carga.documentos:[]).map(doc=>({categoria:doc?.categoria||'',situacao:doc?.situacao||''}))
 }));
 return {motorista,cargas,motivo:String(origem.motivo||'')};
}
