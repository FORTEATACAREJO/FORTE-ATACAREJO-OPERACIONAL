# ORDEM DE EXECUÇÃO PARA CHATGPT WORK — FORTE TECH / CONSULTA DE CFOP

**Data:** 12/11/2026  
**Executor:** ChatGPT Work com navegador e conectores autorizados  
**Status inicial:** PENDENTE DE EXECUÇÃO PELO WORK  
**Prioridade:** Alta  
**Projeto:** FORTE TECH — Consulta Inteligente de CFOP (independente de FORTE FISCAL, FORTE ATACAREJO OPERACIONAL, MC-6 e da outra aplicação Sistemas Forte Tech).  
**Objetivo:** Ativar as **duas integrações cadastrais gratuitas** CNPJ API (empresas/CNPJ/IE) e SintegrAPI (CPF de produtor rural/IE), configurar os segredos no Supabase, ajustar o mapeamento conforme a documentação real e homologar o fluxo de compras (entradas) e vendas (saídas) sem cobrar nada da empresa.

## 1. AUTORIZAÇÃO E LIMITES

A pessoa responsável autorizou o **cadastro em planos efetivamente gratuitos** nas plataformas CNPJ API e SintegrAPI e a implementação/teste dessas integrações da FORTE TECH, usando os serviços conectados e navegador do Work.

- **NÃO contratar, assinar, ativar teste que se converta em cobrança, cadastrar cartão, efetuar pagamento ou contratar serviços adicionais** sem nova aprovação expressa. Se a gratuidade estiver indisponível para a conta/empresa, documentar a barreira e manter o fornecedor desativado.
- Usar uma identidade empresarial e uma caixa de e-mail **sob controle e autorização da pessoa usuária**; preferir identidade da Sistemas Forte Tech. **Não inventar e-mail, senha, CPF, CNPJ, poderes de representação ou dados cadastrais.**
- É permitido completar as etapas automatizáveis. Em CAPTCHA, aceite legal que exija gesto próprio do titular, validação de identidade, verificação por e-mail, MFA/2FA ou criação de senha pessoal: **encaminhar a etapa para a pessoa responsável no fluxo interativo do Work**, sem contornar proteções e sem fingir que já concluiu.
- **Nenhum token, senha ou API key** no GitHub, chat, mensagens, commits, issues, frontend, logs ou arquivos de configuração versionados. Guardar somente como segredo do projeto Supabase. Não apresentar as chaves no relatório.
- Usar exclusivamente créditos/cotas grátis, com limite e monitoramento; não disparar testes em massa nem fornecer uma API pública sem contenção de abuso.
- Não alterar banco, certificados, produção ou arquivos de **FORTE FISCAL**, **FORTE ATACAREJO OPERACIONAL** (branch `main`), **MC-6** ou outros projetos. Toda alteração de frontend da Consulta CFOP deve permanecer na branch isolada especificada abaixo.

## 2. AMBIENTES EXATOS

- GitHub: `FORTEATACAREJO/FORTE-ATACAREJO-OPERACIONAL`  
- **Branch exclusiva da Consulta CFOP:** `deploy/forte-tech-cfop-publico-20261112`  
- Frontend: pasta `cfop-public-site/` (não modificar as outras pastas).
- Site público no Render: https://forte-tech-cfop-publico.onrender.com/  
- Assistente guiado: https://forte-tech-cfop-publico.onrender.com/assistente.html  
- Render: serviço `forte-tech-cfop-publico`, ID `srv-dbquodbrjlhs73cg02ig`, workspace **FORTE-ATACAREJO**, ID `tea-daoniurm8hqs73fsi3p0`.
- **Supabase EXCLUSIVO desta ferramenta:** projeto `forte-tech-cfop-estatisticas`, ID `yzsxtgmasssoflgqhizm`. Não confundir com `setor_fiscal_forte_tech_empresas` nem `FORTE-FISCAL`.
- Função pública de pesquisa cadastral já implantada: `cfop-cadastros` em `https://yzsxtgmasssoflgqhizm.supabase.co/functions/v1/cfop-cadastros`.
- Função de métricas e acesso: `consulta-cfop` (não remover, não publicar seus segredos).
- Segredos esperados apenas no Supabase: `CNPJAPI_API_KEY` e `SINTEGRAPI_API_KEY`.
- O endpoint `GET /status` da função `cfop-cadastros` respondeu, antes desta ordem, `cnpjAvailable:false` e `ruralAvailable:false`. **Reverificar**, não supor que continue assim.

## 3. CADASTRAR GRATUITAMENTE A CNPJ API

