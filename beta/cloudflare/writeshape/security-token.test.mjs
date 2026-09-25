import {test} from 'node:test';import assert from 'node:assert/strict';import {identity} from './worker.mjs';
test('signed identity accepts valid token and rejects wrong audience, expiry, identity and signature',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test';
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
 const env={ACCESS_TEAM:'test',ACCESS_AUD:'app',TESTER_EMAIL:'owner@example.test'};
 const claims={iss:'https://test.cloudflareaccess.com',aud:['app'],exp:Date.now()/1000+600,sub:'owner',email:'owner@example.test'};
 const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 async function req(c){const text=enc({alg:'RS256',kid:'test'})+'.'+enc(c);const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(text));return new Request('https://writeshape.com',{headers:{'Cf-Access-Jwt-Assertion':text+'.'+Buffer.from(sig).toString('base64url')}});}
 try {assert.equal((await identity(await req(claims),env)).id,'owner');for(const change of [{aud:['other']},{exp:1},{email:'other@example.test'},{iss:'https://attacker.test'}])await assert.rejects(()=>req({...claims,...change}).then(r=>identity(r,env)));const bad=await req(claims);bad.headers.set('Cf-Access-Jwt-Assertion',bad.headers.get('Cf-Access-Jwt-Assertion').slice(0,-8)+'aaaaaaaa');await assert.rejects(()=>identity(bad,env));}finally{globalThis.fetch=original;}
});
