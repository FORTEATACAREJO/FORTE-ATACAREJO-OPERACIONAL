# FORTE ATENDE — portal operacional e marketing

## Escopo entregue nesta proposta

- Entrada web/PWA `/atende.html` com ícone e identidade FORTE ATENDE.
- Login por CPF/senha e validação de acesso já existentes no FORTE-OP; **não criar usuários paralelos**.
- Aba Mensagens reutiliza exatamente `WhatsappInbox.jsx` e o serviço `order-communications`: conversas, anexos, notas internas, atribuição e vínculos operacionais.
- Abas Campanhas / Programações: criação e revisão de textos comerciais, assunto de e-mail, modelo aprovado da Meta, segmento, canal, data/hora e status de planejamento.
- Contatos com preferência por canal e evidência do opt-in. Registro manual de bloqueio de WhatsApp/e-mail.
- Biblioteca de textos de apresentação da empresa, cimentos, argamassas, cal e novidades.
- Base própria `forte_atende_contacts` e `forte_atende_campaigns` no Supabase **OPERACIONAL** (RLS por empresa e perfil, inserção/edição por Admin/Master). Não altera dados de vendas ou FORTE FISCAL.

## Limites intencionais da primeira etapa

1. `PLANEJADA` não é mensagem enviada. O trabalhador de envio agendado não está habilitado; a tela declara essa limitação.
2. Não há envio massivo ativado. O número Meta (64) 99917-2700, WABA, Phone Number ID, token, endpoint e webhook permanecem intactos.
3. Não criar outras WABAs/números, nem substituir modelos/segredos. Confirmar o vínculo real de número e webhook antes de habilitar mensagens.
4. Marketing WhatsApp exige autorização de recebimento e modelo `MARKETING` aprovado pela Meta. Fora da janela de atendimento de 24h, não usar texto livre.
5. E-mail comercial será ativado somente depois de criar/verificar o remetente corporativo autorizado (preferência: contato@forteatacarejo.com.br), configurar autenticação do domínio e credencial do Gmail central. Não enviar marketing pela conta fiscal sem decisão.
6. Anexos PDF e disparos por lista ficam bloqueados até habilitação de armazenamento privado de mídia, modelo com cabeçalho documento, fila durável e rastreamento de entrega.
7. A lista de clientes existente não implica autorização de marketing. Cadastrar consentimento de forma independente, respeitar SAIR/opt-out e canal.
8. Programações de campanhas não criam tarefas recorrentes do ChatGPT: exigirão um worker próprio, com agendamento no servidor e fila idempotente.

## Próxima etapa antes da produção

- Validar a publicação atual do `forte-whatsapp-api` e `order-communications` e confirmar a entrega de webhook do número aprovado, sem mudar credenciais.
- Verificar permissões com um usuário Admin/Master real e um usuário sem permissão.
- Conectar a caixa de e-mail corporativo no Gmail central e implementar envio seguro com histórico.
- Criar fila `scheduled_messages`, motor com estados `PENDING/PROCESSING/ACCEPTED/FAILED/UNCERTAIN`, limites de envio, `command_id` idempotente e pausa global.
- Sincronizar modelos aprovados da Meta via API do servidor e resolver variáveis/idioma/cabeçalhos; habilitar somente templates de categoria apropriada.
- Implementar opt-out automático por mensagens recebidas (SAIR), supressão e provas de autorização.
- Testar destinatários de teste explicitamente autorizados em todos os canais (não disparar para clientes reais sem revisão).
- Executar compilação, testes de navegação desktop/mobile, RLS e prova de não envio automático.
- Publicar o portal como rota isolada no serviço existente FORTE-OP, sem alterar o webhook.

## Arquitetura

Frontend: `apps/web/atende.html`, `atende-main.jsx`, `ForteAtende.jsx`, `atende.css`.
Backend inbox existente: `order-communications`, `whatsapp_inbox_state`.
Backend novo da interface: duas tabelas RLS de contatos e planejamento. **Sem dispatcher**.
O FORTE FISCAL é independente e não é tocado.
