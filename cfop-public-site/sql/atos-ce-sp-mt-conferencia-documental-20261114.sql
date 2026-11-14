-- FORTECOMPANNY — segunda conferência documental, 14/11/2026.
-- Três atos em SP / MT / CE. Não publica cálculo fiscal nem homologa regras de UF.
ALTER TABLE public.cfop_atos_em_analise
 ADD COLUMN IF NOT EXISTS data_assinatura date,
 ADD COLUMN IF NOT EXISTS termino_dispositivo date,
 ADD COLUMN IF NOT EXISTS dispositivo text,
 ADD COLUMN IF NOT EXISTS classe_impacto text,
 ADD COLUMN IF NOT EXISTS fonte_consolidada_url text,
 ADD COLUMN IF NOT EXISTS condicoes_de_aplicacao text,
 ADD COLUMN IF NOT EXISTS conferencia_textual_em timestamptz,
 ADD COLUMN IF NOT EXISTS calculo_automatico_autorizado boolean NOT NULL DEFAULT false;

-- A fonte da Fazenda paulista informa data do decreto e, separadamente, o DOE 02/09.
UPDATE public.cfop_atos_em_analise SET
 data_assinatura='2026-09-01',
 publicado_em='2026-09-02',
 inicio_efeitos='2026-09-02',
 termino_dispositivo='2026-12-31',
 fonte_url='https://legislacao.fazenda.sp.gov.br/Paginas/Decreto-70842-de-2026.aspx',
 fonte_consolidada_url='https://legislacao.fazenda.sp.gov.br/Paginas/RICMS---Anexo-I---Isen%C3%A7%C3%B5es---Artigo-185.aspx',
 dispositivo='RICMS/SP Anexo I, art. 185, §4º, benefício relativo a Áreas de Livre Comércio',
 tema='Prorrogação da isenção prevista no art. 185 do Anexo I RICMS/SP para certas Áreas de Livre Comércio',
 impacto_potencial='Benefício específico para saídas de produto industrializado ou semielaborado de origem nacional para comercialização/industrialização em Áreas de Livre Comércio indicadas no art. 185, sujeito a requisitos e exclusões. Prazo formal do §4º até 31/12/2026, salvo norma posterior.',
 classe_impacto='isenção_condicionada',
 condicoes_de_aplicacao='Não aplicar isenção generalizada. Exige saída elegível de SP, origem nacional, tipo do produto, município/área de livre comércio, exclusões e demais condições do art. 185/Convênio 52/92, vigência e norma posterior. Benefício não é uma alíquota geral.',
 evidencias='Decreto assinado 01/09/2026 e publicado DOE 02/09/2026; vigência na publicação. Fontes: SEFAZ/SP Decreto 70842 e texto consolidado do art. 185, §4º. Escopo textual verificado; revisão da aplicabilidade tributária ainda pendente.',
 conferencia_textual_em=now(),
 calculo_automatico_autorizado=false
 WHERE uf='SP' AND ato='Decreto 70.842/2026';

UPDATE public.cfop_atos_em_analise SET
 data_assinatura='2026-10-28',
 publicado_em='2026-10-28',
 inicio_efeitos='2026-10-28',
 dispositivo='RICMS/MT Anexo X art. 19-A §2º I, §§3º, 4º-A e 4º-B',
 tema='Credenciamento especial para prazo diferenciado de recolhimento do ICMS-ST em Mato Grosso',
 impacto_potencial='Condições alternativas para autorização: nos três meses anteriores, no conjunto de estabelecimentos em MT do mesmo titular, ao menos 600 NF de aquisição interestadual sujeita a ICMS-ST ou faturamento médio mensal >= 4.000 UPF/MT. Não estabelece alíquota, MVA, pauta nem imunidade.',
 classe_impacto='procedimental_credenciamento_icms_st',
 condicoes_de_aplicacao='Aplicável somente ao contribuinte mato-grossense que requeira e obtenha credenciamento da SEFAZ e satisfaça as condições do art. 19-A. Não calcular imposto, isenção, prazo ou credenciamento automaticamente com base apenas no decreto.',
 fonte_consolidada_url='https://app1.sefaz.mt.gov.br/Sistema/Legislacao/legislacaotribut.nsf/173e6c0d2202fdcb03258b1700659f1e/fc0cab6c66d678ba03258e9f00524232',
 evidencias='SEFAZ/MT informa decreto 2.305/2026 publicado DOE Edição Extra de 28/10/2026, p. 1, vigente na publicação. O próprio portal alerta que seu texto é informativo e o DOE prevalece. Revisar DOE e alterações posteriores antes de automatizar.',
 conferencia_textual_em=now(),
 calculo_automatico_autorizado=false
 WHERE uf='MT' AND ato='Decreto 2.305/2026';

UPDATE public.cfop_atos_em_analise SET
 data_assinatura='2026-02-12',
 publicado_em='2026-02-18',
 inicio_efeitos='2026-02-18',
 dispositivo='RICMS/CE Decreto 33.327/2019, art. 96 §5º e art.94 §3º III revogado',
 tema='Parcelamento específico de DIFAL para destinatário consumidor final não contribuinte',
 impacto_potencial='Decreto limita a 12 parcelas o parcelamento de DIFAL de operações interestaduais para consumidor final não contribuinte quando o contribuinte não é inscrito no CGF do Ceará. Também revoga art. 94 §3º III. Não determina alíquota ou base de cálculo.',
 classe_impacto='procedimental_parcelamento_difal',
 condicoes_de_aplicacao='Depende de operação para consumidor final não contribuinte no Ceará e da condição cadastral do responsável pelo imposto, além das regras de parcelamento. Não gera automaticamente direito ao parcelamento; não substituir o cálculo do DIFAL.',
 fonte_consolidada_url='https://sefazlegis.sefaz.ce.gov.br/api/openFile?id=6e01bfd1-bbd2-49d3-bc27-0d44b5147803',
 evidencias='Decreto 37.145 assinado em 12/02/2026, DOE 18/02/2026 e vigência na publicação, conforme PDF oficial Sefaz Legis. Conteúdo comparado com art.96 §5º da versão consolidada; revisão de normas posteriores ainda pendente.',
 conferencia_textual_em=now(),
 calculo_automatico_autorizado=false
 WHERE uf='CE' AND ato='Decreto 37.145/2026';

-- Preserve revisao_pendente de todos os três: conferência documental não equivale a homologação de regras fiscais.
