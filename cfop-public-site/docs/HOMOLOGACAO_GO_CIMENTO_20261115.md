# FORTECOMPANNY+ IA — Primeiro cenário de revisão do destino Goiás

Data de pesquisa: 15/11/2026. **Não homologado.**

## Cimento MG → GO (CEST 05.001.00)

Fonte oficial consultada: Secretaria da Economia de Goiás, calendário de recolhimento de ICMS disponibilizado em seu portal:
https://goias.gov.br/economia/wp-content/uploads/sites/45/2026/01/Calendario_de_Recolhimento_de_ICMS_20250401-9.pdf

O documento referencia RCTE/GO Anexo VIII, arts. 52 e 53, IN 155/94-GSF, Convênio 142/2018 e protocolos para cimento. Seu capítulo 2 informa hipóteses distintas conforme o substituto tributário possua **inscrição no CCE-GO**, seu regime e o tipo de operação.

- Item 2.3: substituto inscrito CCE-GO, regime normal, operação com cimento a contribuinte goiano, possui prazo específico indicado no calendário. **Conferir ato vigente e exceções antes de orientar vencimento.**
- Item 2.4: substituto de outra UF sem inscrição CCE-GO sujeito à hipótese de recolhimento por operação no momento da saída; não generalizar para toda compra.
- Uma NF-e histórica autorizada MG→GO com CFOP 6401, CST 10 e ST destacada **não comprova** por si só enquadramento de outras operações, outro produto, reter da mesma forma ou recolhimento efetivo.

## Regra em banco

Registro de **MG→GO, cimento, venda destinada à revenda**, adicionado no Supabase exclusivo como `situacao=em_revisao`, `homologado_em=null`. Campos de referência e pendências registrados sem calcular impostos ou atribuir valores.

## Pendências obrigatórias

1. Conferir por ato vigente eventual responsabilidade do remetente industrial/comercial e do destinatário, conforme IE e regime.
2. Validar tratamento do cimento e eventual protocolo aplicável conforme origem, destino e data, inclusive exceções.
3. Confirmar dados do XML real, retenção para GO, comprovante de pagamento e eventuais benefícios.
4. Completar cálculos ST / MVA ou pauta / prazo/DARE e integração com CFOP/CST apenas após evidência documental.
5. Criar revisão separada para argamassas com destino GO; não inferir regras do Anexo VII mineiro para Goiás.

**Este documento não autoriza emissão de NF-e, classificação fiscal final ou pagamento de tributos.**
