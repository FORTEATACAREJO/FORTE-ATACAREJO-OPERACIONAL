// Cadastro de motorista dentro do Operacional. Não copia senha, token nem arquivo.
const PLACA=/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const SEGREDO=['senha','password','token','access_token','refresh_token','secret','service_role','arquivo','conteudo_base64'];
export const somenteDigitos=value=>String(value??'').replace(/\D/g,'');

function documentoOperacional(documento){
 if(!documento||typeof documento!=='object')return {referencia:null,recusado:false};
 if(SEGREDO.some(campo=>campo in documento))return {referencia:null,recusado:true};
 const tipo=String(documento.tipo||'').trim();
 const storageBucket=String(documento.storageBucket||documento.storage_bucket||'').trim();
 const storagePath=String(documento.storagePath||documento.storage_path||'').trim();
 if(!tipo||!storageBucket||!storagePath)return {referencia:null,recusado:false};
 return {referencia:{tipo,storageBucket,storagePath},recusado:false};
}

export function analisarMotoristaOperacional(entrada={}){
 const nome=String(entrada.nome||'').trim();
 const cpf=somenteDigitos(entrada.cpf);
 const telefone=somenteDigitos(entrada.telefone||entrada.whatsapp);
 const cnh=String(entrada.cnhNumero||entrada.cnh||'').trim();
 const proprietario=String(entrada.proprietario||'').trim();
 const chavePix=String(entrada.chavePix||'').trim();
 const favorecidoPix=String(entrada.favorecidoPix||'').trim();
 const placa=String(entrada.placa1||'').trim().toUpperCase();
 const capacidade=Number(entrada.capacidadeMaximaKg);
 const documento=documentoOperacional(entrada.documento);
 const camposPendentes=[];
 if(SEGREDO.some(campo=>campo in entrada)||documento.recusado)camposPendentes.push('segredo_nao_copiado');
 if(!nome)camposPendentes.push('nome');
 if(cpf.length!==11||/^(\d)\1+$/.test(cpf))camposPendentes.push('cpf');
 if(telefone.length<10||telefone.length>13)camposPendentes.push('telefone');
 if(!cnh)camposPendentes.push('cnh');
 if(!proprietario)camposPendentes.push('proprietario');
 if(!chavePix)camposPendentes.push('chavePix');
 if(!favorecidoPix)camposPendentes.push('favorecidoPix');
 if(!PLACA.test(placa))camposPendentes.push('placa');
 if(!Number.isFinite(capacidade)||capacidade<=0)camposPendentes.push('capacidade');
 if(entrada.documento&&!documento.referencia)camposPendentes.push('documento');
 const apto=camposPendentes.length===0;
 const alvo=Number(entrada.capacidadeAlvoKg);
 return {apto,camposPendentes,registro:apto?{
  nome,cpf,telefone,whatsapp:telefone,cnhNumero:cnh,
  cnhCategoria:entrada.cnhCategoria||null,cnhValidade:entrada.cnhValidade||null,
  proprietario,chavePix,favorecidoPix,placa1:placa,
  capacidadeMaximaKg:capacidade,capacidadeAlvoKg:Number.isFinite(alvo)&&alvo>0?alvo:capacidade,
  tipoMotorista:'TRANSPORTE DE CARGA',rntrc:entrada.rntrc||null,
  documentos:documento.referencia?[documento.referencia]:[],
  ativo:false,statusCadastro:'PRONTO PARA CONFERÊNCIA'
 }:null};
}

export function gravarMotorista(lista=[],entrada={},{id='',agora=new Date().toISOString(),liberar=false}={}){
 const analise=analisarMotoristaOperacional(entrada);
 const cpf=somenteDigitos(entrada.cpf);
 const atual=(lista||[]).find(item=>item?.id&&item.id===id||cpf&&somenteDigitos(item?.cpf)===cpf);
 if(!analise.apto)return {acao:'revisar',escreve:false,motoristas:lista||[],registro:null,camposPendentes:analise.camposPendentes};
 const registro={...analise.registro,id:atual?.id||id||`mot-${agora}`,atualizadoEm:agora,origemSistema:atual?.origemSistema||entrada.origemSistema||'OPERACIONAL',ativo:false,statusCadastro:'PRONTO PARA CONFERÊNCIA'};
 if(liberar){registro.ativo=true;registro.statusCadastro='LIBERADO PARA CARGAS';}
 else if(atual?.ativo===true){registro.ativo=true;registro.statusCadastro=atual.statusCadastro||'LIBERADO PARA CARGAS';}
 if(atual?.atualizadoEm&&atual.atualizadoEm>agora)return {acao:'conflito',escreve:false,motoristas:lista,registro:atual,camposPendentes:[]};
 const igual=atual&&['nome','cpf','telefone','cnhNumero','proprietario','chavePix','favorecidoPix','placa1','capacidadeMaximaKg','ativo'].every(campo=>String(atual[campo]??'')===String(registro[campo]??''));
 if(igual)return {acao:'preservar',escreve:false,motoristas:lista,registro:atual,camposPendentes:[]};
 if(!atual)return {acao:'inserir',escreve:true,motoristas:[...(lista||[]),registro],registro,camposPendentes:[]};
 return {acao:'atualizar',escreve:true,motoristas:(lista||[]).map(item=>item.id===atual.id?{...atual,...registro,id:atual.id}:item),registro,camposPendentes:[]};
}

export function mensagemGravacao(resultado){
 if(resultado?.camposPendentes?.length)return 'Complete os campos pendentes antes de gravar.';
 if(resultado?.acao==='preservar')return 'Cadastro já estava igual.';
 if(resultado?.acao==='conflito')return 'Existe uma versão mais nova. Atualize a consulta antes de gravar.';
 if(resultado?.escreve&&resultado.registro?.ativo)return 'Motorista liberado para cargas.';
 if(resultado?.escreve)return 'Motorista gravado no operacional e ainda inativo.';
 return 'Nada foi alterado.';
}

export function resumoMotoristas(lista=[]){
 const visiveis=(lista||[]).filter(item=>item?.teste!==true);
 return {total:visiveis.length,liberados:visiveis.filter(item=>item.ativo===true).length,conferencia:visiveis.filter(item=>item.ativo!==true).length};
}
