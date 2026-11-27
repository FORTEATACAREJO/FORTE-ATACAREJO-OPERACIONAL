import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../apps/web/src/',import.meta.url);
const directory=readFileSync(new URL('DriverDirectory.jsx',root),'utf8');
const fleet=readFileSync(new URL('FleetLinkManager.jsx',root),'utf8');

test('apenas dois cadastros visíveis, motorista e veículo',()=>{
 assert.match(directory,/\['motoristas','Motoristas'\],\['veiculos','Veículos'\]/);
 assert.doesNotMatch(directory,/\['cadastros','Veículos e transportadoras'\]/);
 assert.doesNotMatch(directory,/\['vinculos','Vincular \/ desvincular'\]/);
 assert.match(directory,/view==='veiculos'&&<FleetLinkManager/);
});
test('transportadora fica na mesma ficha do veículo e pode ser editada',()=>{
 assert.match(fleet,/Cadastro do veículo com transportadora/);
 assert.match(fleet,/Transportadora \(opcional\)/);
 assert.match(fleet,/p_transportadora:\{nome:vehicle\.transportadora_nome/);
 assert.match(fleet,/fc_gravar_ficha_veiculo/);
 assert.match(directory,/fc_gravar_cadastro_conjunto/);
 assert.doesNotMatch(fleet,/CADASTRAR TRANSPORTADORA|Cadastro independente de transportadoras/);
 assert.doesNotMatch(fleet,/\.from\('fc_transportadoras'\)\.insert/);
});
test('vínculo usa o motorista escolhido e transportadora do veículo, sem substituir histórico',()=>{
 assert.match(fleet,/transportadora_nome_snapshot:selectedVehicle\.transportadora_nome/);
 assert.match(fleet,/transportadora_cnpj_snapshot:selectedVehicle\.transportadora_cnpj/);
 assert.match(fleet,/motorista_operacional_id:choice\.motorista_operacional_id/);
 assert.match(fleet,/DESVINCULAR E MANTER HISTÓRICO/);
 assert.match(fleet,/\.is\('fim_em',null\)/);
 assert.doesNotMatch(fleet,/<label>Transportadora<select/);
});
