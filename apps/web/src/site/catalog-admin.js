import {photoNames} from './photos.js';

export function mountCatalogAdmin(host,client) {
  const controller = new AbortController();
  let products = [];
  let publications = new Map();

  const template = document.createElement('template');
  template.innerHTML = `<h2>Publicação de produtos</h2>
    <p>Selecione um produto ativo de revenda do FORTE VENDAS para editar sua publicação.</p>
    <button type="button" data-reload>Atualizar produtos</button>
    <p role="status" aria-live="polite"></p>
    <form><fieldset disabled>
      <label>Produto <select name="product" required></select></label>
      <label>Descrição pública <textarea name="description" maxlength="1000"></textarea></label>
      <label>Foto <select name="photo"><option value="">Sem foto</option></select></label>
      <img data-photo hidden alt="" width="96">
      <label><input type="checkbox" name="published"> Exibir no catálogo público</label>
      <button type="submit">Salvar publicação</button>
    </fieldset></form>`;
  host.replaceChildren(template.content);
  host.hidden = false;

  const form = host.querySelector('form');
  const fieldset = host.querySelector('fieldset');
  const status = host.querySelector('[role=status]');
  const reload = host.querySelector('[data-reload]');
  const {product,description,photo,published} = form.elements;
  const preview = host.querySelector('[data-photo]');
  for (const [id,label] of Object.entries(photoNames)) photo.add(new Option(label,id));

  function showPhoto() {
    preview.hidden = !photo.value;
    if (photo.value) preview.src = '/site-assets/products/produto-'+photo.value+'.webp';
    else preview.removeAttribute('src');
  }
  function select() {
    const entry = publications.get(product.value);
    description.value = entry?.descricao || '';
    photo.value = entry?.foto || '';
    published.checked = !!entry?.publicado;
    showPhoto();
  }
  async function invoke(body) {
    const {data,error} = await client.functions.invoke('site-catalogo',{body,signal:controller.signal});
    if (!error) return data;
    const detail = await error.context?.json?.().catch(() => null);
    throw Error(detail?.error || 'Não foi possível acessar o catálogo.');
  }
  function busy(active) {
    fieldset.disabled = active || !products.length;
    reload.disabled = active;
  }
  async function refresh() {
    busy(true);
    status.textContent = 'Carregando produtos…';
    try {
      const data = await invoke({acao:'LISTAR'});
      if (controller.signal.aborted) return;
      const selected = product.value;
      products = data.produtos;
      publications = new Map(data.publicacoes.map(entry => [entry.produto_id,entry]));
      product.replaceChildren(new Option('Selecione…',''),...products.map(item =>
        new Option([item.marca,item.nome,item.pesoKg ? item.pesoKg+' kg' : ''].filter(Boolean).join(' · '),item.id)));
      product.value = products.some(item => item.id === selected) ? selected : '';
      select();
      status.textContent = products.length ? '' : 'Nenhum produto de revenda disponível.';
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error.message;
    } finally {
      busy(false);
    }
  }
  product.onchange = select;
  photo.onchange = showPhoto;
  reload.onclick = refresh;
  form.onsubmit = async event => {
    event.preventDefault();
    if (!product.value || fieldset.disabled) return;
    busy(true);
    status.textContent = 'Salvando…';
    try {
      const {publicacao} = await invoke({
        acao:'SALVAR',produtoId:product.value,descricao:description.value,foto:photo.value,
        publicado:published.checked,versao:publications.get(product.value)?.versao,
      });
      if (controller.signal.aborted) return;
      publications.set(publicacao.produto_id,publicacao);
      status.textContent = publicacao.publicado ? 'Produto publicado.' : 'Produto fora do catálogo público.';
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error.message;
    } finally {
      busy(false);
    }
  };
  refresh();
  return () => {
    controller.abort();
    host.replaceChildren();
    host.hidden = true;
  };
}
