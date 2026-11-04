const list = document.getElementById('catalog-products');
const status = document.getElementById('catalog-status');
const empty = document.getElementById('brandEmpty');
const filters = [...document.querySelectorAll('.brand-filter')];

function brandKey(brand) {
  const text = brand.toLowerCase();
  if (text.includes('nacional') || text.includes('campe')) return 'nacional';
  if (text.includes('tocantins')) return 'votorantim';
  return ['ciplan','csn','liz','votorantim'].find(key => text.includes(key)) || 'other';
}

let selected = 'all';
function applyFilter(brand) {
  selected = brand;
  let visible = 0;
  for (const card of list.children) {
    card.hidden = brand !== 'all' && card.dataset.brand !== brand;
    if (!card.hidden) visible++;
  }
  for (const filter of filters) {
    const active = filter.dataset.brand === brand;
    filter.classList.toggle('active',active);
    filter.setAttribute('aria-pressed',String(active));
  }
  empty.hidden = visible > 0 || !!status.textContent;
}

function element(tag,text,className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function cardFor(product) {
  const card = element('article','','card');
  card.dataset.brand = brandKey(product.marca);
  if (/^(0[1-9]|1[0-4])$/.test(product.foto || '')) {
    const photo = element('div','','pic');
    const image = document.createElement('img');
    image.src = '/site-assets/products/produto-'+product.foto+'.webp';
    image.alt = product.nome;
    image.loading = 'lazy';
    photo.append(image);
    card.append(photo);
  }
  const info = element('div','','info');
  const pack = product.pesoKg ? new Intl.NumberFormat('pt-BR').format(product.pesoKg)+' kg' : '';
  info.append(element('span',product.marca,'brandtag'),element('h3',product.nome));
  if (pack) info.append(element('div',pack,'pack'));
  if (product.descricao) info.append(element('p',product.descricao));
  const quote = element('a','SOLICITAR ORÇAMENTO','btn');
  quote.href = '#orcamento';
  quote.onclick = () => { document.getElementById('qProduto').value = [product.nome,pack].filter(Boolean).join(' - '); };
  info.append(quote);
  card.append(info);
  return card;
}

for (const filter of filters) filter.onclick = () => applyFilter(filter.dataset.brand);
for (const brand of document.querySelectorAll('.brand-jump')) {
  brand.onclick = () => {
    applyFilter(brand.dataset.brand);
    document.getElementById('produtos').scrollIntoView({behavior:'smooth'});
  };
}

async function load() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw Error('Configuração indisponível');
    const response = await fetch(new URL('/functions/v1/site-catalogo',url),{
      headers:{apikey:key},credentials:'omit',signal:AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error('Catálogo indisponível');
    const {produtos} = await response.json();
    list.replaceChildren(...produtos.map(cardFor));
    status.textContent = produtos.length ? '' : 'Consulte os produtos disponíveis pelo formulário de orçamento.';
    applyFilter(selected);
  } catch {
    status.textContent = 'Catálogo indisponível no momento. Solicite um orçamento para consultar os produtos.';
  }
}
load();
