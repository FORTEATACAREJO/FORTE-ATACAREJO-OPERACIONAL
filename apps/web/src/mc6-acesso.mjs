// Porta de engenharia do schema mc6. Não lê o Frete, não grava CAD e não aciona hardware.
export const REF_FRETE_LEGADO='nkynfboqwfxhhxcsrawl';

export function autorizarMc6({sessao={},schema='mc6',comando='ler',projectRef=''}={}){
 if(!sessao?.userId)return {permitido:false,motivo:'login_obrigatorio',esquema:'mc6'};
 if(sessao.origem!=='app_metadata'||sessao.appMetadata?.papel!=='engenharia')return {permitido:false,motivo:'perfil_engenharia_ausente',esquema:'mc6'};
 if(projectRef===REF_FRETE_LEGADO)return {permitido:false,motivo:'projeto_ainda_e_frete_legado',esquema:'mc6'};
 if(schema!=='mc6')return {permitido:false,motivo:'schema_fora_do_mc6',esquema:'mc6'};
 if(/motor|solda|atuador|rel[eé]|gpio|partida/i.test(String(comando||'')))return {permitido:false,motivo:'hardware_sem_validacao',esquema:'mc6'};
 if(comando==='ler')return {permitido:true,motivo:'leitura_mc6',esquema:'mc6',cad:'',hardware:false};
 return {permitido:false,motivo:'comando_nao_permitido',esquema:'mc6'};
}
