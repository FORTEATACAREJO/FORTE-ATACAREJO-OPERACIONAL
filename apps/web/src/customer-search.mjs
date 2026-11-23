import {searchKey} from '../../../supabase/functions/orders-workflow/complements.mjs';

export function customerDisplayName(customer={}){
 const fantasy=String(customer.nomeFantasia||customer.fantasia||'').trim();
 const legal=String(customer.razaoSocial||customer.nome||'').trim();
 if(!fantasy)return legal||'Cliente sem nome';
 if(!legal||searchKey(fantasy)===searchKey(legal))return fantasy;
 return fantasy+' • '+legal;
}

export function customerSearchText(customer={}){
 return [customer.nomeFantasia,customer.fantasia,customer.razaoSocial,customer.nome,
  customer.documento,customer.cpf,customer.cnpj].filter(Boolean).join(' ');
}

export function customerMatches(customer,query){
 return !searchKey(query)||searchKey(customerSearchText(customer)).includes(searchKey(query));
}
