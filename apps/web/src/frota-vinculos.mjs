// Regras independentes do cadastro fiscal, pagamentos ou habilitação para cargas.
export const plateKey=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export const validPlate=value=>/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plateKey(value));
export const activeLink=link=>link&&link.fim_em==null;
export const vehicleDriver=({links=[],vehicleId})=>links.find(link=>link.veiculo_id===vehicleId&&activeLink(link))||null;
export const activeVehicleForDriver=({links=[],vehicles=[],driverId})=>{
 const link=links.find(x=>x.motorista_operacional_id===driverId&&activeLink(x));
 if(!link)return null;
 const vehicle=vehicles.find(v=>v.id===link.veiculo_id&&v.ativo!==false);
 return vehicle?{link,vehicle}:null;
};
export const canLink=({links=[],vehicleId,driverId,vehicles=[],drivers=[],allowPendingVehicle=false})=>{
 if(!driverId||!drivers.some(m=>m.id===driverId))return {ok:false,reason:'Selecione um motorista existente na base operacional.'};
 const vehicle=vehicles.find(v=>v.id===vehicleId);
 if(!vehicle||vehicle.ativo===false&&!allowPendingVehicle)return {ok:false,reason:'Selecione um veículo cadastrado e ativo na base de veículos.'};
 const current=vehicleDriver({links,vehicleId});
 if(current)return {ok:false,reason:'Esse veículo já está vinculado. Desvincule primeiro; o vínculo anterior ficará no histórico.'};
 const driverLink=links.find(x=>x.motorista_operacional_id===driverId&&activeLink(x));
 if(driverLink)return {ok:false,reason:'Esse motorista já está vinculado a outro veículo. Desvincule antes de associar um novo caminhão.'};
 return {ok:true,reason:''};
};
export const driverName=(drivers,id)=>drivers.find(d=>d.id===id)?.nome||'Cadastro de motorista não encontrado';
