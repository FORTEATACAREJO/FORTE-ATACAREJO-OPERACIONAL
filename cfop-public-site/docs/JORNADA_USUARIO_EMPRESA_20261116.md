> **DIRETRIZ ATUALIZADA EM 16/11/2026:** A homologação fiscal do FORTECOMPANNY depende exclusivamente de fundamentação em legislação oficial vigente, âmbito de aplicação, vigência, exceções e revisão técnica documentada. **XML não é requisito, nem comprova correção tributária.** Quaisquer referências abaixo a XML obrigatório devem ser interpretadas como possibilidade de conferência auxiliar. Prevalece `docs/DIRETRIZ_HOMOLOGACAO_LEGISLACAO_SEM_XML_20261116.md`.

# FORTECOMPANNY+ IA — Jornada de orientação para usuário comum

**Data:** 16/11/2026. **Status:** piloto consultivo, sem emissão de NF-e e sem divulgação pública geral.

## Objetivo

Pessoas que não dominam CFOP, CST, NCM ou regras de ICMS devem conseguir entender como preparar ou conferir uma nota fiscal ou uma compra. O primeiro passo deve ser **o que deseja fazer**, e não códigos fiscais. O sistema conduz uma entrevista contextual e só exibe a legislação necessária à operação.

## Navegação principal

1. **Quero comprar:** pergunta "Para que sua empresa vai usar o bem?" — revender, usar/consumir, incorporar ao ativo (máquina, veículo, equipamento), industrializar ou não sabe. A empresa consultante é colocada como **destinatário/comprador**; o fornecedor normalmente emite NF-e de saída, e o resultado diferencia a orientação de entrada do comprador dos campos de saída do vendedor.
2. **Quero vender:** pergunta "Como o seu cliente vai usar o produto?" — revenda, uso/consumo ou não sabe. A empresa consultante é colocada como **origem/vendedor**.
3. **Outra operação:** mantém natureza especial existente (devolução, remessa, retorno, transferência, comodato, conserto, bonificação, etc.), com documento original e finalidade como pendências necessárias.
4. **Tenho uma dúvida:** campo de linguagem livre com botão para **Minha IA**, que prepara a pergunta sem enviar automaticamente CPF/CNPJ. Usuário escolhe a IA e decide se quer compartilhar; resposta livre não substitui regra fiscal homologada.

## Minha Empresa — configuração opcional

- Guarda, **somente mediante botão de salvar**, nome local, UF, regime tributário, existência declarada de regime especial e atividade (comércio, indústria, empresa/serviços ou pessoa física).
- Documento CPF/CNPJ só é guardado se o usuário tiver explicitamente marcado a opção independente "Lembrar meu CPF/CNPJ neste aparelho"; perfil pode ser salvo apenas com UF.
- Restaura configurações no mesmo navegador; troca automaticamente a UF e o CNPJ para **destino** em uma compra e para **origem** em uma venda.
- A mudança entre compra/venda não deve conservar a UF própria no lado anterior, evitando assumir que comprador e vendedor sejam da mesma UF.
- Não exige cadastro no servidor, senha, conta paga ou consulta antecipada para criar o perfil; não sincroniza entre aparelhos.
- Uma declaração de regime/atividade nunca é validação jurídica de CRT ou ato concessivo. "Não sei" permanece uma opção válida.

## Simulação sem conhecer o CNPJ do fornecedor

- Para estudo preliminar, pode informar **apenas UF de origem e de destino**. O sistema identifica claramente "UF informada pelo usuário" e "CNPJ/CPF não informado".
- Se um CNPJ for informado e seu cadastro divergir da UF declarada, exibe pendência de estabelecimento real; não altera silenciosamente cadastro externo.
- Sem IE verificada, CFOP, ST e DIFAL continuam condicionais. Para calcular tributos exatos ainda faltam produto classificado, regime, valor, frete, alíquotas e normas homologadas.
- Finalidade da mercadoria é identificada **antes** da classificação do produto.

## Exemplo implementado: máquina de Minas Gerais comprada por empresa de Goiás

