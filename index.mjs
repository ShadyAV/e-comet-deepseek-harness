import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as filesystemSkills from '@deepseek-ai/dsh-skill-filesystem';
import { createAdapter, installAdapter } from './src/adapter.mjs';
import { registerMcpClients } from './src/runtime.mjs';

export const name = 'e-comet-integration';
export const inject = ['tools', 'skills'];

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
  const { dispose } = await registerMcpClients(ctx, {
    adapter,
    remote: { command: process.execPath, args: [join(root, 'src', 'remote-proxy.mjs')], env, cwd: root },
    local: { command: process.execPath, args: [join(root, 'vendor', 'e-comet', 'mcp', 'src', 'server.mjs')], env, cwd: root },
  });
  ctx.effect(() => dispose);
}
