import assert from 'node:assert/strict';
import {createNanapayIdentity} from '../database/identity.mjs';
const restaurantA='11111111-1111-4111-8111-111111111111';
const restaurantB='22222222-2222-4222-8222-222222222222';
const userId='33333333-3333-4333-8333-333333333333';
const memberId='44444444-4444-4444-8444-444444444444';
let role='admin',active=true,requests=[],remoteError=false;
const mock=async (url,args)=>{
 requests.push({url,headers:args.headers});
 if(remoteError)throw Error('secret HTTP issue');
 if(url.endsWith('/auth/v1/user')){
  if(args.headers.Authorization==='Bearer valid-user-token-of-at-least-20-characters')return {ok:true,status:200,json:async()=>({id:userId})};
  return {ok:false,status:401};
 }
 if(url.includes('/rest/v1/nanapay_staff?')){
  const u=new URL(url);
  assert.equal(u.searchParams.get('restaurant_id'),'eq.'+restaurantA,'Tenant filter enforced server-side');
  assert.equal(u.searchParams.get('auth_user_id'),'eq.'+userId,'User filter enforced server-side');
  assert.equal(args.headers.Authorization,'Bearer private-server-key','Database key only used server-side');
  return {ok:true,status:200,json:async()=>active?[{id:memberId,restaurant_id:restaurantA,display_name:'Gerente',active:true,role}]:[]};
 }
 throw Error('Unexpected endpoint');
};
const auth=createNanapayIdentity({url:'https://nanapay-fictitious.supabase.co',publishableKey:'public-key',serviceRoleKey:'private-server-key',fetchImpl:mock});
const bearer='Bearer valid-user-token-of-at-least-20-characters';
const mustReject=async(fn,code)=>assert.rejects(fn,e=>e.http===code);
await mustReject(()=>auth.authorize({authorization:'',restaurantId:restaurantA}),401);
await mustReject(()=>auth.authorize({authorization:bearer,restaurantId:'other'}),400);
await mustReject(()=>auth.authorize({authorization:'Bearer invalid-user-token-of-at-least-20-characters',restaurantId:restaurantA}),401);

// Continuation with correctly isolated responses.
requests.length=0;
const api=async(url,args)=>{
 requests.push({url,headers:args.headers});
 if(remoteError)throw Error('secret HTTP issue');
 if(url.endsWith('/auth/v1/user'))return {ok:true,status:200,json:async()=>({id:userId})};
 if(url.includes('/rest/v1/nanapay_staff?')){
  const u=new URL(url),requested=u.searchParams.get('restaurant_id');
  return {ok:true,status:200,json:async()=>requested==='eq.'+restaurantA&&active?[{id:memberId,restaurant_id:restaurantA,display_name:'Gerente',active:true,role}]:[]};
 }
 throw Error('Unexpected endpoint');
};
const service=createNanapayIdentity({url:'https://nanapay-fictitious.supabase.co',publishableKey:'public-key',serviceRoleKey:'private-server-key',fetchImpl:api});
let result=await service.authorize({authorization:bearer,restaurantId:restaurantA,allowedRoles:['admin']});
assert.equal(result.role,'admin');assert(Object.isFrozen(result));
await mustReject(()=>service.authorize({authorization:bearer,restaurantId:restaurantB}),403);
role='garcom';
result=await service.authorize({authorization:bearer,restaurantId:restaurantA,allowedRoles:['garcom','admin']});
assert.equal(result.role,'garcom');
await mustReject(()=>service.authorize({authorization:bearer,restaurantId:restaurantA,allowedRoles:['admin']}),403);
active=false;
await mustReject(()=>service.authorize({authorization:bearer,restaurantId:restaurantA}),403);
remoteError=true;
try{await service.authorize({authorization:bearer,restaurantId:restaurantA});assert.fail('Should be unavailable');}
catch(e){assert.equal(e.http,503);assert(!e.message.includes('secret HTTP issue'));}
assert(!requests.some(r=>r.url.includes('private-server-key')),'Server secret never used in URL');
console.log('PASS: Nanapay Supabase Auth, tenant isolation, admin/garcom roles, revocation, safe failures');
