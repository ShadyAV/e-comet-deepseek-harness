import test from 'node:test';
import assert from 'node:assert/strict';
let registerMcpClients;
try { ({ registerMcpClients } = await import('../src/runtime.mjs')); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

const script = `const readline = require('node:readline');
readline.createInterface({input: process.stdin}).on('line', line => {
 const message = JSON.parse(line); if (message.id === undefined) return;
 let result;
 if (message.method === 'initialize') result = {protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'},instructions:'Use fixture contracts before calling browser tools.'};
 else if (message.method === 'tools/list') result = {tools:[{name:'diagnostic',description:'fixture',inputSchema:{type:'object'}}]};
 else if (message.method === 'tools/call') result = {content:[{type:'text',text:JSON.stringify(message.params.arguments)}],structuredContent:message.params.arguments};
 else result = {};
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\\n');
});`;

test('owned MCP bridge registers both namespaces and passes arguments through real stdio', async t => {
  assert.equal(typeof registerMcpClients, 'function', 'native runtime is implemented');
  const definitions = new Map();
  const ctx = { tools: { register(def) { definitions.set(def.name, def); return () => definitions.delete(def.name); } }, logger: { warn() {} } };
  const transport = { command: process.execPath, args: ['-e', script] };
  const mounted = await registerMcpClients(ctx, { adapter: { wrapToolDefinition: d => d }, remote: transport, local: transport });
  t.after(mounted.dispose);
  assert.equal(mounted.statuses.remote, 'connected');
  assert.equal(mounted.statuses.local, 'connected');
  assert.deepEqual([...definitions.keys()].sort(), ['mcp__e-comet-local__diagnostic', 'mcp__e-comet__diagnostic']);
  const definition = definitions.get('mcp__e-comet-local__diagnostic');
  const value = await definition.execute({ hello: 'world' }, { signal: new AbortController().signal });
  assert.deepEqual(value.structuredContent, { hello: 'world' });
  assert.deepEqual(definition.output.render({}, value), [{ type: 'text', text: '{"hello":"world"}' }]);
  await mounted.dispose();
  assert.equal(definitions.size, 0);
});

test('a remote startup failure leaves local diagnostics available and reports safe status', async t => {
  assert.equal(typeof registerMcpClients, 'function', 'native runtime is implemented');
  const definitions = new Map();
  const warnings = [];
  const ctx = { tools: { register(def) { definitions.set(def.name, def); return () => definitions.delete(def.name); } }, logger: { warn(text) { warnings.push(text); } } };
  const mounted = await registerMcpClients(ctx, { adapter: { wrapToolDefinition: d => d }, remote: { command: process.execPath, args: ['-e', 'process.exit(1)'] }, local: { command: process.execPath, args: ['-e', script] } });
  t.after(mounted.dispose);
  assert.equal(mounted.statuses.remote, 'unavailable');
  assert.equal(mounted.statuses.local, 'connected');
  assert.equal(definitions.has('mcp__e-comet-local__diagnostic'), true);
  assert.match(warnings.join(' '), /remote.*unavailable/i);
});

test('server instructions reach the host prompt and resource links retain a usable URI', async t => {
  const sections = [];
  const definitions = new Map();
  const ctx = {
    tools: { register(def) { definitions.set(def.name, def); return () => definitions.delete(def.name); } },
    systemPrompt: { section(section) { sections.push(section); return () => sections.splice(sections.indexOf(section), 1); } },
  };
  const transport = { command: process.execPath, args: ['-e', script] };
  const mounted = await registerMcpClients(ctx, { adapter: { wrapToolDefinition: d => d }, remote: transport, local: transport });
  t.after(mounted.dispose);
  assert.equal(sections.length, 2);
  assert.match(sections[0].text, /fixture contracts/);
  const def = definitions.get('mcp__e-comet-local__diagnostic');
  const rendered = def.output.render({}, { content: [{ type: 'resource_link', name: 'report.xlsx', uri: 'file:///tmp/report.xlsx' }] });
  assert.match(rendered[0].text, /file:\/\/\/tmp\/report.xlsx/);
  await mounted.dispose();
  assert.equal(sections.length, 0);
});

test('partial MCP errors preserve completed exports and safe failure evidence', async t => {
  const partial = { content: [{ type: 'text', text: 'One of two exports completed.' }], isError: true,
    structuredContent: { exports: [{ filter: { isAnswered: true }, status: 'complete', path: '/tmp/report.xlsx' },
      { filter: { isAnswered: false }, status: 'failed', error: { code: 'SELLER_DOWNLOAD_FAILED' } }],
      releaseError: { code: 'SELLER_AUTHORIZATION_RELEASE_FAILED' } } };
  const partialScript = script.replace('result = {content:[{type:\'text\',text:JSON.stringify(message.params.arguments)}],structuredContent:message.params.arguments}', `result = ${JSON.stringify(partial)}`);
  const definitions = new Map();
  const ctx = { tools: { register(def) { definitions.set(def.name, def); return () => definitions.delete(def.name); } } };
  const transport = { command: process.execPath, args: ['-e', partialScript] };
  const mounted = await registerMcpClients(ctx, { adapter: { wrapToolDefinition: d => d }, remote: transport, local: transport });
  t.after(mounted.dispose);
  await assert.rejects(definitions.get('mcp__e-comet-local__diagnostic').execute({}, { signal: new AbortController().signal }), error => {
    assert.match(error.message, /SELLER_DOWNLOAD_FAILED/);
    assert.match(error.message, /SELLER_AUTHORIZATION_RELEASE_FAILED/);
    assert.match(error.message, /isAnswered/);
    assert.match(error.message, /report.xlsx/);
    return true;
  });
});

test('remote account can connect and disconnect later while local diagnostics remain mounted', async t => {
 const definitions = new Map();
 const ctx = { tools: { register(def) { definitions.set(def.name, def); return () => definitions.delete(def.name); } } };
 const transport = { command: process.execPath, args: ['-e', script] };
 const mounted = await registerMcpClients(ctx, { adapter: { wrapToolDefinition: d => d }, remote: transport, local: transport, autoConnectRemote: false });
 t.after(mounted.dispose);
 assert.equal(definitions.has('mcp__e-comet__diagnostic'), false);
 assert.equal(definitions.has('mcp__e-comet-local__diagnostic'), true);
 await mounted.connectRemote(); assert.equal(definitions.has('mcp__e-comet__diagnostic'), true);
 await mounted.disconnectRemote(); assert.equal(definitions.has('mcp__e-comet__diagnostic'), false);
 assert.equal(definitions.has('mcp__e-comet-local__diagnostic'), true);
 await mounted.connectRemote(); assert.equal(definitions.size, 2);
});

test('remote process loss withdraws stale tools while local diagnostics remain available', async t => {
 const definitions = new Map();
 const ctx={tools:{register(def){definitions.set(def.name,def);return()=>definitions.delete(def.name)}}};
 const transport={command:process.execPath,args:['-e',script]};
 const remote={command:process.execPath,args:['-e',script.replace("process.stdout.write(JSON.stringify({jsonrpc:","if(message.method==='tools/call')setTimeout(()=>process.exit(1),10); process.stdout.write(JSON.stringify({jsonrpc:")]};
 const mounted=await registerMcpClients(ctx,{adapter:{wrapToolDefinition:d=>d},remote,local:transport});t.after(mounted.dispose);
 await definitions.get('mcp__e-comet__diagnostic').execute({}, {signal:new AbortController().signal});
 for(let i=0;i<100 && mounted.statuses.remote==='connected';i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(mounted.statuses.remote,'unavailable');assert.equal(definitions.has('mcp__e-comet__diagnostic'),false);assert.equal(definitions.has('mcp__e-comet-local__diagnostic'),true);
});

test('MCP registrations read instructions through an installed Cordis plugin fiber', async t => {
 const { Context }=await import('@deepseek-ai/cordis');
 const { default: SystemPrompt }=await import('@deepseek-ai/dsh-system-prompt');
 const { default: Tools }=await import('@deepseek-ai/dsh-tools');
 const { inject }=await import('../index.mjs');
 const ctx=new Context();t.after(()=>ctx.fiber.dispose());await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);
 let mounted;
 const Plugin={name:'account-native-fixture',inject:inject.filter(key=>key!=='skills'&&key!=='typert'),async apply(pluginCtx){const transport={command:process.execPath,args:['-e',script]};mounted=await registerMcpClients(pluginCtx,{adapter:{wrapToolDefinition:d=>d},remote:transport,local:transport});}};
 await ctx.plugin(Plugin);t.after(()=>mounted.dispose());
 assert.equal(mounted.statuses.local,'connected');assert.equal(mounted.statuses.remote,'connected');
});

test('typed remote login expiry removes remote tools and prompts account reconnect while local remains usable', async t => {
 const definitions=new Map();const ctx={tools:{register(def){definitions.set(def.name,def);return()=>definitions.delete(def.name)}}};
 const expiredScript=script.replace("process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,result})", "process.stdout.write(JSON.stringify(message.method==='tools/call'?{jsonrpc:'2.0',id:message.id,error:{code:-32001,message:'Do not forward provider token',data:{code:'ECOMET_LOGIN_REQUIRED'}}}:{jsonrpc:'2.0',id:message.id,result})");
 const mounted=await registerMcpClients(ctx,{adapter:{wrapToolDefinition:d=>d},remote:{command:process.execPath,args:['-e',expiredScript]},local:{command:process.execPath,args:['-e',script]}});t.after(mounted.dispose);
 const {createAccount}=await import('../src/account.mjs');
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const directory=await mkdtemp(join(tmpdir(),'ecomet-expiry-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const {FileOAuthProvider}=await import('../src/oauth.mjs');await new FileOAuthProvider({directory}).saveTokens({access_token:'only-test-fixture'});
 const account=createAccount({directory,connectRemote:mounted.connectRemote,disconnectRemote:mounted.disconnectRemote,isRemoteConnected:()=>mounted.statuses.remote==='connected'});t.after(account.dispose);await account.initialize();
 assert.equal(account.getStatus().state,'connected');
 await assert.rejects(definitions.get('mcp__e-comet__diagnostic').execute({}, {signal:new AbortController().signal}),error=>{assert.match(error.message,/ECOMET_LOGIN_REQUIRED/);assert.doesNotMatch(error.message,/provider token/);return true;});
 assert.equal(mounted.statuses.remote,'unavailable');assert.equal(definitions.has('mcp__e-comet__diagnostic'),false);
 assert.equal(account.getStatus().state,'error');assert.match(account.getStatus().error,/sign in again/);
 assert.equal((await definitions.get('mcp__e-comet-local__diagnostic').execute({ok:true},{signal:new AbortController().signal})).structuredContent.ok,true);
});
