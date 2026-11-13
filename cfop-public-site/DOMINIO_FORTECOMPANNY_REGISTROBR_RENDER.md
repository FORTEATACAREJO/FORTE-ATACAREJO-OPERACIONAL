# FORTECOMPANNY — ativação do domínio fortecompanny.com.br

**Data:** 13/11/2026  
**Status:** DOMÍNIO REGISTRADO; DNS DO APLICATIVO AINDA PENDENTE; HTTPS AINDA NÃO CONFIRMADO  
**Ações autorizadas:** preparar domínio e configurações técnicas; **nenhuma nova cobrança nem contratação**.

## Onde está cada serviço

- Domínio: `fortecompanny.com.br`, com zona DNS administrada pelo **Registro.br**, servidores `a.auto.dns.br` e `b.auto.dns.br`. A consulta RDAP foi HTTP 200 em 13/11/2026.
- Site Render existente: `forte-tech-cfop-publico`, serviço `srv-dbquodbrjlhs73cg02ig`, workspace `tea-daoniurm8hqs73fsi3p0`.
- Render dashboard: https://dashboard.render.com/static/srv-dbquodbrjlhs73cg02ig
- URL atual funcionando: https://forte-tech-cfop-publico.onrender.com
- Código: GitHub `FORTEATACAREJO/FORTE-ATACAREJO-OPERACIONAL`, branch `deploy/forte-tech-cfop-publico-20261112`, diretório `cfop-public-site/`.
- Supabase dedicado: `yzsxtgmasssoflgqhizm`.

## Verificação inicial

- O domínio estava registrado e delegava para o serviço DNS do Registro.br, com DNSSEC.
- Consultas DNS públicas: **sem registro A no domínio raiz**, **sem CNAME para www**. Isso significa que o app ainda não abre no domínio desejado.
- Painel do Render confirma URL atual `https://forte-tech-cfop-publico.onrender.com` e publicação estável. Ainda não foi confirmado Custom Domain no Render.
- As Edge Functions `consulta-cfop` versão 7 e `cfop-cadastros` versão 3 foram modificadas para aceitar origens HTTPS do domínio raiz e `www`, além do antigo `onrender.com`; testadas com OPTIONS HTTP **204** em todas as três origens, e **403** para origem não autorizada.
- A função pública de NCM/CEST permanece independente e não requer alterações.

## Configuração necessária (na ordem)

### 1. Render

1. Entrar em https://dashboard.render.com/static/srv-dbquodbrjlhs73cg02ig.
2. Abrir **Settings → Custom Domains** e incluir `fortecompanny.com.br` e `www.fortecompanny.com.br`. Antes de adicionar, **conferir a franquia de domínios do plano**; não confirmar qualquer cobrança ou upgrade sem autorização do titular.
3. Não desativar a URL `onrender.com`.
4. Se o Render oferecer valores DNS específicos durante a associação, priorizar os valores exibidos no serviço e verificar com a documentação oficial abaixo.

### 2. Registro.br

1. Acessar https://registro.br com as credenciais do titular e escolher o domínio `fortecompanny.com.br`.
2. Abrir **DNS → Configurar zona DNS → Modo avançado**, mantendo o DNS no Registro.br.
3. Criar ou alterar **somente**:

| Tipo | Nome/host | Destino |
|---|---|---|
| A | vazio (raiz do domínio / `@` se aceito na interface) | `216.24.57.1` |
| CNAME | `www` | `forte-tech-cfop-publico.onrender.com` |

4. Remover somente registros A/AAAA/CNAME **conflitantes** desses dois hosts, se existirem. **Preservar** NS, SOA, MX, TXT/SPF/DKIM/DMARC e DNSSEC, pois podem servir e-mail e outros serviços.
5. Salvar a zona DNS e verificar a propagação por consultas DNS A e CNAME. DNS leva tempo para se propagar.

### 3. Render — validação

1. Voltar em **Settings → Custom Domains** e usar **Verify**, em cada domínio necessário.
2. Confirmar emissão automática de TLS/HTTPS e carregamento sem alerta de certificado nos endereços:
   - `https://fortecompanny.com.br`
   - `https://www.fortecompanny.com.br`
3. Testar páginas `/`, `/assistente.html`, `/manifest.json`, `/icon.svg`, bem como operações CNPJ e busca NCM/CEST.
4. Confirmar que o app instalado no Android recebe a atualização. Se necessário, reinstalar o PWA depois de ativar o domínio. Não publicar redirecionamento obrigatório para um domínio que ainda não passou no teste de HTTPS.

## Referências oficiais

- Render, Custom Domains: https://render.com/docs/custom-domains
- Render, DNS Providers: https://render.com/docs/configure-other-dns
- Registro.br, Zona DNS: https://registro.br/tecnologia/caracteristicas-tecnicas/

## Limites e segurança

- A preparação do backend já foi executada. **Adicionar o Custom Domain no Render e alterar a Zona DNS do Registro.br ainda são passos que exigem acesso aos painéis, sem conector de escrita disponível nesta conversa.**
- Não registrar o mesmo domínio novamente; ele já está registrado.
- Não colocar senhas, chaves, CPF, CNPJ ou credenciais em issues, commits ou mensagens.
- Não alterar FORTE FISCAL, FORTE OPERACIONAL em main, MC-6 ou outros projetos; este trabalho é exclusivo do CFOP público, agora chamado FORTECOMPANNY.
- **Não afirmar que o novo domínio está em produção antes de confirmar DNS, HTTPS e páginas reais.**
