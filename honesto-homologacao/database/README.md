# Nanapay — implantação segura da prioridade 1 (16/11/2026)

## Estado desta entrega

**Preparado e testado no GitHub, mas banco real NÃO provisionado.** Esta versão preserva a demonstração isolada existente. Não cria contas ou assinaturas pagas, nem altera as bases de FORTE FISCAL, FORTE-OP, MC-6 ou CFOP.

### Incluído
- `001_nanapay_isolated_schema.sql`: esquema PostgreSQL exclusivo com 11 tabelas, identidade de cada restaurante, contas, convidados, garçons, lançamentos, pedidos, devoluções, pagamentos, auditoria e status da licença.
- RLS em todas as tabelas e **nenhum acesso direto** para `anon` e `authenticated` pela Data API.
- Relacionamentos compostos por restaurante + comanda, impedindo associação cruzada de clientes, itens e pagamentos.
- Registros de cobrança restritos a referências do gateway; **nenhum dado bruto de cartão**.
- `identity.mjs`: biblioteca **somente para servidor**, valida o token com Supabase Auth e consulta a associação ativa e o papel `admin`/`garcom` no restaurante correto. Não confia em papéis vindos do navegador.
- `test-tenant-security.sql` e `tests/identity.mjs`: testes de isolamento, privilégios, papéis, revogação e falhas seguras.
- Workflow `.github/workflows/nanapay-database.yml`: verifica a migração **em PostgreSQL local isolado do GitHub Actions**, sem abrir conexão com bancos empresariais.

### Não incluído / não liberado
- **Banco permanente conectado ao Render**: faltam projeto exclusivo Nanapay e credenciais.
- **Login comercial e autenticação real**: requer configurar Supabase Auth (email e MFA/política de recuperação) no projeto do Nanapay. O painel de demonstração atual continua usando credenciais temporárias.
- **Restauração real de sessões após reinício e múltiplas instâncias**: requer implementar repositório PostgreSQL e transações atômicas no backend após provisionamento.
- **Integração de PDV real**: pendente de credenciais, homologação e confirmação de eventos pelo fornecedor.
- **Pagamento de licença**: R$ 4,99/mês planejado, sem cobrança ativa e sem coletar cartão.

### Custos e autorização
A organização Supabase **FORTE ATACAREJO**, plano Pro, apresentou em 16/11/2026 um custo adicional de **US$ 10 por mês** para abrir um projeto novo. Não foi criado projeto devido à restrição de não contratar serviços sem aprovação expressa. As migrações estão prontas, porém não foram executadas em nenhum banco existente.

### Checklist para a ativação futura
1. Obter aprovação de custo ou selecionar infraestrutura exclusiva que não gere despesa adicional.
2. Criar banco/projeto exclusivo, aplicar a migração e executar as verificações de RLS e integridade.
3. Criar usuários no Auth e associar `auth.users.id` à tabela `nanapay_staff` por restaurante.
4. Configurar segredo Supabase somente no Render, usando variável protegida — nunca no GitHub, HTML ou navegador.
5. Implementar leitura/escrita transacional no servidor e migrar estados de comanda para o banco.
6. Adicionar testes de reinício, sessão, concorrência, IDOR, conta quitada, múltiplos restaurantes e reprocessamento idempotente.
7. Somente após evidências, habilitar produção real; manter coberturas de pagamento e PDV desativadas até homologação específica.

**Observação:** não usar a rota pública de demonstração `/api/pdv-demo/create` como cadastro comercial. Deve ser desabilitada no modo produção. O garçom não aprova devoluções dentro do Nanapay; o PDV existente do restaurante continua sendo a única fonte autorizada de decisão.
