# SISTEMAS FORTE TECH — Domínio oficial

**Domínio pretendido:** `sistemasfortetech.com.br`
**Endereço atual confirmado do site:** https://sistemas-forte-tech.onrender.com/
**Serviço Render:** `sistemas-forte-tech`, static-site `srv-dbqvomkipgvc73cv224g`, workspace `tea-daoniurm8hqs73fsi3p0`
**Situação:** aplicação preparada, **domínio pendente de inclusão no Render, verificação DNS e emissão TLS**. Não declarar o domínio como ativo antes de testar HTTPS.

## 1. Configuração no Render
1. Acessar https://dashboard.render.com/static/srv-dbqvomkipgvc73cv224g
2. Settings > Custom Domains > Add Custom Domain.
3. Adicionar o domínio raiz `sistemasfortetech.com.br`. O Render normalmente adiciona `www.sistemasfortetech.com.br` automaticamente, redirecionando-o para o domínio raiz.
4. Anotar os valores de DNS mostrados na interface; prevalecem sobre exemplos abaixo.
5. Depois de configurar DNS, usar **Verify** e aguardar certificado TLS válido (HTTPS).
6. Manter o domínio atual `sistemas-forte-tech.onrender.com` funcional durante o corte.

**ATENÇÃO:** O conector Render conectado neste ambiente só oferece operações de consulta de serviços/deploys e criação de serviços, **não** a operação de adicionar/validar domínio personalizado. Essa etapa necessita do Dashboard ou de uma integração autorizada equivalente.

## 2. DNS da zona sistemasfortetech.com.br
Os registros abaixo são os recomendados oficialmente para provedores que NÃO usam Cloudflare Proxy e NÃO oferecem ALIAS/ANAME ou CNAME flattening no ápice.

| Tipo | Host/nome | Conteúdo |
|------|-----------|----------|
| A | `@` | `216.24.57.1` |
| CNAME | `www` | `sistemas-forte-tech.onrender.com` |

Alternativa para zona raiz com ANAME/ALIAS: criar `@` apontando a `sistemas-forte-tech.onrender.com` conforme compatibilidade do provedor, em vez de A.

Se usar **Cloudflare**, seguir o procedimento específico do Render para Cloudflare em https://render.com/docs/configure-cloudflare-dns, pois a orientação geral do A pode ser diferente.

- Evitar outros A/AAAA/redirects conflitantes nos hosts do site; Render não usa AAAA para o domínio personalizado.
- **Não apagar MX, SPF, DKIM, DMARC, TXT de e-mail, verificações de outros serviços ou registros DNS não relacionados.**
- Não mudar nameservers de toda a zona sem necessidade; isso pode interromper e-mails e serviços.
- Confirmar antes o registrante e o provedor DNS, que **ainda não foram verificados**.

Fontes:
https://render.com/docs/custom-domains
https://render.com/docs/configure-other-dns

## 3. Identidade do site e Supabase Auth
**Depois que o novo domínio estiver funcionando em HTTPS**:
- Supabase projeto `tusmlfhzwlzwnoxfhomt`: https://supabase.com/dashboard/project/tusmlfhzwlzwnoxfhomt/auth/url-configuration
- Registrar Redirect URLs **exatas**:
  - `https://sistemasfortetech.com.br/admin.html`
  - `https://sistemas-forte-tech.onrender.com/admin.html` (fallback na migração)
  - `https://www.sistemasfortetech.com.br/admin.html` somente se for utilizado diretamente antes do redirecionamento `www`.
- Alterar Site URL para `https://sistemasfortetech.com.br` **apenas quando HTTPS estiver estável e a autenticação testada**.
- Testar link por e-mail/OTP, retorno, renovar token, convite CONTADOR, cadastro de empresa e logout.
- Não habilitar permissão sem credenciais e não alterar nenhuma política fiscal ou de licença por causa do domínio.

Referência:
https://supabase.com/docs/guides/auth/redirect-urls

## 4. Cobrança com cartão — ambiente de homologação
- A função `sft-billing-asaas-sandbox`, versão 3, aceita somente as origens exatas:
  - `https://sistemas-forte-tech.onrender.com`
  - `https://sistemasfortetech.com.br`
  - `https://www.sistemasfortetech.com.br`
- Quando um checkout for iniciado por um desses hosts, o callback do Asaas devolve para aquele **mesmo host**. Nenhuma origem arbitrária é aceita no CORS/checkout.
- O Asaas ainda não possui credenciais configuradas; **não há cobranças reais nem sandbox end-to-end homologado**.
- Webhook Supabase continua em endpoint próprio e exige token; ele não precisa se mover para o domínio público.

## 5. Critérios para declarar o domínio ativo
- [ ] Domínio realmente registrado pelo titular autorizado e DNS/registrador identificados.
- [ ] Domínio raiz cadastrado no serviço Render correto.
- [ ] DNS A/ALIAS e `www` apontando para Render; sem registros conflitantes.
- [ ] Render informa **Verified** e certificado TLS válido.
- [ ] `https://sistemasfortetech.com.br/` abre o site correto.
- [ ] `https://sistemasfortetech.com.br/admin.html` abre tela de login.
- [ ] OTP do Supabase retorna para o host novo.
- [ ] Sem alteração ou perda de registros de e-mail.
- [ ] URL no Asaas Sandbox conferida para callback e regras de CORS, após receber credenciais.
- [ ] Atualizar links institucionais e SEO/canonical somente depois do corte real.

**Estado atual:** código preparado; ligação do domínio e validação da propriedade não efetuadas nem verificadas.
