export const commercialAreas = [
  { id: 'venda-externa', label: 'Vendas Externas', href: '/venda-externa.html' },
  { id: 'carga-direta', label: 'Carga Direta', href: '/carga-direta.html' },
  { id: 'financeiro', label: 'Financeiro', href: '/financeiro.html' },
  { id: 'site', label: 'Administração do site', href: '/admin.html' },
];

export async function hasModuleAccess(client, id) {
  try {
    const { data, error } = await client.rpc('access_current_module', { p_app: id });
    return !error && data?.allowed === true;
  } catch {
    return false;
  }
}
