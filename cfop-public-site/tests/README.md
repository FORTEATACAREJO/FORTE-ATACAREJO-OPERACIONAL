# Verificação da Consulta de CFOP — 12/11/2026

## Executado

- `node cfop-public-site/tests/cadastros.test.mjs`: 33 casos de contrato, com rede e credenciais simuladas. Incluem 401/403/404/422/429/502/503, documento divergente, retorno vazio, Simples true/false/desconhecido, CPF rural MG/GO, múltiplas IEs e consentimento. Nenhuma chamada ao fornecedor nessa suíte.
- `node cfop-public-site/tests/assistente-dom.test.mjs`: 18 combinações (comprar/vender × três perfis próprios × três perfis da outra parte), mais cinco verificações de consentimento, seleção de IE, invalidação por UF e resposta atrasada. Executa o JavaScript real em JSDOM 26.1.0, com rede simulada. Não equivale a homologação com fornecedores reais.
- Chromium local foi tentado, mas o ambiente impediu a abertura de sockets (`Operation not permitted`). A suíte DOM foi usada como alternativa; a conferência visual da publicação é separada.
- CNPJ API pública de demonstração: retornos reais HTTP 200 dos exemplos numérico optante do Simples e alfanumérico. Identificados e corrigidos `SimplesNacional.OpcaoPeloSimples` e `Endereco.Municipio.Nome`. O retorno alfanumérico obtido foi processado pelo adaptador corrigido com sucesso. São dados fictícios disponibilizados pelo fornecedor; não comprovam consultas empresariais reais de MG/GO.
- Edge Function `cfop-cadastros`, Supabase `yzsxtgmasssoflgqhizm`, versão 2 implantada. Respostas HTTP reais detalhadas em `live-edge-results-20261112.json`. Não foram enviadas consultas de CPF ao fornecedor; o bloqueio por ausência de chave/consentimento ocorre antes da chamada externa.

Para reproduzir a suíte DOM, instale `jsdom@26.1.0` em diretório de dependências fora do repositório e aponte `NODE_PATH` para seu `node_modules`. Requer Node 24 para a remoção dos tipos TypeScript nos testes do backend.

## Segurança e custo

- Chaves reais não foram geradas nem incluídas no repositório. Os valores de teste da suíte são fictícios e não autenticam serviços.
- `cfop_provider_quota` tem RLS e bloqueio de clientes públicos; a função de reserva é executável apenas por `postgres`/`service_role`.
- Preservados limites de CNPJ 70/dia e 1000/mês; CNPJ+IE 5/dia e 35/mês; rural 2/dia e 8/mês. Não houve consumo dessas reservas nos testes sem chave.
- Advisor de segurança sem alertas WARN/ERROR. Tabelas privadas com RLS sem políticas públicas aparecem como INFO e permanecem fechadas aos clientes.
- A reserva global limita o consumo inclusive com chamadas concorrentes. CORS não constitui autenticação; um cliente externo ainda pode consumir a franquia global. Autenticação individual e limites distribuídos por usuário continuam sendo melhoria possível antes de ampliar acesso/cotas.
- Não houve compra, cartão, plano pago ou alteração em outros ambientes/branch main.

## Pendente de participação do titular

As páginas oficiais de cadastro dos dois fornecedores foram abertas. Ambas exigem criação de senha; CNPJ API também exige aceite de termos no envio. O titular precisa concluir essas etapas e eventual confirmação de e-mail/CAPTCHA. Cadastro não foi submetido automaticamente.

Após as contas: confirmar o plano efetivamente gratuito, gerar as credenciais e guardá-las somente em Edge Functions → Secrets do projeto `yzsxtgmasssoflgqhizm`, com os nomes `CNPJAPI_API_KEY` e `SINTEGRAPI_API_KEY`. O conector Supabase disponível não oferece gravação de secrets; essa etapa exige a interface autenticada.

SintegrAPI anuncia 10 créditos mensais na primeira conta empresarial elegível; a elegibilidade e o saldo desta empresa ainda dependem do cadastro. Rural exige CPF de teste fornecido pelo provedor ou titular com consentimento específico; nenhum CPF pessoal recuperado do histórico foi utilizado.

**Estado final deste lote: integrações não ativadas e homologação real MG/GO pendente.** Não marcar a issue como concluída. Status `Available` depende da presença da chave e sozinho não prova autenticidade, saldo ou funcionamento do fornecedor.

## Documentação oficial conferida

- https://cnpjapi.com.br/planos
- https://cnpjapi.com.br/docs/autenticacao
- https://cnpjapi.com.br/docs/consulta-cnpj
- https://cnpjapi.com.br/docs/consulta-ie
- https://www.sintegrapi.com.br/cadastre-se
- https://docs.sintegrapi.com.br/authentication
- https://docs.sintegrapi.com.br/produtor-rural
- https://supabase.com/docs/guides/functions/secrets.md

O contrato documentado permite manter CNPJ+IE em uma chamada com `?incluir=ie&ie_uf=auto`. Não foi necessário trocar esse endpoint. A normalização rural agora exige sucesso explícito, CPF e UF correspondentes; preserva situação desconhecida e não trata erro em HTTP 200 como cadastro confirmado.
