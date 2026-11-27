export const fields={nome:'Nome completo',cpf:'CPF',whatsapp:'WhatsApp',email:'E-mail',cnh:'Registro CNH',categoria:'Categoria CNH',validade:'Validade CNH',endereco:'Endereço',cidade:'Cidade/UF',proprietario:'É proprietário do veículo?',nomeProprietario:'Nome ou razão social do proprietário',documentoProprietario:'CPF ou CNPJ do proprietário',pixFrete:'Chave Pix do frete',placaCavalo:'Placa do cavalo',placaCarreta1:'Placa da carreta 1',placaCarreta2:'Placa da carreta 2',placaCarreta3:'Placa da carreta 3'};
export const intakeGroups=[
 ['Motorista',['nome','cpf','whatsapp','cnh','categoria']],
 ['Veículo',['placaCavalo','placaCarreta1','placaCarreta2','placaCarreta3','nomeProprietario','documentoProprietario','pixFrete']]
];
export const documents={cnhFrente:'CNH frente',cnhVerso:'CNH verso',cnhDigital:'CNH Digital (PDF)',cavalo:'Documento do caminhão',carreta1:'Documento da carreta 1',carreta2:'Documento da carreta 2',conjunto:'Foto do conjunto a 45°'};
export const maxFile=6*1024*1024,maxBody=12*1024*1024;
export function validateFields(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Dados inválidos.');
 const out={};
 for(const [k,v] of Object.entries(input)){
  if(!Object.hasOwn(fields,k)||typeof v!=='string'||v.length>300||/[\u0000-\u001f\u007f]/.test(v))throw Error('Campo inválido.');
  if(v.trim())out[k]=v.trim();
 }
 if(out.cpf){out.cpf=out.cpf.replace(/\D/g,'');if(!/^\d{11}$/.test(out.cpf))throw Error('CPF: informe 11 dígitos ou deixe em branco.');}
 if(out.cnh){out.cnh=out.cnh.replace(/\D/g,'');if(!/^\d{11}$/.test(out.cnh))throw Error('CNH: informe 11 dígitos ou deixe em branco.');}
 if(out.whatsapp){out.whatsapp=out.whatsapp.replace(/\D/g,'');if(!/^\d{10,13}$/.test(out.whatsapp))throw Error('WhatsApp: informe DDD ou deixe em branco.');}
 if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw Error('E-mail inválido.');
 if(out.categoria&&!/^(A?[BCDE]|A|AB)$/.test(out.categoria))throw Error('Categoria inválida.');
 if(out.validade&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.validade)||Number.isNaN(Date.parse(out.validade))||new Date(out.validade).toISOString().slice(0,10)!==out.validade))throw Error('Data inválida.');
 if(out.proprietario&&!['Sim','Não'].includes(out.proprietario))throw Error('Selecione Sim ou Não.');
 return out;
}
export function identifyFile(bytes){
 const a=bytes;
 if(a[0]===255&&a[1]===216&&a[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 if(a[0]===137&&a[1]===80&&a[2]===78&&a[3]===71&&a[4]===13&&a[5]===10&&a[6]===26&&a[7]===10)return {mime:'image/png',ext:'png'};
 if(a[0]===37&&a[1]===80&&a[2]===68&&a[3]===70&&a[4]===45)return {mime:'application/pdf',ext:'pdf'};
 if(a[0]===82&&a[1]===73&&a[2]===70&&a[3]===70&&a[8]===87&&a[9]===69&&a[10]===66&&a[11]===80)return {mime:'image/webp',ext:'webp'};
 throw Error('Use fotos JPG, PNG, WEBP ou documento PDF.');
}
export function validToken(t){return typeof t==='string'&&/^[a-f0-9]{64}$/.test(t)}

export function validateScope(scope){
 if(scope==null)return null;
 if(typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).some(k=>!['fields','documents'].includes(k))||!Array.isArray(scope.fields)||!Array.isArray(scope.documents)||scope.fields.some(k=>typeof k!=='string'||!Object.hasOwn(fields,k))||scope.documents.some(k=>typeof k!=='string'||!Object.hasOwn(documents,k))||!scope.fields.length&&!scope.documents.length)throw Error('Selecione as pendências a solicitar.');
 return {fields:[...new Set(scope.fields)],documents:[...new Set(scope.documents)]};
}
export function scopeAllows(scope,kind,key){return scope==null||scope[kind].includes(key);}
export function suggestedFields(driver){
 const values={nome:driver.nome,cpf:driver.cpf,whatsapp:driver.whatsapp||driver.telefone,cnh:driver.cnhNumero||driver.cnh,categoria:driver.cnhCategoria||driver.categoria_cnh,validade:driver.cnhValidade||driver.validade_cnh};
 return Object.keys(values).filter(k=>!String(values[k]||'').trim()||(['cpf','cnh'].includes(k)&&String(values[k]).replace(/\D/g,'').length!==11));
}

export function driverPrefill(driver,scope){
 const values={nome:driver?.nome,placaCavalo:driver?.placa1,placaCarreta1:driver?.placa2,placaCarreta2:driver?.placa3,placaCarreta3:driver?.placa4};
 return Object.fromEntries(Object.entries(values).filter(([key,value])=>typeof value==='string'&&value.trim()&&scopeAllows(scope,'fields',key)));
}
