import {useEffect, useState} from 'react';
import {supabase} from '../supabase.js';
import './cff.css';

async function invoke(body) {
  const {data,error} = await supabase.functions.invoke('cff-conferencias',{body});
  if (!error) return data;
  const detail = await error.context?.json?.().catch(() => null);
  throw Error(detail?.error || 'Não foi possível acessar as conferências.');
}

function downloadReview(review) {
  const file = new Blob([JSON.stringify({
    tipo:'conferencia_cff',
    versao:1,
    protocolo:review.id,
    registradaEm:review.created_at,
    orcamento:review.conferencia,
  },null,2)], {type:'application/json'});
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'conferencia-cff-'+review.id+'.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

export default function Cff() {
  const [data,setData] = useState({orcamentos:[],historico:[]});
  const [selected,setSelected] = useState('');
  const [quantities,setQuantities] = useState([]);
  const [reason,setReason] = useState('');
  const [busy,setBusy] = useState(true);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const budget = data.orcamentos.find(item => item.id === selected);

  async function refresh() {
    setBusy(true);
    setError('');
    setSelected('');
    try { setData(await invoke({acao:'LISTAR'})); }
    catch (err) { setData({orcamentos:[],historico:[]}); setError(err.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);

  function select(id) {
    setSelected(id);
    setQuantities(data.orcamentos.find(item => item.id === id)?.items.map(item => String(item.quantidade)) || []);
    setReason('');
    setMessage('');
  }

  async function save(event) {
    event.preventDefault();
    if (busy || !budget) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await invoke({
        acao:'CONFERIR',orcamentoId:budget.id,versao:budget.versao,
        quantidades:quantities.map(value => value === '' ? null : Number(value)),justificativa:reason,
      });
      setData(current => ({...current,historico:[saved,...current.historico]}));
      select('');
      setMessage('Conferência registrada no histórico.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <main className="cff">
    <h1>Controle de Faturamento Fiscal</h1>
    <p>Confira o saldo de um orçamento e registre as quantidades para revisão.</p>
    <button type="button" onClick={refresh} disabled={busy}>Atualizar</button>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={save}>
      <fieldset disabled={busy}>
        <legend>Conferir orçamento</legend>
        <label>Orçamento
          <select value={selected} onChange={event => select(event.target.value)} required>
            <option value="">Selecione…</option>
            {data.orcamentos.map(item => <option key={item.id} value={item.id}>{item.numero} · {item.cliente} · {item.data}</option>)}
          </select>
        </label>
        {budget && <>
          {budget.items.map(item => <label key={item.index}>{item.produto || item.produtoId} · saldo {item.quantidade}
            <input type="number" inputMode="numeric" min="0" max={item.quantidade} step="1" required
              value={quantities[item.index]} onChange={event => {
                const value = event.target.value;
                setQuantities(previous => previous.map((quantity,index) => index === item.index ? value : quantity));
              }} />
          </label>)}
          <label>Justificativa para diferença de quantidade
            <textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} />
          </label>
          <button type="submit">Registrar conferência</button>
        </>}
      </fieldset>
    </form>
    <section>
      <h2>Histórico</h2>
      {!data.historico.length && <p>Nenhuma conferência disponível.</p>}
      {data.historico.map(review => <article key={review.id}>
        <h3>{review.conferencia.numero} · {review.conferencia.cliente}</h3>
        <p>{new Date(review.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
        <ul>{review.conferencia.items.map(item => <li key={item.index}>{item.produto || item.produtoId} · {item.quantidadeConferida} de {item.quantidade}</li>)}</ul>
        {review.conferencia.justificativa && <p>{review.conferencia.justificativa}</p>}
        <button type="button" onClick={() => downloadReview(review)}>Exportar conferência</button>
      </article>)}
    </section>
  </main>;
}