1. Verificar os termos e franquias ATUAIS em https://cnpjapi.com.br/planos e a documentação em https://cnpjapi.com.br/docs/ e https://cnpjapi.com.br/docs/autenticacao; estes limites podem mudar. Referência publicada em 12/11/2026: gratuito 5.000 CNPJ/mês, 50 IE/mês, 300 CNPJ/dia e 10 consultas/min. **Confirmar ao registrar.**
2. Abrir o cadastro oficial: https://app.cnpjapi.com.br/auth/cadastro (ou https://app.cnpjapi.com.br). Usar conta e e-mail autorizados; concluir verificação por e-mail mediante intervenção da pessoa usuária, se necessária. Escolher **Gratuito / R$ 0**, sem cartão.
3. No painel, criar uma **API key de produção do plano gratuito**. Guardar diretamente em cofre de segredos/segredos do Supabase, nunca na branch ou issue.
4. Confirmar autenticação real com `Authorization: Bearer <KEY>`. A documentação também oferece chave pública de demonstração limitada a CNPJs fictícios; usar esse recurso quando conveniente para testar mapeamento **sem gastar franquia real**.
5. Conferir documentação dos endpoints exatos: CNPJ `GET https://api.cnpjapi.com.br/{cnpj}`; IE `GET /consulta/ie/{cnpj}` ou parâmetro de inclusão publicado. **Não assumir que a implementação anterior está correta**; validar estruturas JSON, nomes de campos, data dos dados, retorno do Simples Nacional, possíveis CNPJs alfanuméricos, limites, 401, 403, 422, 429, 502/503 e cache.

## 4. CADASTRAR GRATUITAMENTE A SINTEGRAPI

1. Verificar https://www.sintegrapi.com.br/cadastre-se e https://www.sintegrapi.com.br/planos. A página de cadastro em 12/11/2026 informa que a **primeira conta por domínio corporativo** pode receber 10 créditos mensais do Free Tier; regras diferentes podem valer para Gmail/Outlook e para CNPJ elegível. Confirmar elegibilidade **antes** de registrar, sem comprar créditos.
2. Abrir https://www.sintegrapi.com.br/cadastre-se, usar dados empresariais verdadeiros/autorizados, selecionar plano gratuito e realizar confirmações humanas quando necessárias. Caso o provedor exija cartão ou contratação, **parar somente esse cadastro** sem pagar.
3. No dashboard gerar a chave API e cadastrá-la diretamente nos segredos do Supabase; usar exclusivamente o header `x-api-key` como documentado em https://docs.sintegrapi.com.br/authentication.
4. Verificar documentação atual da consulta de produtor rural: https://docs.sintegrapi.com.br/produtor-rural. Endpoint esperado `GET https://api.sintegrapi.com.br/consultas/v2/produtor-rural/{cpf}?uf=MG|GO|...`. Conferir parâmetros de `cache`, `cache_strategy`, retorno de múltiplas inscrições estaduais, status ativo, UF e `request_id`.
5. **Antes de consultar CPF de qualquer pessoa:** verificar se há base legal/finalidade e autorização compatíveis; a interface atual exige consentimento explícito. Usar apenas CPF fictício/de teste autorizado ou CPF de titular que tenha consentido. Não usar dados pessoais de terceiros apenas para exercitar a API.

## 5. CONFIGURAR SUPABASE COM SEGURANÇA

1. Usar o projeto EXATO `yzsxtgmasssoflgqhizm` — verificar antes de qualquer escrita.
2. Inserir `CNPJAPI_API_KEY` e `SINTEGRAPI_API_KEY` em **Edge Functions → Secrets** pelo dashboard ou conector seguro, **sem imprimir o conteúdo**. Se o conector não permitir secret writes, executar a etapa pela interface do Work com confirmação do titular; não transportar a chave via issue/chat.
3. Verificar `GET /functions/v1/cfop-cadastros/status`: ambos `true` somente depois de efetivamente disponíveis. Não falsificar o status e não introduzir token de administrador em código client-side.
4. Conferir contratos REST e normalização do código de `cfop-cadastros` já implantado. Corrigir eventuais diferenças de endpoints, formato das chaves ou campos JSON, de forma pontual. Manter respostas sanitizadas que **não revelem CPF ou API keys** e separar status: **verificado na fonte**, **retorno de intermediário**, **informado pelo visitante**, **não confirmado**.
5. Respeitar a função de cotas `cfop_reserve_provider_lookup` e tabela `cfop_provider_quota`. Limites iniciais conservadores já cadastrados: CNPJ comum **70/dia / 1000/mês**, CNPJ+IE **5/dia / 35/mês**, rural **2/dia / 8/mês**. Não aumentar sem validar franquia gratuita atual. Proteger contra uso público abusivo, brute force, requisições paralelas, registros indevidos e vazamento de CPF. Revisar autorização, RLS e limites de requisição.
6. Não transformar “não optante pelo Simples Nacional” em “Lucro Real”. Lucro Real/Presumido e regime estadual do ICMS continuam **não confirmados** sem fonte documental idônea. CNPJ, IE e CNAE também não determinam automaticamente ICMS-ST/CFOP.

