# FORTE-OP — Migração auditada (16/11/2026)

**Diretriz empresarial:** um único aplicativo operacional FORTE-OP, com Vendas, Vendas Externas, Carga Direta, Balcão, Compras, Cargas, Estoque, Pallets, Financeiro e Frete. FORTE FISCAL permanece sistema independente.

## Identidade e aplicativo
- Marca e título PWA: FORTE-OP.
- Ícone aprovado: SVG e PNG 180/192/512 no catálogo da interface.
- Acesso único por CPF/senha e autorizações existentes preservadas por módulo.
- Financeiro embutido com verificação específica do banco, sem outra tela de login.
- Vendas Externas, Carga Direta e Pátio expostos em área interna para usuários autorizados.
- Motoristas: cadastros antigos disponíveis para revisão, nunca ativados sem CNH/CPF/Pix/documentos completos.

## Bancos
- Origem histórica antiga do Frete: `nkynfboqwfxhhxcsrawl` (atualmente associada ao projeto FORTE-MC-6).
- Destino operacional: `gtwecfyffjszghnvtlzr`.
- `public.forte_op_frete_legado`: 103 registros e referências históricos, restritos a Master/Admin mediante RLS (incluindo 23 motoristas, vínculos, veículos, 5 rotas, metadados documentais, histórico de contas e eventos).
- `public.forte_op_frete_rotas`: 5 rotas ativas importadas com os IDs originais e acesso sob RLS.
- `public.fc_veiculos`: 2 veículos importados e desativados por falta de validação documental.
- `public.fc_motoristas`: 0 motoristas ativados por migração. Não inventar dados exigidos nem substituir documentos faltantes.
- Fonte e destino mantidos para conferência; sem exclusão, transferência destrutiva ou interrupção de operação.

## Arquivos
- Storage de origem: bucket privado `motorista-documentos` — 6 arquivos, total de 15.708.136 bytes.
- Referências dos 6 arquivos arquivadas no banco de destino.
- O bucket privado de destino `forte-op-frete-documentos` foi preparado, mas a cópia física dos arquivos foi bloqueada pela integração. Continua vazio; não afirmar migração de bytes.
- A função temporária de recebimento foi desativada imediatamente após a tentativa não concluída e exige JWT para devolver HTTP 410.
- Uma referência de chave Pix foi preservada **sem a chave**; requer cadastro e validação por usuário habilitado.

## Usuários
- Origem: 4 contas aprovadas (2 Master, 1 Motorista, 1 Operador Geral).
- Destino: 3 contas aprovadas (1 Master, 1 Operador Geral, 1 Vendedor Interno).
- Conferência por hash temporário do CPF: duas identidades coincidentes; dois perfis sem correspondência (1 Master, 1 Motorista).
- Não importar senhas, sessões, tokens nem inscrições estaduais ou dados de acesso por SQL. Regularizar identidades e aceite legal antes de conceder novo perfil.

## Homologação e segurança
- Publicação Render web: compilação de `921061df355f694e5a8f3d7a74c73f09ab271286`, estado **Live**, 267 testes aprovados e 0 reprovados.
- Testes RLS: sem sessão autenticada não é possível consultar tabelas de motoristas, veículos ou histórico restrito.
- Rotas da migração no menu interno do Frete.
- Pendentes: arquivos físicos, revalidação de Pix, validação dos 23 motoristas e 2 veículos, reconciliação das 2 identidades, teste ponta a ponta com usuários reais.
- Pendentes de administração: renomear repositório GitHub `FORTE-ATACAREJO-OPERACIONAL` para `FORTE-OP` e serviço/slug Render `forte-vendas` para `forte-op`; as integrações disponíveis não possuem operações de renomeação. Não criar segundo serviço pago/duplicado.
- O antigo serviço `forte-frete.onrender.com` continua existente e **não deve ser desligado** até transferir os arquivos e conciliar os usuários.
- Existem dependências com avisos de vulnerabilidade no npm audit; tratar antes de declarar homologação de segurança 100%.

**Critério de conclusão:** nem deploy Live nem testes unitários isolados equivalem a migração 100% de dados/autenticação/arquivos; só declarar após confrontar origem e destino e homologar os perfis.
