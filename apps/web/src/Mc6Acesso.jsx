import {useState} from 'react';
import {autorizarMc6} from './mc6-acesso.mjs';

export default function Mc6Acesso({provedor='desconectado',sessao=null,projectRef=''}){
 const [pedido,setPedido]=useState(null);
 const [mensagem,setMensagem]=useState('');
 function entrar(event){
  event.preventDefault();
  if(provedor!=='ensaio'||!sessao?.userId){setPedido(null);setMensagem('Conexão de engenharia indisponível neste repositório público.');return;}
  const acesso=autorizarMc6({sessao,schema:'mc6',comando:'ler',projectRef});
  setPedido(acesso);
  setMensagem(acesso.permitido?'Leitura do schema mc6 autorizada. Nenhum equipamento foi acionado.':acesso.motivo);
 }
 function hardware(){
  const acesso=autorizarMc6({sessao:sessao||{},schema:'mc6',comando:'ligar motor',projectRef});
  setPedido(acesso);
  setMensagem('Comando de hardware bloqueado até validação de segurança.');
 }
 return <section className="mc6-acesso">
  <h2>Engenharia MC-6</h2>
  <p>O acesso usa somente o schema mc6, separado dos dados do Frete. Esta tela não publica desenho nem aciona máquina.</p>
  {!pedido?.permitido&&<form onSubmit={entrar}>
   <label>Identificação<input name="identificacao" autoComplete="username" defaultValue=""/></label>
   <button type="submit">ENTRAR</button>
  </form>}
  {pedido?.permitido&&<p>Sessão de engenharia ativa para leitura.</p>}
  <button type="button" onClick={hardware}>ACIONAR EQUIPAMENTO</button>
  <p role="status">{mensagem}</p>
 </section>;
}
