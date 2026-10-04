import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteProxy, LoginRequiredError } from '../src/remote-proxy.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';

test('stdio server forwarding preserves schemas, instructions, raw tool results and resources', async () => {
  const tools = [{ name: 'fixture', description: 'exact description', inputSchema: { type: 'object', properties: { argument: { type: 'string', enum: ['a'] } }, required: ['argument'], additionalProperties: false } }];
  const result = { content: [{ type: 'text', text: '{"browser_job":{"token":"native-only"}}' }], _meta: { fixture: true }, structuredContent: { accepted: true }, extensionField: { exact: true } };
  const upstream = new Server({ name: 'fixture', version: '1' }, { capabilities: { tools: {}, resources: {} }, instructions: 'Upstream instruction' });
  upstream.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  upstream.setRequestHandler(CallToolRequestSchema, async request => { assert.deepEqual(request.params.arguments, { argument: 'a' }); return result; });
  upstream.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ uri: 'fixture://resource', name: 'resource' }] }));
  upstream.setRequestHandler(ReadResourceRequestSchema, async () => ({ contents: [{ uri: 'fixture://resource', text: 'exact content' }] }));
  const [remoteTransport, fixtureTransport] = InMemoryTransport.createLinkedPair();
  const remote = new Client({ name: 'proxy-test', version: '1' });
  const forwarded = [];
  const actualRequest = remote.request.bind(remote);
  remote.request = (request, schema, options) => { forwarded.push({ method: request.method, options }); return actualRequest(request, schema, options); };
  await upstream.connect(fixtureTransport);
  await remote.connect(remoteTransport);
  const { server } = await createRemoteProxy({ tokens: async () => ({ access_token: 'fixture' }) }, { client: remote });
  const [callerTransport, proxyTransport] = InMemoryTransport.createLinkedPair();
  const caller = new Client({ name: 'caller', version: '1' });
  try {
    await server.connect(proxyTransport);
    await caller.connect(callerTransport);
    assert.equal(caller.getInstructions(), 'Upstream instruction');
    assert.deepEqual((await caller.listTools()).tools, tools);
    assert.deepEqual(await caller.callTool({ name: 'fixture', arguments: { argument: 'a' } }), result);
    assert.equal((await caller.listResources()).resources[0].uri, 'fixture://resource');
    assert.equal((await caller.readResource({ uri: 'fixture://resource' })).contents[0].text, 'exact content');
    const toolOptions = forwarded.find(request => request.method === 'tools/call').options;
    assert.equal(toolOptions.timeout, 7_200_000);
    assert.equal(toolOptions.maxTotalTimeout, 7_200_000);
    assert.equal(toolOptions.resetTimeoutOnProgress, true);
    assert.equal(forwarded.find(request => request.method === 'tools/list').options.timeout, 60_000);
  } finally { await caller.close(); await server.close(); await remote.close(); await upstream.close(); }
});

test('unauthorized proxy discovery fails immediately with a supported login action', async () => {
  await assert.rejects(createRemoteProxy({ tokens: async () => undefined }), error => error instanceof LoginRequiredError && /connect/.test(error.message));
});

test('login expiry crosses the MCP boundary as a safe typed error', async t => {
 const remote = {
  getServerCapabilities:()=>({tools:{}}),getInstructions:()=>undefined,close:async()=>{},
  request:async()=>{throw new LoginRequiredError();},
 };
 const {server}=await createRemoteProxy({tokens:async()=>({access_token:'fixture-never-user'})},{client:remote});
 const [callerTransport,proxyTransport]=InMemoryTransport.createLinkedPair();
 const caller=new Client({name:'expired-login-fixture',version:'1'});
 t.after(async()=>{await caller.close();await server.close();});
 await server.connect(proxyTransport);await caller.connect(callerTransport);
 await assert.rejects(caller.callTool({name:'fixture',arguments:{}}),error=>{
  assert.equal(error.code,-32001);assert.deepEqual(error.data,{code:'ECOMET_LOGIN_REQUIRED'});
  assert.match(error.message,/account|sidebar/i);assert.doesNotMatch(error.message,/terminal|restart|token/i);
  return true;
 });
});
