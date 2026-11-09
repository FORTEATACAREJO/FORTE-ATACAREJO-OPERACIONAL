import {useMemo,useState} from 'react';
import {analisarMotoristaOperacional,gravarMotorista,mensagemGravacao,resumoMotoristas,somenteDigitos} from './frete-motorista.mjs';

const VAZIO={id:'',nome:'',cpf:'',telefone:'',cnhNumero:'',proprietario:'',chavePix:'',favorecidoPix:'',placa1:'',capacidadeMaximaKg:'',capacidadeAlvoKg:'',rntrc:'',documentoTipo:'',storageBucket:'',storagePath:''};

function formulario(motorista){
 if(!motorista)return {...VAZIO};
 return {...VAZIO,id:motorista.id||'',nome:motorista.nome||'',cpf:motorista.cpf||'',telefone:motorista.telefone||motorista.whatsapp||'',cnhNumero:motorista.cnhNumero||'',proprietario:motorista.proprietario||'',chavePix:motorista.chavePix||'',favorecidoPix:motorista.favorecidoPix||'',placa1:motorista.placa1||'',capacidadeMaximaKg:motorista.capacidadeMaximaKg||'',capacidadeAlvoKg:motorista.capacidadeAlvoKg||'',rntrc:motorista.rntrc||'',documentoTipo:motorista.documentos?.[0]?.tipo||'',storageBucket:motorista.documentos?.[0]?.storageBucket||'',storagePath:motorista.documentos?.[0]?.storagePath||''};
}

export default function FreteMotoristaPainel({motoristas=[],canEdit=false,onSave}){
 const [query,setQuery]=useState('');
 const [form,setForm]=useState(VAZIO);
 const [message,setMessage]=useState('');
 const resumo=resumoMotoristas(motoristas);
 const analise=useMemo(()=>analisarMotoristaOperacional(entrada(form)),[form]);
 const linhas=(motoristas||[]).filter(item=>item?.teste!==true&&[item.nome,item.placa1,item.statusCadastro].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
 function setCampo(campo,valor){setForm(atual=>({...atual,[campo]:valor}));}
 function gravar(liberar){
  const resultado=gravarMotorista(motoristas,entrada(form),{id:form.id,liberar});
  setMessage(mensagemGravacao(resultado));
  if(resultado.escreve){onSave?.(resultado);setForm(formulario(resultado.registro));}
 }
 return <div className="frete-motorista">
  <p>{resumo.liberados} liberado(s) para carga • {resumo.conferencia} em conferência • {resumo.total} no operacional.</p>
  <p>O cadastro, o veículo e a referência do documento ficam nesta tela. O sistema antigo permanece ligado até a reconciliação e não é apagado.</p>
  <label>Buscar nome ou placa<input value={query} onChange={event=>setQuery(event.target.value)}/></label>
  <div className="flowTable"><table><thead><tr><th>Motorista</th><th>Placa</th><th>Capacidade</th><th>Situação</th></tr></thead><tbody>
   {linhas.map(item=><tr key={item.id}><td><button type="button" onClick={()=>setForm(formulario(item))}>{item.nome}</button></td><td>{item.placa1||'—'}</td><td>{Number(item.capacidadeMaximaKg||0).toLocaleString('pt-BR')} kg</td><td>{item.ativo?'Liberado para cargas':item.statusCadastro||'Em conferência'}</td></tr>)}
  </tbody></table></div>
  {!linhas.length&&<p>Nenhum motorista nesta consulta. Grave o cadastro aqui.</p>}
  <form onSubmit={event=>{event.preventDefault();gravar(false);}}>
   <div className="miniGrid">
    <label>Nome<input name="nome" value={form.nome} onChange={event=>setCampo('nome',event.target.value)} disabled={!canEdit}/></label>
    <label>CPF<input name="cpf" inputMode="numeric" value={form.cpf} onChange={event=>setCampo('cpf',event.target.value)} disabled={!canEdit}/></label>
    <label>WhatsApp<input name="telefone" inputMode="tel" value={form.telefone} onChange={event=>setCampo('telefone',event.target.value)} disabled={!canEdit}/></label>
    <label>CNH<input name="cnhNumero" value={form.cnhNumero} onChange={event=>setCampo('cnhNumero',event.target.value)} disabled={!canEdit}/></label>
    <label>Proprietário<input name="proprietario" value={form.proprietario} onChange={event=>setCampo('proprietario',event.target.value)} disabled={!canEdit}/></label>
    <label>Placa<input name="placa1" value={form.placa1} onChange={event=>setCampo('placa1',event.target.value.toUpperCase())} disabled={!canEdit}/></label>
    <label>Capacidade máxima kg<input name="capacidadeMaximaKg" inputMode="numeric" value={form.capacidadeMaximaKg} onChange={event=>setCampo('capacidadeMaximaKg',event.target.value)} disabled={!canEdit}/></label>
    <label>Chave Pix<input name="chavePix" value={form.chavePix} onChange={event=>setCampo('chavePix',event.target.value)} disabled={!canEdit}/></label>
    <label>Favorecido Pix<input name="favorecidoPix" value={form.favorecidoPix} onChange={event=>setCampo('favorecidoPix',event.target.value)} disabled={!canEdit}/></label>
    <label>RNTRC<input name="rntrc" value={form.rntrc} onChange={event=>setCampo('rntrc',event.target.value)} disabled={!canEdit}/></label>
    <label>Tipo do documento<input name="documentoTipo" value={form.documentoTipo} onChange={event=>setCampo('documentoTipo',event.target.value)} disabled={!canEdit}/></label>
    <label>Bucket do documento<input name="storageBucket" value={form.storageBucket} onChange={event=>setCampo('storageBucket',event.target.value)} disabled={!canEdit}/></label>
    <label>Caminho do documento<input name="storagePath" value={form.storagePath} onChange={event=>setCampo('storagePath',event.target.value)} disabled={!canEdit}/></label>
   </div>
   {!!analise.camposPendentes.length&&form.nome&&<p>Pendências: {analise.camposPendentes.join(', ')}</p>}
   {canEdit&&<div className="rowActions"><button type="submit">GRAVAR NO OPERACIONAL</button><button type="button" disabled={!analise.apto} onClick={()=>gravar(true)}>LIBERAR PARA CARGAS</button></div>}
  </form>
  <p role="status">{message}</p>
 </div>;
}

function entrada(form){
 const documento=form.documentoTipo||form.storageBucket||form.storagePath?{tipo:form.documentoTipo,storageBucket:form.storageBucket,storagePath:form.storagePath}:undefined;
 return {nome:form.nome,cpf:somenteDigitos(form.cpf),telefone:form.telefone,cnhNumero:form.cnhNumero,proprietario:form.proprietario,chavePix:form.chavePix,favorecidoPix:form.favorecidoPix,placa1:form.placa1,capacidadeMaximaKg:form.capacidadeMaximaKg,capacidadeAlvoKg:form.capacidadeAlvoKg,rntrc:form.rntrc,documento};
}
