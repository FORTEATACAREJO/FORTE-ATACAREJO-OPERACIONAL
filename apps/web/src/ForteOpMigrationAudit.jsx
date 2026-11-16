import {useEffect,useState} from 'react';
import {supabase} from './supabase.js';

export default function ForteOpMigrationAudit(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  async function load(){
    if(!supabase)return;
    setLoading(true);setError('');
    try{
      const [identidades,origens,files,destino,pendentes,rotas,veiculos]=await Promise.all([
        supabase.from('forte_op_frete_identidades').select('perfil_anterior,situacao,confere_cpf,revisao_aprovada'),
        supabase.from('forte_op_frete_legado').select('id_origem',{head:true,count:'exact'}).eq('tabela_origem','storage_objects'),
        supabase.from('forte_op_frete_storage_integridade').select('id',{head:true,count:'exact'}),
        supabase.from('forte_op_frete_legado').select('id_origem',{head:true,count:'exact'}).eq('tabela_origem','motoristas'),
        supabase.from('forte_op_motoristas_pendentes').select('source_id,situacao,requisitos_pendentes,veiculo_origem_id').limit(150),
        supabase.from('forte_op_frete_rotas').select('source_id',{head:true,count:'exact'}),
        supabase.from('fc_veiculos').select('id,ativo').limit(200)
      ]);
      const failures=[identidades,origens,files,destino,pendentes,rotas,veiculos].filter(r=>r.error);
      if(failures.length)throw Error('Não foi possível consultar o painel protegido: '+failures[0].error.message);
      const entries=identidades.data||[];
      const pending=entries.filter(x=>x.situacao==='SEM_CORRESPONDENCIA');
      const linked=entries.filter(x=>x.confere_cpf===true);
      setData({
        totalIdentidades:entries.length,
        vinculadas:linked.length,
        pendentes:pending.reduce((obj,x)=>(obj[x.perfil_anterior]=(obj[x.perfil_anterior]||0)+1,obj),{}),
        usuariosPendenteValidacao:entries.filter(x=>!x.revisao_aprovada).length,
        documentosOrigem:origens.count||0,
        documentosConferidos:files.count||0,
        motoristasAntigos:destino.count||0,
        motoristasEmRevisao:pendentes.data?.filter(x=>x.situacao==='PENDENTE_DOCUMENTOS').length||0,
        motoristasConvertidos:pendentes.data?.filter(x=>x.situacao==='CADASTRO_INATIVO').length||0,
        motoristasRelacionados:pendentes.data?.filter(x=>x.veiculo_origem_id).length||0,
        motoristasPendentesRequisitos:pendentes.data?.reduce((n,x)=>n+(x.requisitos_pendentes||[]).length,0)||0,
        rotas:rotas.count||0,
        veiculos:veiculos.data?.length||0,
        veiculosInativos:veiculos.data?.filter(x=>x.ativo===false).length||0
      });
    }catch(e){setError(e.message||'Consulta indisponível.')}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  return <section aria-label="Auditoria da migração do antigo Frete" style={{marginTop:18,padding:14,border:'1px solid #aeb7c4',borderRadius:10}}>
    <h3>Auditoria da migração FORTE-OP</h3>
    <p>Dados preservados e pendências de homologação. Esta consulta não aprova usuários, motoristas ou veículos automaticamente.</p>
    <button type="button" onClick={load} disabled={loading}>{loading?'CONFERINDO…':'ATUALIZAR CONFERÊNCIA'}</button>
    {error&&<p role="alert">{error}</p>}
    {data&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:10,marginTop:10}}>
        <p><b>Motoristas migrados</b><span style={{display:'block'}}>{data.motoristasEmRevisao} em revisão de {data.motoristasAntigos} registros · {data.motoristasConvertidos} cadastros definitivos inativos</span></p>
        <p><b>Rotas internas</b><span style={{display:'block'}}>{data.rotas} importadas</span></p>
        <p><b>Veículos</b><span style={{display:'block'}}>{data.veiculosInativos} inativos de {data.veiculos} · {data.motoristasRelacionados} vínculos de origem para conferência</span></p>
        <p><b>Documentos privados</b><span style={{display:'block'}}>{data.documentosConferidos}/{data.documentosOrigem} transferidos e verificados</span></p>
        <p><b>Identidades antigas</b><span style={{display:'block'}}>{data.vinculadas}/{data.totalIdentidades} com CPF correspondente</span></p>
        <p><b>Revisão de contas</b><span style={{display:'block'}}>{data.usuariosPendenteValidacao} sem homologação administrativa da migração</span></p>
        <p><b>Itens documentais ou cadastrais</b><span style={{display:'block'}}>{data.motoristasPendentesRequisitos} requisitos em aberto entre os motoristas</span></p>
      </div>
      {Object.keys(data.pendentes).length>0&&<p role="status"><b>Identidades sem correspondência: </b>{Object.entries(data.pendentes).map(([r,n])=>r+': '+n).join(' · ')}. Regularize no cadastro de usuários sem copiar credenciais.</p>}
      {data.documentosConferidos!==data.documentosOrigem&&<p><b>Arquivos:</b> os anexos ainda estão no armazenamento privado antigo. O histórico dos arquivos não é uma cópia física; não libere dados de CNH sem conferi-los.</p>}
      <p><b>Critério de conclusão:</b> arquivos verificados por hash, identidades conciliadas, documentos válidos, motoristas e veículos aprovados pelos responsáveis e testes funcionais concluídos.</p>
    </>}
  </section>;
}
