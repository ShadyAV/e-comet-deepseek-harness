import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as filesystemSkills from '@deepseek-ai/dsh-skill-filesystem';
import { createAdapter, installAdapter } from './src/adapter.mjs';
import { registerMcpClients } from './src/runtime.mjs';
import { createAccount } from './src/account.mjs';
import { AccountService } from './src/account-service.mjs';

export const name = 'e-comet-integration';
export const inject = ['tools', 'skills', 'systemPrompt', 'typert'];

export async function apply(ctx) {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const dataDirectory = join(homedir(), '.e-comet-deepseek-harness', 'handoff');
  const adapter = createAdapter({ dataDirectory });
  installAdapter(ctx, adapter);
  ctx.plugin(filesystemSkills, {
    providerName: 'e-comet',
    includeDefaultRoots: false,
    customSkillDirs: [join(root, 'skills')],
    watch: false,
  });
  const env = { PLUGIN_DATA: dataDirectory, ELECTRON_RUN_AS_NODE: '1' };
  const runtime = await registerMcpClients(ctx, {
    adapter,
    remote: { command: process.execPath, args: [join(root, 'src', 'remote-proxy.mjs')], env, cwd: root },
    local: { command: process.execPath, args: [join(root, 'vendor', 'e-comet', 'mcp', 'src', 'server.mjs')], env, cwd: root },
    autoConnectRemote: false,
  });
  const account = createAccount({ connectRemote: runtime.connectRemote, disconnectRemote: runtime.disconnectRemote, isRemoteConnected: () => runtime.statuses.remote === 'connected' });
  await ctx.plugin(AccountService, { account, connections: runtime.statuses });
  ctx.effect(() => async () => { await account.dispose(); await runtime.dispose(); });
  await account.initialize();
}
