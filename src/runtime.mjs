import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function renderMcp(_args, value) {
  const content = Array.isArray(value?.content) ? value.content : [];
  const projected = content.map(block => {
    if (block?.type === 'text' && typeof block.text === 'string') return { type: 'text', text: block.text };
    if (block?.type === 'resource_link' && typeof block.uri === 'string') {
      return { type: 'text', text: `MCP resource: ${JSON.stringify({ name: block.name, uri: block.uri, mimeType: block.mimeType })}` };
    }
    return { type: 'text', text: `[MCP ${block?.type ?? 'unknown'} content is available in the canonical tool result]` };
  });
  return projected.length ? projected : [{ type: 'text', text: '(No text content returned.)' }];
}

/** Owned registrations keep the private handoff inside the actual MCP call body. */
export async function registerMcpClients(ctx, { adapter, remote, local, autoConnectRemote = true }) {
  const connections = new Map();
  const statuses = { remote: 'disconnected' };
  let disposed = false;
  let remoteChange = Promise.resolve();
  async function unmount(kind) {
    const connection = connections.get(kind);
    connections.delete(kind);
    if (connection) {
      for (const unregister of connection.owned.reverse()) unregister();
      await connection.client.close().catch(() => {});
    }
    statuses[kind] = 'disconnected';
  }
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    await remoteChange.catch(() => {});
    await Promise.allSettled([...connections.keys()].map(unmount));
  };

  async function mount(kind, namespace, options) {
    const client = new Client({ name: 'e-comet-deepseek-harness', version: '0.2.0' }, { capabilities: {} });
    const owned = [];
    try {
      const transport = new StdioClientTransport({ ...options, stderr: 'inherit' });
      await client.connect(transport);
      const instructions = client.getInstructions();
      if (instructions && ctx.systemPrompt) {
        owned.push(ctx.systemPrompt.section({ name: `e-comet:${kind}:instructions`, order: 180, text: instructions }));
      }
      const tools = [];
      const cursors = new Set();
      let cursor;
      do {
        const page = await client.listTools(cursor === undefined ? {} : { cursor });
        tools.push(...page.tools);
        cursor = page.nextCursor;
        if (cursor !== undefined && cursors.has(cursor)) throw new Error('Repeated tool-list cursor');
        if (cursor !== undefined) cursors.add(cursor);
      } while (cursor !== undefined);
      for (const tool of tools) {
        const name = `mcp__${namespace}__${tool.name}`;
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) throw new Error('Unsupported tool name');
        const definition = adapter.wrapToolDefinition({
          name, description: tool.description ?? tool.name, parameters: tool.inputSchema,
          timeoutMs: 7_200_000,
          output: { schema: {}, render: renderMcp },
          async execute(args, exec) {
            let result;
            try { result = await client.callTool({ name: tool.name, arguments: args }, undefined, { signal: exec.signal, timeout: 7_200_000, resetTimeoutOnProgress: true }); }
            catch (error) {
              if (kind === 'remote' && error.code === -32001 && error.data?.code === 'ECOMET_LOGIN_REQUIRED') {
                if (connections.get(kind)?.client === client) {
                  connections.delete(kind);
                  for (const unregister of owned.reverse()) unregister();
                  statuses[kind] = 'unavailable';
                  await client.close().catch(() => {});
                }
                throw new Error('ECOMET_LOGIN_REQUIRED: Open e-Comet in the app sidebar and reconnect your account.');
              }
              throw new Error(`MCP_CALL_FAILED: ${kind} e-Comet connection could not complete this call. Check connection diagnostics before retrying.`);
            }
            if (result.isError === true) {
              // Remote browser-job failures must not accidentally echo authorization.
              if (kind === 'remote' && tool.name === 'browser_job') throw new Error('BROWSER_JOB_FAILED: The remote service did not grant browser authorization. Check the remote connection and service diagnostics.');
              // A failed package may still contain completed artifacts and per-filter
              // failures. Preserve that evidence so recovery cannot repeat completed work.
              const evidence = result.structuredContent === undefined ? '' : `\nStructured MCP evidence: ${JSON.stringify(result.structuredContent)}`;
              throw new Error(renderMcp(args, result).map(block => block.text).join('\n') + evidence);
            }
            return { content: result.content, ...(result.structuredContent === undefined ? {} : { structuredContent: result.structuredContent }) };
          },
        });
        owned.push(ctx.tools.register(definition));
      }
      connections.set(kind, { client, owned });
      statuses[kind] = 'connected';
      client.onclose = () => {
        if (connections.get(kind)?.client !== client) return;
        connections.delete(kind);
        for (const unregister of owned.reverse()) unregister();
        statuses[kind] = 'unavailable';
      };
    } catch {
      for (const unregister of owned.reverse()) unregister();
      await client.close().catch(() => {});
      statuses[kind] = 'unavailable';
      ctx.logger?.warn(`e-Comet ${kind} MCP is unavailable. Inspect that connection's process diagnostics; the other connection remains independent.`);
    }
  }

  function connectRemote() {
    remoteChange = remoteChange.catch(() => {}).then(async () => {
      if (disposed) throw new Error('e-Comet integration has stopped.');
      if (connections.has('remote')) return;
      await mount('remote', 'e-comet', remote);
      if (statuses.remote !== 'connected') throw new Error('e-Comet remote MCP is unavailable.');
    });
    return remoteChange;
  }
  function disconnectRemote() {
    remoteChange = remoteChange.catch(() => {}).then(() => unmount('remote'));
    return remoteChange;
  }
  await Promise.all([...(autoConnectRemote ? [mount('remote', 'e-comet', remote)] : []), mount('local', 'e-comet-local', local)]);
  return { dispose, statuses, connectRemote, disconnectRemote };
}
