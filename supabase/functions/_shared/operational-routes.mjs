const routes = new Map([
  ['vendas', '/'],
  ['financeiro', '/financeiro.html'],
  ['venda-externa', '/venda-externa.html'],
  ['carga-direta', '/carga-direta.html'],
  ['site', '/admin.html'],
]);

export function operationalModule(originModule, requested) {
  if (originModule === 'vendas' && routes.has(requested)) return requested;
  return requested === undefined || requested === originModule ? originModule : undefined;
}

export function operationalRoute(module) {
  return routes.get(module);
}
