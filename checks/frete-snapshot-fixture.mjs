import {CENSO_CAPTURA,ORIGEM_REF,STATUS_CAPTURA} from '../apps/web/src/frete-snapshot.mjs';

export const empresaId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const uuid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const checksum='ab'.repeat(16);
let seq=3000;
const linhas=qtd=>Array.from({length:qtd},()=>({id:uuid(seq++)}));

export function motoristasSinteticos(){
 return Array.from({length:23},(_,index)=>{
  const i=index+1;
  const row={id:uuid(i),nome:`Motorista Sintético ${i}`,updated_at:'2026-11-01T00:00:00Z',status_cadastro:'INCOMPLETO'};
  if(i<=15)row.cpf=String(10000000000+i);
  if(i<=17)row.telefone=`3498888${String(1000+i).slice(-4)}`;
  if(i<=9)row.cnh_registro=`CNH${1000+i}`;
  if(i<=11)row.proprietario_nome=`Proprietario ${i}`;
  if(i<=15)row.chave_pix=`pix-sintetico-${i}`;
  if(i<=14)row.titular_pix=`Titular ${i}`;
  if(i===8)row.senha='nao-copiar';
  if(i===20)row.chave_pix='NÃO INFORMADO';
  return row;
 });
}
export function veiculosSinteticos(){
 return [
  {id:uuid(101),motorista_id:uuid(1),placa:'ABC1D23',tipo:'TRUCK',capacidade_efetiva_t:40,proprietario_nome:'Proprietario 1'},
  {id:uuid(102),motorista_id:uuid(2),placa:'DEF2G34',tipo:'TRUCK',capacidade_efetiva_t:'32.0'}
 ];
}
export function loteSintetico(){
 seq=3000;
 const porTabela={
  'public.access_audit':linhas(23),
  'public.access_invites':[{id:uuid(seq++),codigo:'convite-segredo'},...linhas(11)],
  'public.access_notifications':linhas(9),
  'public.access_requests':linhas(3),
  'public.chaves_pix_frete':[{id:uuid(901),favorecido_id:uuid(910),chave:'pix-vinculo-real',tipo:'EVP'}],
  'public.configuracoes':linhas(1),
  'public.convites_motorista':[{id:uuid(902),codigo:'codigo-segredo',target_phone:'34999990000'}],
  'public.documentos_motorista':[{id:uuid(301),motorista_id:uuid(1),tipo:'CNH',arquivo_path:'motorista-documentos/sintetico/cnh.pdf',dados_extraidos:{texto:'ocr'}}],
  'public.documentos_veiculo':Array.from({length:5},(_,i)=>({id:uuid(310+i),veiculo_id:uuid(101),tipo:'CRLV',arquivo_path:`motorista-documentos/sintetico/crlv-${i}.pdf`})),
  'public.driver_onboarding':linhas(1),
  'public.favorecidos_frete':[{id:uuid(910),nome:'Favorecido Vinculo',cpf_cnpj:'12345678901'}],
  'public.forte_legal_acceptance_events':linhas(2),
  'public.forte_legal_term_versions':linhas(1),
  'public.forte_push_subscriptions':[{id:uuid(700),user_id:uuid(501),app:'frete',endpoint:'https://push.example/secreto',subscription:{token:'abc'},last_signature:'sig',updated_at:'2026-11-09T20:00:00.000Z'}],
  'public.motorista_veiculo_vinculos':[{id:uuid(601),motorista_id:uuid(1),veiculo_id:uuid(101)},{id:uuid(602),motorista_id:uuid(2),veiculo_id:uuid(102)}],
  'public.motoristas':motoristasSinteticos(),
  'public.password_recovery_limits':Array.from({length:52},(_,i)=>({id:uuid(800+i),token:'tok-segredo'})),
  'public.registration_dossiers':linhas(1),
  'public.rotas':Array.from({length:5},(_,i)=>({id:uuid(200+i),nome:`Rota ${i+1}`,origem_cidade:'Uberlandia',origem_uf:'MG',destinos:i===4?[]:['Sao Paulo']})),
  'public.usuarios_app':Array.from({length:4},(_,i)=>({id:uuid(400+i),user_id:uuid(500+i),perfil:i===0?'ADMIN':'MOTORISTA',nome:`Usuario ${i+1}`,...(i===3?{encrypted_password:'hash-falso'}:{})})),
  'public.veiculos_motorista':veiculosSinteticos()
 };
 return Object.entries(CENSO_CAPTURA).map(([source_table,source_count])=>{
  const records=porTabela[source_table]||[];
  if(records.length!==source_count)throw new Error(`${source_table}: ${records.length}!=${source_count}`);
  return {source_project_ref:ORIGEM_REF,source_table,records,source_count,source_checksum:checksum,copied_at:'2026-11-09T20:58:42.418Z',status:STATUS_CAPTURA};
 });
}
export function bucketsSinteticos(){
 return [
  {id:'forte-frete-cadastros',public:false,objetos:0},
  {id:'motorista-documentos',public:false,objetos:6},
  {id:'vendas-ordens-frete',public:false,objetos:0}
 ];
}
export function objetosSinteticos(){
 return Array.from({length:6},(_,i)=>({bucket:'motorista-documentos',path:`sintetico/arquivo-${i}.pdf`,sha256:(i+1).toString(16).padStart(64,'a')}));
}
