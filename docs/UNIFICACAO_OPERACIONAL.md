# Unificação operacional FORTE

## Primeira etapa

O FORTE VENDAS compila Vendas Externas em `/venda-externa.html` e Carga Direta em `/carga-direta.html`. As telas foram incorporadas dos repositórios FORTE-VENDA-EXTERNA (`f581997`) e FORTE-CARGA-DIRETA (`de14ad6`). Usam o cliente Supabase, a sessão e a aprovação por módulo do FORTE VENDAS. Os atalhos internos dependem da autorização retornada pelo servidor. A triagem de propostas, o Painel de Cargas, o Financeiro interno e as regras de orçamento e caixa continuam usando seus fluxos atuais.

As duas telas usam as funções `mobile-vendas-externas` e `mobile-carga-direta` do FORTE VENDAS. A API de Vendas Externas passa a verificar a versão do estado antes de confirmar a gravação da proposta. O service worker conserva as notificações e remove seus caches antigos de respostas para evitar persistência de páginas e respostas de operação no cache do navegador.

## Inventário em 4 de novembro de 2026

- GitHub tem seis repositórios operacionais para Vendas, Frete, Financeiro, Venda Externa, Carga Direta e site. Os cinco repositórios públicos operacionais foram inspecionados. O repositório separado do Financeiro é privado.
- Render tem nove serviços operacionais ativos. Quatro usam o repositório FORTE-VENDAS, incluindo o WhatsApp em branch própria e o Itaú. Vendas tem dois serviços com nomes diferentes. A responsabilidade de cada URL, webhook, integração e configuração deve ser confirmada antes de propor desligamentos.
- O Supabase do FORTE VENDAS guarda o estado operacional, orçamentos, reservas, pagamentos, cargas, projeções e os dados das integrações comerciais. O Supabase do FORTE FRETE tem cadastro, documentos, veículos, vínculos, viagens e aceites próprios. O catálogo de tabelas foi consultado sem ler linhas de clientes ou motoristas. A presença de RLS nas tabelas observadas não comprova a correção das políticas.
- O site público existente tem catálogo estático e orçamento encaminhado por WhatsApp. Sua área administrativa atual usa o mesmo projeto Supabase de Vendas e apresenta links de conferência do conteúdo. A publicação de conteúdo pelo painel e a origem do catálogo no cadastro de revenda exigem implementação adicional.

## Antes da virada

1. Confirmar backups restauráveis de Vendas e Frete em ambiente isolado. Inventariar Auth, Storage, funções e configurações além do banco. Comparar contagens por entidade, testar vínculos e conferir integridade dos anexos por checksum. Registrar local de guarda, horário e resultado da restauração.
2. Homologar os dois novos endereços com os perfis autorizados, recusados e revogados. Verificar retomada de sessão e recuperação por e-mail/WhatsApp, principalmente URLs de retorno, convites e notificações. Validar pedidos, compra, carga, proposta, triagem, orçamento com reserva e baixa parcial. Repetir em Android e iPhone.
3. Consolidar Frete e site em etapas posteriores. Associar identidades existentes por identificador verificado, reconciliar divergências antes de gravar, validar objetos privados e manter os legados disponíveis durante a homologação. O CFF fica restrito à solicitação opcional e auditável, por interface separada do FORTE FISCAL.
4. Para o primeiro deploy homologado, publicar o build e a versão correspondente de `mobile-vendas-externas` em homologação. Em caso de regressão no frontend, restaurar o artefato anterior. Preservar os endereços e serviços existentes até a validação e aprovação da virada.

O FORTE FISCAL permanece fora desta branch. Nenhuma migração de produção é necessária para compilar esta etapa.
