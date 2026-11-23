// Regras independentes do cadastro fiscal, pagamentos ou habilitação para cargas.
export const plateKey=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export const validPlate=value=>/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plateKey(value));
export const activeLink=link=>link&&link.fim_em==null;
export const vehicleDriver=({links=[],vehicleId})=>links.find(link=>link.veiculo_id===vehicleId&&activeLink(link))||null;
export const canLink=({links=[],vehicleId,driverId,vehicles=[],drivers=[]})=>{
 if(!driverId||!drivers.some(m=>m.id===driverId))return {ok:false,reason:'Selecione um motorista existente na base operacional.'};
 const vehicle=vehicles.find(v=>v.id===vehicleId);
 if(!vehicle||vehicle.ativo===false)return {ok:false,reason:'Selecione um veículo cadastrado e ativo na base de veículos.'};
 const current=vehicleDriver({links,vehicleId});
 if(current)return {ok:false,reason:'Esse veículo já está vinculado. Desvincule primeiro; o vínculo anterior ficará no histórico.'};
 return {ok:true,reason:''};
};
export const driverName=(drivers,id)=>drivers.find(d=>d.id===id)?.nome||'Cadastro de motorista não encontrado';
