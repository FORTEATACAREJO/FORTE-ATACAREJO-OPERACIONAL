# FORTECOMPANNY+ IA — Triagem fiscal inteligente por cenário

**Implantado em 16/11/2026 — aplicação em validação privada.**
**Finalidade:** orientar parametrização tributária de mercadorias de qualquer setor, sem emitir NF-e.

## Perguntas iniciais, antes da identificação da mercadoria

1. **Regime tributário do emitente:** Simples Nacional, MEI, regime normal, excesso do sublimite, produtor rural/pessoa física, outro ou "não sei". Esta é uma declaração do usuário; o cadastro CNPJ de fonte intermediária pode gerar aviso de divergência, mas não comprova CRT.
2. **Existe regime especial ou benefício fiscal?** Não / Sim / Não sei. Se **Sim**, perguntar (somente nesse ramo) qual o tributo/obrigação alterada, se o ato abrange essa mercadoria e operação, se está vigente e, opcionalmente, sua referência. Referência permanece no navegador nesta fase; não é enviada ao Supabase, nem ao botão "Minha IA".
3. **A operação possui condição tributária diferente?** Não / Sim / Não sei. Se **Sim**, escolher ICMS-ST anterior, antecipação, monofásico, benefício/isenção, ZFM/área incentivada, importação, exportação, devolução, triangular ou outra.
4. **Data da operação**, opcional, em branco significa hoje. Quando preenchida, a data é passada ao motor para verificação de vigência, sem afirmar que normas futuras estejam confirmadas.

## Regras de comportamento

- Perguntas condicionais ficam ocultas quando não há condição declarada; não exigir detalhes de regime especial para todos os contribuintes.
- "Não sei" é aceito, mas gera pendência visível e impede tratar CFOP como definitivo.
- Regime especial **declarado** não significa regime **homologado**: por segurança o resultado apresenta **"CFOP a conferir conforme regime especial"** quando sua possível aplicabilidade demanda análise. Nenhum benefício é aplicado automaticamente, mesmo com número do ato e vigência informados.
- Condição atípica declarada impede aplicar silenciosamente o CFOP da operação comum; orienta rever ST/DIFAL, redução, imunidade, monofásico ou outra norma específica.
- Se NCM do produto for desconhecido, a necessidade de confirmar a classificação prevalece sobre qualquer escolha de regime.
- Divergência entre regime declarado e indicação cadastral (Simples/não optante) é exibida como **alerta a confirmar**, nunca como correção automática do CRT.
- A ficha orientativa JSON guarda o contexto declarado e pendências; referência de ato concessivo é omitida por padrão e só poderá aparecer, com eventuais identificadores mascarados, quando o usuário optar explicitamente por identificadores.
- "Minha IA" pode copiar apenas a **categoria** do cenário para pedir ajuda externa, sem número de ato, CPF, CNPJ ou dados empresariais automáticos.

## O que continua pendente

Regimes especiais, incentivos, benefícios, crédito presumido e substituição tributária dependem de ato específico, vigência, setor, produto, estabelecimento e regras da UF. O motor estadual precisa de legislação validada, fontes oficiais, XML e testes por cenário para tratar qualquer resposta como definitiva. **0 conjuntos estaduais completos homologados**. Não publicar como emissor ou guia fiscal conclusivo.

## Testes

- `tests/triagem_fiscal.test.mjs`: 9 casos de seleção, perguntas condicionais, "não sei", regimes especiais e bloqueios.
- Simulações integradas: venda comum, regime especial ICMS-ST, regime especial pendente, monofásico, respostas "não sei" e triagem ausente (6 cenários), com bloqueios e CFOP condicionado como esperado.
- `tests/produtos_todos_setores.test.mjs` adaptado para que consultas nacionais também passem pela triagem, sem remover o suporte a produtos de quaisquer segmentos.
- `tests/qualidade-fiscal.test.mjs` ajustado para evitar considerar regra estadual geral válida para cenário especial não analisado.

## Bases legais para a triagem

- Portal NF-e: CRT e CSOSN para Simples Nacional: https://www.nfe.fazenda.gov.br/Portal/perguntasFrequentes.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=S%2FEAGUrzRyk%3D
- Regimes Especiais — RICMS/MG 2023, arts. 141–144: https://www.fazenda.mg.gov.br/export/sites/fazenda/empresas/legislacao_tributaria/ricms2023/regulamento2023.pdf
- SEF/MG: Regimes especiais e tratamento tributário diferenciado: https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/portarias/2014/port_sutri_sufis_saif_001_2014.html

As fontes de MG acima ilustram a necessidade de validação do ato individual; **não transformam a triagem em uma regra estadual nacional**.
