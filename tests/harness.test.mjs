import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import { createAdapter, installAdapter } from '../src/adapter.mjs';

test('published Harness runtime performs private authorization across frozen tool executions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ecomet-dsh-runtime-'));
  const ctx = new Context();
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  const adapter = createAdapter({ dataDirectory: directory });
  installAdapter(ctx, adapter);
  const token = 'https://example.invalid/browser?authorization=private-test-token';
  let received;
  const output = { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] };
  ctx.tools.register(adapter.wrapToolDefinition({
    name: 'mcp__e-comet__browser_job', description: 'fixture', parameters: { type: 'object' }, output,
    async execute() { return { content: [{ type: 'text', text: JSON.stringify({ trigger_url: token }) }] }; },
  }));
  ctx.tools.register(adapter.wrapToolDefinition({
    name: 'mcp__e-comet-local__wb_search_by_query', description: 'fixture', parameters: { type: 'object' }, output,
    async execute(args) { received = args; return { content: [{ type: 'text', text: 'search complete' }] }; },
  }));
  const agent = { session: { header: { id: 'runtime-fixture-session' } } };
  const signal = new AbortController().signal;
  try {
    const remote = await ctx.tools.execute({ name: 'mcp__e-comet__browser_job', arguments: { job: { type: 'search_by_query', queries: [{ query: 'fixture', pages: 1 }] } }, callId: 'remote', agent, signal });
    assert.equal(remote.isError, false, JSON.stringify(remote));
    assert.equal(JSON.stringify(remote).includes(token), false);
    const local = await ctx.tools.execute({ name: 'mcp__e-comet-local__wb_search_by_query', arguments: {}, callId: 'local', agent, signal });
    assert.equal(local.isError, false, JSON.stringify(local));
    assert.equal(received.triggerUrl, token);
    const replay = await ctx.tools.execute({ name: 'mcp__e-comet-local__wb_search_by_query', arguments: {}, callId: 'replay', agent, signal });
    assert.equal(replay.isError, true);
  } finally {
    await ctx.fiber.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
