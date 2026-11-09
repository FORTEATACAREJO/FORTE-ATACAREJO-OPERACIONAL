// Inventario estatico da auditoria de 2026-11-09.
// Nao consulta banco, Auth, Storage nem dispara deploy.
export const AUDITORIA_CONSOLIDACAO = Object.freeze({
  data: '2026-11-09',
  repositorios: [
    {nome: 'FORTE-VENDAS', papel: 'base_operacional', visibilidade: 'publica', leituraNestaSessao: true, sha: 'df5d018148846a3c3bb485e2c1f83df1afec75be', branch: 'chore/cursor-mcp-forte-20261109'},
    {nome: 'FORTEFISCAL', papel: 'definitivo_independente', visibilidade: 'nao_visivel_para_este_agente', leituraNestaSessao: false, sha: null, branch: null},
    {nome: 'FORTE-FRETE', papel: 'legado', visibilidade: 'publica', leituraNestaSessao: true, sha: '3162c0086feb4bfe4957f40d23c33b9ab34b5e91', branch: 'main'},
    {nome: 'FORTE-FINANCEIRO', papel: 'legado', visibilidade: 'nao_visivel_para_este_agente', leituraNestaSessao: false, sha: null, branch: null},
    {nome: 'FORTE-VENDA-EXTERNA', papel: 'legado', visibilidade: 'publica', leituraNestaSessao: true, sha: 'f58199737f944bba94bcf5f615a4b312531adf18', branch: 'main'},
    {nome: 'FORTE-CARGA-DIRETA', papel: 'legado', visibilidade: 'publica', leituraNestaSessao: true, sha: 'de14ad6124452bccf265409192158a08d9f7f351', branch: 'main'},
    {nome: 'SITE-FORTE-ATACAREJO', papel: 'legado', visibilidade: 'publica', leituraNestaSessao: true, sha: 'f5324638ecfa4131f37712680d58350c47971e94', branch: 'main'},
  ],
  modulos: [
    {
      id: 'frete-motorista',
      repositorio: 'FORTE-FRETE',
      status: 'parcial',
      destino: ['apps/web/src/DriverDirectory.jsx', 'apps/web/src/FreteRequestsPanel.jsx', 'integrations/forte-frete/vendas-frete-bridge/directory.mjs', 'supabase/functions/sync-frete-drivers/index.ts', 'tools/migracao-frete/normalizar-legado.mjs', 'tools/migracao-frete/plano-importacao.mjs'],
      urlAtual: 'https://forte-frete.onrender.com',
      banco: 'projeto Frete separado; destino futuro e o banco operacional, sem copia executada',
      authStorage: 'usuarios_app, documentos_motorista e buckets permanecem no legado ate backup restauravel',
      testes: ['checks/migracao-frete.test.mjs', 'checks/plano-importacao-frete.test.mjs', 'checks/frete-sync.test.mjs'],
      lacuna: 'App movel, iOS, Android e funcoes de viagem/onboarding do repositorio Frete nao foram absorvidos. A sincronizacao atual grava em fc_app_state e nao e o importador de corte.',
    },
    {
      id: 'financeiro',
      repositorio: 'FORTE-FINANCEIRO',
      status: 'bloqueado',
      destino: ['apps/web/src/FinanceiroHub.jsx', 'apps/web/src/financeiro-portal/Portal.jsx', 'supabase/functions/integration-vault/index.ts'],
      urlAtual: 'https://forte-financeiro.onrender.com',
      banco: 'nao comparado; o repositorio privado nao ficou visivel para este agente',
      authStorage: 'nao auditado no codigo legado nesta sessao',
      testes: ['tests/financeiro-master.test.cjs', 'tests/financeiro-projection.test.cjs'],
      lacuna: 'Ha portal financeiro no operacional, sem prova de paridade com o legado.',
    },
    {
      id: 'venda-externa',
      repositorio: 'FORTE-VENDA-EXTERNA',
      status: 'parcial',
      destino: ['supabase/functions/mobile-vendas-externas/index.ts', 'apps/web/src/HomeCompactV47.jsx'],
      urlAtual: 'https://forte-venda-externa.onrender.com',
      banco: 'a funcao movel ja esta no operacional; o cliente publicado continua no repositorio legado',
      authStorage: 'login por CPF via login-cpf e recover-password-email, sem migrar usuarios nesta etapa',
      testes: ['checks/home-shortcuts.test.cjs'],
      lacuna: 'A PWA tem atalho interno. O aplicativo movel de orcamentos e comissoes ainda e o frontend legado.',
    },
    {
      id: 'carga-direta',
      repositorio: 'FORTE-CARGA-DIRETA',
      status: 'parcial',
      destino: ['supabase/functions/mobile-carga-direta/index.ts', 'apps/web/src/VendasDiretasPanel.jsx', 'checks/mobile-carga-direta.test.cjs'],
      urlAtual: 'https://forte-carga-direta.onrender.com',
      banco: 'pedidos e cargas seguem o estado operacional; o cliente movel legado continua publicado',
      authStorage: 'sem novo provedor de identidade',
      testes: ['checks/mobile-carga-direta.test.cjs'],
      lacuna: 'Vendas, compras, cargas e aprovacoes do app legado ainda nao sao uma tela unica da PWA.',
    },
    {
      id: 'site',
      repositorio: 'SITE-FORTE-ATACAREJO',
      status: 'parcial',
      destino: ['apps/web/public/site/index.html'],
      urlAtual: 'https://site-forte-atacarejo.onrender.com',
      banco: 'institucional estatico; recuperacao de senha do admin depende do Auth do site',
      authStorage: 'admin.html e recover-site-password permanecem no legado; o retorno de recuperacao aponta para o dominio antigo',
      testes: ['checks/unificacao-identidade.test.mjs', 'checks/home-shortcuts.test.cjs'],
      lacuna: 'Catalogo publico incorporado na PR #57. Administracao, Central de aplicativos e redirecionamento de Auth nao migrados.',
    },
  ],
  render: {
    workspaceId: 'tea-daoniurm8hqs73fsi3p0',
    consultadoEm: '2026-11-09',
    modo: 'leitura',
    servicos: [
      {nome: 'forte-itau-api', id: 'srv-dat67rrtqb8s739uc6f0', tipo: 'web_service', repositorio: 'FORTE-VENDAS', branch: 'main', autoDeploy: true, url: 'https://forte-itau-api.onrender.com', corte: 'api_separada', nota: 'API bancaria. Permanece servico proprio.'},
      {nome: 'forte-whatsapp-api', id: 'srv-db7835l9fdbs73d7js10', tipo: 'web_service', repositorio: 'FORTE-VENDAS', branch: 'fix/whatsapp-webhook-signature-20261013', autoDeploy: false, url: 'https://forte-whatsapp-api.onrender.com', corte: 'api_separada', nota: 'Webhook. Nao acompanha a main automaticamente.'},
      {nome: 'forte-vendas-app', id: 'srv-daufq2dg1s2s73cp72jg', tipo: 'web_service', repositorio: 'FORTE-VENDAS', branch: 'main', autoDeploy: true, url: 'https://forte-vendas-app.onrender.com', corte: 'api_separada', nota: 'Processo Node com o mesmo comando publicado da API Itau. Nao desligar junto do frontend.'},
      {nome: 'forte-vendas', id: 'srv-daq10dbncjis73946ge0', tipo: 'static_site', repositorio: 'FORTE-VENDAS', branch: 'main', autoDeploy: true, url: 'https://forte-vendas.onrender.com', corte: 'frontend_operacional', nota: 'PWA que recebe os modulos. Auto deploy da main segue ativo.'},
      {nome: 'forte-financeiro', id: 'srv-dau3ahtg1s2s73b9q6jg', tipo: 'static_site', repositorio: 'FORTE-FINANCEIRO', branch: 'main', autoDeploy: true, url: 'https://forte-financeiro.onrender.com', corte: 'frontend_legado', nota: 'Pagina pode ir ao dominio operacional somente apos corte homologado.'},
      {nome: 'forte-venda-externa', id: 'srv-dau2vhvavr4c73ffp5jg', tipo: 'static_site', repositorio: 'FORTE-VENDA-EXTERNA', branch: 'main', autoDeploy: true, url: 'https://forte-venda-externa.onrender.com', corte: 'frontend_legado', nota: 'Frontend legado. Desligamento somente depois do corte.'},
      {nome: 'forte-carga-direta', id: 'srv-dau2vhdg1s2s73b8greg', tipo: 'static_site', repositorio: 'FORTE-CARGA-DIRETA', branch: 'main', autoDeploy: true, url: 'https://forte-carga-direta.onrender.com', corte: 'frontend_legado', nota: 'Frontend legado. Desligamento somente depois do corte.'},
      {nome: 'forte-frete', id: 'srv-daq1cbh7lnhs739fitl0', tipo: 'static_site', repositorio: 'FORTE-FRETE', branch: 'main', autoDeploy: true, url: 'https://forte-frete.onrender.com', corte: 'frontend_legado', nota: 'Frontend legado. O banco Frete continua ativo.'},
      {nome: 'site-forte-atacarejo', id: 'srv-darce5jtqb8s73eurm9g', tipo: 'static_site', repositorio: 'SITE-FORTE-ATACAREJO', branch: 'main', autoDeploy: true, url: 'https://site-forte-atacarejo.onrender.com', corte: 'frontend_legado', nota: 'Site, admin e Central. URL antiga permanece ate o redirecionamento aprovado.'},
      {nome: 'forte-fiscal', id: 'srv-daoo5cqd0e5s73fo19fg', tipo: 'web_service', repositorio: 'FORTEFISCAL', branch: 'main', autoDeploy: true, url: 'https://forte-fiscal.onrender.com', corte: 'fiscal_independente', nota: 'Emissao e banco proprios. Fora do corte operacional.'},
      {nome: 'forte-fiscal-pr91-homologacao', id: 'srv-dbm5ibjm8hqs73eq1pjg', tipo: 'web_service', repositorio: 'FORTEFISCAL', branch: 'spec/parametrizacao-legal-mg-go-20261104', autoDeploy: false, url: 'https://forte-fiscal-pr91-homologacao.onrender.com', corte: 'fiscal_independente', nota: 'Homologacao fiscal. Nao entra no desligamento dos legados comerciais.'},
    ],
  },
  supabase: {
    consultaVivaNestaSessao: false,
    motivo: 'O MCP Supabase desta sessao e o generico da organizacao e possui escrita. A sessao read-only do projeto operacional nao estava isolada aqui.',
    projectRefOperacional: 'gtwecfyffjszghnvtlzr',
    partidaFrete: {motoristas: 23, veiculos_motorista: 2, rotas: 5, documentos_motorista: 1, usuarios_app: 4},
    partidaEhAceite: false,
    fiscalIndependente: true,
    bancosEmpresariaisAlvo: ['operacional', 'fiscal'],
  },
  bloqueios: [
    {id: 'github-privado-financeiro-fiscal', autorizacao: 'Conceder ao agente leitura dos repositorios privados FORTE-FINANCEIRO e FORTEFISCAL.', efeito: 'O codigo desses dois repositorios nao foi comparado nesta sessao.'},
    {id: 'mcp-supabase-operacional', autorizacao: 'Autenticar somente o MCP Supabase com project_ref=gtwecfyffjszghnvtlzr e read_only=true, e provar que Fiscal e Frete nao aparecem.', efeito: 'Contagens, Auth, Storage e Edge Functions nao foram relidos ao vivo.'},
    {id: 'privacidade-github-e-mc6', autorizacao: 'Tornar FORTE-VENDAS privado e criar o repositorio FORTE MC-6 ja privado.', efeito: 'Nenhum CAD, segredo ou documento interno foi adicionado.'},
    {id: 'auth-redirect-site', autorizacao: 'Aprovar a troca dos Redirect URLs do Auth do site antes de mover a administracao.', efeito: 'admin.html e a recuperacao de senha continuam no dominio legado.'},
    {id: 'corte-producao', autorizacao: 'Aceite especifico para backup restauravel, merge em main, deploy, RLS, Auth, Storage, dominio, OAuth e desligamento.', efeito: 'Nenhum servico, banco ou repositorio foi alterado.'},
  ],
  mc6: {criado: false, visibilidadeExigida: 'privada', cadPublicado: false},
});

export function servicosPorCorte(corte) {
  return AUDITORIA_CONSOLIDACAO.render.servicos.filter(servico => servico.corte === corte);
}

export function servicosQuePodemDesligarAgora() {
  return AUDITORIA_CONSOLIDACAO.render.servicos.filter(servico => servico.corte === 'desligar_agora');
}
