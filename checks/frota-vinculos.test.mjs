import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validPlate,plateKey,activeLink,vehicleDriver,canLink} from '../apps/web/src/frota-vinculos.mjs';
const drivers=[{id:'m1',nome:'Motorista antigo',ativo:false},{id:'m2',nome:'Motorista novo',ativo:false}];
const vehicles=[{id:'v1',placa:'AAA1B23',ativo:true},{id:'v2',placa:'BBB1234',ativo:true}];
const past={id:'l0',veiculo_id:'v1',motorista_operacional_id:'m1',inicio_em:'2026-01-01',fim_em:'2026-09-20'};
const current={id:'l1',veiculo_id:'v1',motorista_operacional_id:'m2',inicio_em:'2026-09-21',fim_em:null};
test('cavalo, carreta e motorista permanecem cadastros separados',()=>{
 assert.equal(plateKey('aaa-1b23'),'AAA1B23');
 assert(validPlate('AAA1B23'));
 assert(validPlate('BBB1234'));
 assert(!validPlate('AAA123'));
});
test('mesmo caminhão pode ter motoristas diferentes ao longo do tempo',()=>{
 assert.equal(activeLink(past),false);
 assert.equal(activeLink(current),true);
 assert.equal(vehicleDriver({links:[past,current],vehicleId:'v1'}).motorista_operacional_id,'m2');
 assert.deepEqual(canLink({links:[past],vehicleId:'v1',driverId:'m2',vehicles,drivers}),{ok:true,reason:''});
 assert.equal(canLink({links:[past,current],vehicleId:'v1',driverId:'m1',vehicles,drivers}).ok,false);
 assert.deepEqual(canLink({links:[current],vehicleId:'v2',driverId:'m1',vehicles,drivers}),{ok:true,reason:''});
});
test('não permite vincular motorista inexistente, veículo inexistente ou inativo',()=>{
 assert.equal(canLink({links:[],vehicleId:'v1',driverId:'desconhecido',drivers,vehicles}).ok,false);
 assert.equal(canLink({links:[],vehicleId:'ausente',driverId:'m1',drivers,vehicles}).ok,false);
 assert.equal(canLink({links:[],vehicleId:'v2',driverId:'m1',drivers,vehicles:[{...vehicles[1],ativo:false}]}).ok,false);
});
