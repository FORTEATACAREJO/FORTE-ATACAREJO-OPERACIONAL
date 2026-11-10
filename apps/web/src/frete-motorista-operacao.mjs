// Aceite e anexo do motorista dentro do operacional, só em homologação.
// Não ativa cadastro, não copia arquivo e não carrega Pix, senha ou token.
const HASH=/^[a-f0-9]{64}$/;
export const BUCKET_FRETE_SANDBOX='fc-frete-sandbox';
export const MENSAGENS_FRETE={
 aceita:'Carga de homologação aceita. O cadastro do motorista continua inativo.',
 jaAceita:'Carga já estava aceita.',
 recusada:'Carga de homologação recusada.',
 jaRecusada:'Carga já estava recusada.',
 anexo:'Referência do comprovante registrada. O arquivo não foi copiado.',
 anexoIgual:'Esta referência já estava registrada.',
 vazia:'Nenhuma carga de homologação foi oferecida para este perfil.',
 semSessao:'A homologação das cargas fica disponível na sessão do operacional. Nenhum cadastro real é ativado nesta tela.'
};

export function caminhoAnexoFrete(userId,cargaId){
 return `${userId}/${cargaId}/comprovante`;
}

function homologacao(carga){
 return Boolean(carga)&&carga.sandbox===true&&['OFERECIDA','ACEITA','RECUSADA'].includes(carga.status);
}

export function decidirCargaMotorista(carga,{decisao,motivo=''}={}){
 if(!homologacao(carga))return {ok:false,erro:'Somente carga de homologação pode ser decidida.'};
 if(carga.status===decisao&&(decisao==='ACEITA'||decisao==='RECUSADA'))return {ok:true,carga,idempotente:true,mensagem:decisao==='ACEITA'?MENSAGENS_FRETE.jaAceita:MENSAGENS_FRETE.jaRecusada};
 if(carga.status!=='OFERECIDA')return {ok:false,erro:'Esta carga já foi decidida.'};
 if(decisao==='RECUSADA'&&String(motivo||'').trim().length<3)return {ok:false,erro:'Informe o motivo da recusa.'};
 if(!['ACEITA','RECUSADA'].includes(decisao))return {ok:false,erro:'Decisão inválida.'};
 const proxima={...carga,status:decisao,motivo:decisao==='RECUSADA'?String(motivo).trim().slice(0,300):null};
 return {ok:true,carga:proxima,idempotente:false,mensagem:decisao==='ACEITA'?MENSAGENS_FRETE.aceita:MENSAGENS_FRETE.recusada};
}

export function anexarReferenciaCarga(carga,{bucket,path,sha256,userId}={}){
 if(!homologacao(carga)||carga.status!=='ACEITA')return {ok:false,erro:'Anexe depois de aceitar a carga de homologação.'};
 const referencia=String(path||'');
 const hash=String(sha256||'').trim().toLowerCase();
 if(bucket!==BUCKET_FRETE_SANDBOX)return {ok:false,erro:'Bucket não autorizado.'};
 if(!userId||referencia!==caminhoAnexoFrete(userId,carga.id))return {ok:false,erro:'O anexo precisa ficar na pasta da carga.'};
 if(/senha|password|token|pix|base64/i.test(referencia))return {ok:false,erro:'Referência recusada.'};
 if(!HASH.test(hash))return {ok:false,erro:'Informe o hash SHA-256 do arquivo.'};
 if(carga.anexoSha256&&carga.anexoSha256!==hash)return {ok:false,erro:'Já existe outro anexo. Não sobrescreve.'};
 if(carga.anexoSha256===hash)return {ok:true,carga,idempotente:true,mensagem:MENSAGENS_FRETE.anexoIgual};
 return {ok:true,carga:{...carga,anexoSha256:hash,anexoBucket:bucket,anexoPath:referencia},idempotente:false,mensagem:MENSAGENS_FRETE.anexo};
}