Ações:
1. "Quero comprar" → "Vou usar como máquina, veículo ou equipamento da empresa" → natureza orientativa `compra_ativo`.
2. Minha Empresa: GO → comprador/destinatário. Fornecedor: MG → remetente (sem precisar saber CNPJ em simulação).
3. Produto: máquina específica, modelo/composição/função e NCM confirmado no XML/ficha do fabricante. Nunca inventar NCM para a palavra genérica "máquina".
4. Confirmação: regime do comprador, se é contribuinte de ICMS, finalidade real do bem, possível regime especial e data.
5. Resultado: instrução em linguagem comum, possível CFOP de entrada 2.551 ou alternativa condicional, possibilidade de ICMS diferencial de alíquotas em GO, quem pode ser responsável, eventual crédito CIAP conforme condições da legislação. **Sem calcular valores ou afirmar pagamento devido sem dados e norma verificada.**
6. Explicar a diferença entre a **nota de saída emitida pelo vendedor mineiro** e o **registro de entrada da máquina na empresa goiana**.

Fonte oficial ilustrativa: Secretaria da Economia de Goiás — Guia Prático EFD ICMS/IPI 5.9 (2026), seção de aquisição interestadual para ativo imobilizado e CIAP:
https://goias.gov.br/economia/wp-content/uploads/sites/45/2026/03/Guia_pratico_5.9.pdf
Legislação e prazos devem ser confirmados para a data, regime e produto em cada operação.

## Saída simplificada

Mostrar, nesta ordem: (1) **O que fazer agora**, em três passos; (2) o que está confirmado ou pendente; (3) hipótese de CFOP e tributos, com alerta de possível custo adicional; (4) documento fiscal e fundamento legal; (5) ficha orientativa para copiar/exportar.

A interface deve explicar termos técnicos antes de exibi-los. Nunca dizer que uma nota foi autorizada, validada, calculada ou emitida pelo FORTECOMPANNY.

## Implementação verificada

- `index.html`: novo início Comprar/Vender/Outra/Dúvida, perfil local, quatro atividades, CNPJ/CPF opcional com UF informada para simulação, botão de demonstração MG→GO.
- `jornada-operacao.js`: estado da jornada, mapeamento de finalidade para natureza, vínculo da empresa com origem/destino, salvamento e restauração local, opção de dúvida e demonstração.
- `consulta-automatica.js`: cadastro opcional por UF quando não há CNPJ, origem manual não verificada, confere UF divergente, distingue regime da empresa compradora do vendedor e não aplica erroneamente o regime do comprador à regra do fornecedor; adiciona orientação para compra de ativo MG→GO e passos em linguagem simples.
- `minha-ia.js`: inclui dúvida livre e UFs quando usuário optar por copiar, sem autoenvio de identificadores.
- `ficha-exportacao.js`: JSON orientativo v1.1, distingue objetivo e empresa consultante; mantém `nfe.emitida=false` e `can_use_for_automatic_issuing=false`.
- `tests/jornada_operacao.test.mjs`: sete cenários de empresa opcional, papel de comprador/vendedor, exemplo MG→GO, dúvida e salvamento/remoção.
- Simulação integrada testou sem CNPJ, apenas com UF MG→GO, propósito ativo, sem NCM e depois com NCM informado; apresentou advertência sobre DIFAL e **não homologou** classificação ou imposto.

## Próximas etapas, sem confundir com funcionalidades concluídas

- Wizard de uma pergunta por tela (mobile) e linguagem ainda mais simples.
- Cadastro seguro multidevice opcional para quem realmente desejar conta, sem obrigar o visitante público.
- Leitor XML que preenche somente dados comprovados e solicita confirmação de inconsistências.
- Motor de atos concessivos e regras de ICMS/ST/DIFAL por UF/produto/regime/finalidade/vigência, com validação e testes de operações reais.
- Modo de dúvidas simples dentro do FORTECOMPANNY com explicações fundamentadas, sem depender de plataforma externa.
- Futuras integrações consultivas com diversos emissores de NF-e, apenas após aprovação e autorização específica.

**O motor tributário completo das 27 UFs ainda não foi homologado.** As funcionalidades acima não constituem validação fiscal nacional.
