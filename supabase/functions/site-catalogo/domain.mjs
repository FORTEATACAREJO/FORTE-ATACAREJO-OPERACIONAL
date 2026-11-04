import {isResaleProduct} from '../orders-workflow/supplier-catalog.mjs';

export function resaleProducts(products) {
  return (products || []).filter(product => {
    if (!isResaleProduct(product) || !product.id || !product.nome) return false;
    const purpose = product.finalidade || product.purpose || product.tipoProduto || product.classificacao || product.destinacao;
    return purpose ? String(purpose).trim().toUpperCase() === 'REVENDA' : product.revenda === true;
  });
}

export function catalogProduct(product, listing = {}) {
  const weight = Number(product.pesoKg);
  return {
    nome: String(product.nome),
    marca: String(product.marca || ''),
    pesoKg: Number.isFinite(weight) && weight > 0 ? weight : null,
    descricao: listing.descricao || '',
    foto: listing.foto || null,
  };
}

export function publicCatalog(products, listings) {
  const published = new Map(listings.filter(item => item.publicado).map(item => [item.produto_id,item]));
  return resaleProducts(products).filter(product => published.has(product.id))
    .map(product => catalogProduct(product,published.get(product.id)));
}

export function publicationInput(body) {
  const description = typeof body.descricao === 'string' ? body.descricao.trim() : '';
  const photo = body.foto === '' || body.foto == null ? null : body.foto;
  if (typeof body.publicado !== 'boolean' || description.length > 1000 ||
      (photo !== null && (typeof photo !== 'string' || !/^(0[1-9]|1[0-4])$/.test(photo)))) {
    throw Error('Informe a publicação, uma descrição de até 1.000 caracteres e uma foto da galeria.');
  }
  return {publicado:body.publicado,descricao:description,foto:photo};
}