## 6. EXPERIÊNCIA DE USO E TESTES INTEGRADOS

O fluxo aprovado e JÁ presente no aplicativo é:
**(0) Comprar ou vender mercadorias → (1) Identificar-se: empresa CNPJ / produtor rural CPF+IE+UF / CPF comum → (2) Identificar fornecedor ou comprador com os mesmos perfis → (3) Informar produto, NCM/CEST quando souber, e finalidade (revenda, obra, consumo, industrialização etc.) → (4) Resultado/pendências.**

- Confirmar que os botões de **Buscar cadastro automaticamente** na etapa 1 e **Buscar cadastro da outra parte** na etapa 2 funcionem com as duas APIs, sem pedir dados já retornados. Não bloquear o preenchimento manual em caso de erro ou falta de cota.
- Após buscar a própria empresa, permitir salvar cadastro/retorno com **fonte, timestamp, estado e verificação**; avaliar armazenamento mínimo e consentimento, não guardar CPF sem base legal. **Não sobrescrever dados próprios ou de outra UF** com um retorno incoerente.
- Caso haja várias IE de produtor rural, exibir opções para escolha da inscrição específica (não escolher arbitrariamente).
- Validar **compras/entradas e vendas/saídas** para empresa CNPJ (Simples e não Simples, distinguindo desconhecido), produtor rural com CPF/IE, consumidor CPF; operação mesma UF e interestadual; IE ativa/inativa; fornecedor sem informação. Priorizar MG e GO.
- Testar falhas `401/403/404/422/429/502/503`, esgotamento de créditos, dados ausentes, documento inválido, CNPJ alfanumérico e queda da API. Nenhuma falha pode causar suposição fiscal.
- Não prometer CFOP definitivo: a ferramenta permanece **experimental e não homologada** para tributação de todos os produtos e UFs. O motor de CFOP deve mostrar **Pendente** onde NCM, CEST, regime/ST ou legislação não estejam validados.

## 7. CONCLUSÃO E EVIDÊNCIA QUE O WORK DEVE ENTREGAR

A ordem só estará **completa** quando:
- [ ] Conta CNPJ API gratuita efetivamente criada, e-mail/registro confirmados, chave gerada e guardada com segurança.
- [ ] Conta SintegrAPI gratuita efetivamente criada, e-mail/registro confirmados, chave gerada e guardada com segurança.
- [ ] Nenhuma cobrança, cartão, plano pago ou assinatura ativada.
- [ ] Os dois conectores disponíveis no Supabase do CFOP (status e buscas reais verificadas).
- [ ] Testes de CNPJ, consulta de IE e produtor rural MG/GO executados conforme consentimento e limites, com prova redigida sem dados pessoais/credenciais.
- [ ] Frontend atualizado quando necessário, commit feito somente na branch isolada e deploy Render `live`.
- [ ] Relatório sucinto com links de commit, deploy, falhas remanescentes, saldo de franquia sem divulgar segredos.

Se faltar autenticação humana, e-mail de confirmação, CAPTCHA, senha ou 2FA, **avançar em todas as demais etapas permitidas** e encerrar com uma lista precisa dos passos bloqueados, sem alegar conclusão. Não iniciar compras, não alterar FORTE FISCAL, e não mudar a branch `main` operacional.

## 8. REFERÊNCIAS OFICIAIS PARA REVALIDAR

- https://cnpjapi.com.br/planos
- https://cnpjapi.com.br/docs
- https://cnpjapi.com.br/docs/autenticacao
- https://cnpjapi.com.br/docs/consulta-ie
- https://app.cnpjapi.com.br/auth/cadastro
- https://www.sintegrapi.com.br/cadastre-se
- https://docs.sintegrapi.com.br/produtor-rural
- https://docs.sintegrapi.com.br/authentication

**Importante:** esta ordem no GitHub é um registro/instrução. A presença do arquivo ou de uma issue **não significa que o Work começou a executar ou que as contas foram criadas**.
