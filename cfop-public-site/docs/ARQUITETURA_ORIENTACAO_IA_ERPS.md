# FORTECOMPANNY+ IA — arquitetura de orientação fiscal e integração futura

Data: 2026-11-15. **Status: validação privada; não liberado para divulgação geral.**

## Finalidade atual

- Preparar e conferir parâmetros tributários de operações de NF-e, sem assinar, emitir, transmitir, cancelar ou autorizar notas fiscais.
- A ficha é orientativa até todas as regras fiscais por produto/UF/natureza/regime estarem homologadas, com data de vigência, fundamento e evidências.
- O usuário decide, com confirmação, se um resultado poderá ser utilizado no seu ERP. Nenhum documento será enviado a SEFAZ por esta plataforma.
- Tratar CFOP, CST/CSOSN, NCM, CEST, ICMS, ICMS-ST, DIFAL, FCP, IPI, PIS/COFINS, IBS/CBS e cClassTrib conforme vigência e dados comprovados. Sinalizar riscos, não inventar regras.

## Minha IA — fase 1 (implementada)

- O visitante escolhe ChatGPT, Gemini, Claude, Copilot ou outra IA, e a escolha fica em localStorage.
- Botão prepara pergunta fiscal, tenta copiar na área de transferência, abre o site oficial da IA preferida, deixando ao usuário a decisão de colar e enviar.
- Não envia automaticamente CNPJ, CPF, razão social, nome de pessoa, XML ou chave fiscal; não obtém mensagens, memórias ou assinaturas.
- Não solicita login da IA na própria plataforma. Não usa API paga, tokens, senhas, chaves nem promete interoperabilidade entre provedores.
- O resultado da IA nunca altera o cálculo de tributos nem faz homologação de regra automaticamente.
- Registrar apenas o provedor escolhido localmente, não em tabela de consultantes.

## Minha IA — fase 2 (dependente de acordo com os provedores)

- Em OpenAI, avaliar candidatura à participação em **Sign in with ChatGPT** e uso autorizado da cota dos planos elegíveis; a disponibilidade depende do programa, do plano e do consentimento do assinante, e não está ativa no FORTECOMPANNY.
- Para outros provedores, usar somente suas interfaces oficialmente documentadas com autorização específica. Não presumir que assinatura pessoal dá direito de usar a API.
- Credenciais e tokens, se algum provedor aprovar integração, devem permanecer exclusivamente em backend seguro por usuário com revogação, expiração e limites de uso.
- Se houver qualquer transmissão de CPF/CNPJ, XML ou documento fiscal, solicitar consentimento explícito para cada fonte e detalhar finalidade no aviso de privacidade.
- Os retornos de IA nunca são fontes normativas homologadas; validação legal e fiscal permanece com motor tributário versionado.

## Integração com ERPs e emissores — fase futura

Desenvolver uma API consultiva separada para permitir que sistemas terceiros solicitem **orientação**, não emissão:

Input conceitual: contexto do emitente/destinatário autorizado, operação, finalidade, UF, regime, documento base e produto validado.

Output conceitual:
- `state`: `orientativo`, `pendente_confirmacao` ou `regra_homologada` — o último refere-se a regra específica, não à nota como um todo;
- sugestões de CFOP/CST/NCM/CEST e demais tributos acompanhadas de evidência legal, vigência, unidade de destino, responsabilidade e critérios;
- pendências de informação e possível custo adicional ao destino (ICMS-ST/DIFAL);
- assinatura da versão da regra, identificador de auditoria, data-base, fonte e indicador de confiança;
- nunca afirmar `nfe_autorizada` ou equivalentes.

Integração condicionada a autenticação do ERP, consentimento do estabelecimento, limites de requisições, isolamento de clientes e testes de homologação, sem acesso direto irrestrito aos bancos de terceiros.

## Regras de liberação

- Não divulgar como motor fiscal completo enquanto houver lacunas de UF, regimes e tributação.
- Não marcar uma UF homologada apenas porque o portal oficial respondeu HTTP 200.
- Não transformar resposta de IA em código fiscal definitivo.
- Não emitir NF-e nesta fase.


## Ficha fiscal orientativa JSON — versão de testes (implementada)

- Arquivo gerado **somente no navegador**, após consulta concluída. Não há envio de JSON ao Supabase, Render, SEFAZ ou provedores de IA.
- Opção **incluir identificadores e nomes das empresas** desligada por padrão; sem autorização, o JSON exporta apenas a UF e a informação de IE, sem documentos/razões sociais. Descrição de produto também tem documentos sensíveis mascarados.
- `formato: FORTECOMPANNY_ORIENTACAO_FISCAL`, `schema_version: 1.0.0`, `tipo: consulta_orientativa_nao_homologada`, `nfe.emitida: false`, `validacao.can_use_for_automatic_issuing: false`.
- Conteúdo: natureza e finalidade, UF, origem declarada do item, CFOP como **sugestão**, NCM como código existente sem homologar o produto, CEST indicativo, situações de ICMS-ST/DIFAL, referência a possíveis custos adicionais, fontes legais, alertas, dados ainda não comprovados.
- Não inclui cálculo real de impostos, documentos XML, nem libera integração automática com emissores. Alterar a consulta invalida a prévia exportada.
- Próxima fase de integração com ERPs: esquema autenticado e versionado com aprovação específica para uso em cada emissor, controles de privacidade, vigência e trilha de auditoria. Não usar a versão atual como documento fiscal ou autorização de emissão.

**Validação do código:** cenários de anonimização padrão, consentimento explícito, esquema orientativo, cópia local, geração de JSON e invalidação após alteração da consulta. Testes de regressão registrados em `tests/ficha-exportacao.test.mjs`.
