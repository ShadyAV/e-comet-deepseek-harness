import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { InvalidGrantError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { McpError, ListToolsRequestSchema, ListToolsResultSchema, CallToolRequestSchema, CallToolResultSchema, ListResourcesRequestSchema, ListResourcesResultSchema, ReadResourceRequestSchema, ReadResourceResultSchema, ListResourceTemplatesRequestSchema, ListResourceTemplatesResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { FileOAuthProvider, REMOTE_URL, createTrustedFetch, LoginRequiredError } from './oauth.mjs';
export { LoginRequiredError } from './oauth.mjs';

// Match the native adapter's two-hour tool budget.
export const LONG_TOOL_TIMEOUT_MS = 7_200_000;
const DISCOVERY_TIMEOUT_MS = 60_000;

export async function connectRemote(provider, { fetchImpl = createTrustedFetch() } = {}) {
  const client = new Client({ name: 'e-comet-deepseek-harness', version: '0.2.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(REMOTE_URL), { authProvider: provider, fetch: fetchImpl });
  try { await client.connect(transport); return client; }
  catch (error) { await client.close().catch(() => {}); if (error instanceof UnauthorizedError || error instanceof LoginRequiredError) throw new LoginRequiredError(); throw error; }
}

/** Forward full results to the trusted native adapter. It controls model-visible redaction. */
export async function createRemoteProxy(provider = new FileOAuthProvider(), { client: suppliedClient } = {}) {
  if (!(await provider.tokens())?.access_token) throw new LoginRequiredError();
  const client = suppliedClient ?? await connectRemote(provider);
  const capabilities = client.getServerCapabilities() ?? {};
  const server = new Server({ name: 'e-comet-remote-proxy', version: '0.2.0' }, {
    capabilities: { ...(capabilities.tools ? { tools: {} } : {}), ...(capabilities.resources ? { resources: {} } : {}) },
    instructions: client.getInstructions(),
  });
  const pairs = [
    ...(capabilities.tools ? [[ListToolsRequestSchema, ListToolsResultSchema], [CallToolRequestSchema, CallToolResultSchema]] : []),
    ...(capabilities.resources ? [[ListResourcesRequestSchema, ListResourcesResultSchema], [ReadResourceRequestSchema, ReadResourceResultSchema], [ListResourceTemplatesRequestSchema, ListResourceTemplatesResultSchema]] : []),
  ];
  for (const [requestSchema, resultSchema] of pairs) {
    server.setRequestHandler(requestSchema, async (request, extra) => {
      try {
        return await client.request(request, resultSchema, {
          signal: extra.signal,
          timeout: request.method === 'tools/call' ? LONG_TOOL_TIMEOUT_MS : DISCOVERY_TIMEOUT_MS,
          maxTotalTimeout: request.method === 'tools/call' ? LONG_TOOL_TIMEOUT_MS : DISCOVERY_TIMEOUT_MS,
          resetTimeoutOnProgress: true,
        });
      } catch (error) {
        if (error instanceof LoginRequiredError || error instanceof UnauthorizedError || error instanceof InvalidGrantError) {
          throw new McpError(-32001, 'Open e-Comet in the app sidebar and reconnect your account.', { code: 'ECOMET_LOGIN_REQUIRED' });
        }
        throw error;
      }
    });
  }
  server.onclose = () => { void client.close(); };
  return { server, client };
}

export async function main() {
  const { server, client } = await createRemoteProxy();
  const shutdown = async () => { await server.close(); await client.close(); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof LoginRequiredError ? error.message : 'e-Comet remote connection failed. Open e-Comet in the app sidebar to check your account connection.'); process.exitCode = 1; });
}
