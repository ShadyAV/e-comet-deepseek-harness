import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileOAuthProvider } from '../src/oauth.mjs';
let createAccount;
try { ({ createAccount } = await import('../src/account.mjs')); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND') throw e; }
function fixtureFetch(url, options={}) {
 const target=String(url);
 if(target.includes('oauth-protected-resource')) return Promise.resolve(Response.json({resource:'https://mcp.e-comet.io/',authorization_servers:['https://auth.mcp.e-comet.io/']}));
 if(target.includes('.well-known')) return Promise.resolve(Response.json({issuer:'https://auth.mcp.e-comet.io/',authorization_endpoint:'https://auth.mcp.e-comet.io/authorize',token_endpoint:'https://auth.mcp.e-comet.io/token',registration_endpoint:'https://auth.mcp.e-comet.io/register',response_types_supported:['code'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['client_secret_post']}));
 if(target.endsWith('/register')) return Promise.resolve(Response.json({client_id:'fixture',client_secret:'never-client',redirect_uris:JSON.parse(options.body).redirect_uris,token_endpoint_auth_method:'client_secret_post'}));
 if(target.endsWith('/token')) return Promise.resolve(Response.json({access_token:'never-model',refresh_token:'never-browser',token_type:'Bearer'}));
 throw Error('unexpected');
}
async function setup(t, options={}) {
 assert.equal(typeof createAccount,'function','account lifecycle exists');
 const directory=await mkdtemp(join(tmpdir(),'ecomet-account-'));
 const mounts=[];
 const account=createAccount({directory,fetchImpl:fixtureFetch,connectRemote:async()=>mounts.push('connect'),disconnectRemote:async()=>mounts.push('disconnect'),...options});
 t.after(async()=>{await account.dispose(); await rm(directory,{recursive:true,force:true});});
 await account.initialize();
 return {account,directory,mounts};
}
async function terminal(account){for(let i=0;i<100;i++){const status=account.getStatus(); if(status.state!=='connecting')return status;await new Promise(r=>setTimeout(r,10));}throw Error('account did not settle');}
test('login returns PKCE URL before callback and mounts remote tools without restart',async t=>{
 const {account,directory,mounts}=await setup(t);
 assert.deepEqual(account.getStatus(),{state:'logged_out'});
 const started=await account.startLogin();
 const url=new URL(started.authorizationUrl);
 assert.equal(started.state,'connecting');assert.equal(url.origin,'https://auth.mcp.e-comet.io');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.equal(JSON.stringify(account.getStatus()).includes('never'),false);
 await fetch(`${url.searchParams.get('redirect_uri')}?state=${url.searchParams.get('state')}&code=accepted`);
 assert.deepEqual(await terminal(account),{state:'connected'});assert.deepEqual(mounts,['connect']);
 assert.equal((await new FileOAuthProvider({directory}).tokens()).access_token,'never-model');
 await account.disconnect();assert.deepEqual(account.getStatus(),{state:'logged_out'});assert.equal(await new FileOAuthProvider({directory}).tokens(),undefined);assert.deepEqual(mounts,['connect','disconnect']);
});
test('cancel closes callback and cannot save credentials or connect later',async t=>{
 const {account,directory,mounts}=await setup(t);
 const started=await account.startLogin();const url=new URL(started.authorizationUrl);
 await account.cancelLogin();assert.deepEqual(account.getStatus(),{state:'logged_out'});
 await assert.rejects(fetch(url.searchParams.get('redirect_uri')));
 assert.equal(await new FileOAuthProvider({directory}).tokens(),undefined);assert.deepEqual(mounts,[]);
 const second=await account.startLogin();assert.notEqual(second.authorizationUrl,started.authorizationUrl);
});
test('decline and timeout produce safe errors and allow explicit new attempt',async t=>{
 const {account}=await setup(t,{timeoutMs:500});
 const started=await account.startLogin();const url=new URL(started.authorizationUrl);
 await fetch(`${url.searchParams.get('redirect_uri')}?state=${url.searchParams.get('state')}&error=access_denied&error_description=never-client`);
 assert.deepEqual(await terminal(account),{state:'error',error:'Authorization was declined. Try connecting again.'});
 await account.startLogin();assert.deepEqual(await terminal(account),{state:'error',error:'Connection timed out. Try connecting again.'});
});
test('stored credentials reconnect at startup but connection failure never launches login',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'ecomet-restored-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));await new FileOAuthProvider({directory}).saveTokens({access_token:'never'});
 const account=createAccount({directory,connectRemote:async()=>{throw Error('never-secret')},disconnectRemote:async()=>{}});
 t.after(()=>account.dispose());await account.initialize();
 assert.deepEqual(account.getStatus(),{state:'error',error:'e-Comet could not connect. Check your connection or sign in again.'});
});

test('installed native Typert gateway exposes account RPC without registering model tools', async t => {
 const { Context } = await import('@deepseek-ai/cordis');
 const { default: Registry } = await import('@deepseek-ai/dsh-typert-registry');
 const { default: Gateway } = await import('@deepseek-ai/dsh-api-gateway');
 let AccountService; try { ({ AccountService }=await import('../src/account-service.mjs')); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND') throw e; }
 assert.equal(typeof AccountService,'function');
 const ctx=new Context();t.after(()=>ctx.fiber.dispose());
 await ctx.plugin(Registry);await ctx.plugin(Gateway,{websocketHeartbeatIntervalMs:2000,streamInboxBytes:262144});
 await ctx.plugin(AccountService,{account:{getStatus:()=>({state:'logged_out'}),startLogin:()=>({state:'connecting',authorizationUrl:'https://auth.mcp.e-comet.io/authorize'}),cancelLogin:()=>({state:'logged_out'}),disconnect:()=>({state:'logged_out'})}});
 const value=await ctx.typertGateway.invoke({namespace:'eCometAccount',method:'getStatus',args:{}});
 assert.deepEqual(value,{state:'logged_out'});
 await assert.rejects(ctx.typertGateway.invoke({namespace:'eCometAccount',method:'startLogin',args:{authorization:'forged'}}),e=>e.code==='gateway/arguments-invalid');
});


test('OAuth deadline also ends hung discovery before an authorization URL exists', async t=>{
 const {account}=await setup(t,{timeoutMs:50,fetchImpl:(_input,options)=>new Promise((_resolve,reject)=>{if(options.signal.aborted)reject(options.signal.reason);else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});})});
 assert.deepEqual(await account.startLogin(),{state:'error',error:'Connection timed out. Try connecting again.'});
});
