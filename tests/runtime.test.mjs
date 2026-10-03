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
