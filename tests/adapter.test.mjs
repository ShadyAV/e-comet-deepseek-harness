import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let createAdapter;
try { ({ createAdapter } = await import('../src/adapter.mjs')); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

const token = 'https://e-comet.io/browser-job?token=private-authorization';
const remote = 'mcp__e-comet__browser_job';
const local = 'mcp__e-comet-local__wb_product_card';
const raw = { content: [{ type: 'text', text: JSON.stringify({ trigger_url: token, status: 'ready' }) }], structuredContent: { trigger_url: token, status: 'ready' } };
const exec = (name, args, session = 'session-1') => Object.freeze({ name, arguments: Object.freeze(args), agent: { session: { header: { id: session } } }, signal: new AbortController().signal, token: Symbol('execution'), callId: 'call-1' });

async function fixture(t) {
  assert.equal(typeof createAdapter, 'function', 'native adapter is implemented');
  const dataDirectory = await mkdtemp(join(tmpdir(), 'e-comet-dsh-test-'));
  t.after(() => rm(dataDirectory, { recursive: true, force: true }));
  let time = Date.now();
  return { adapter: createAdapter({ dataDirectory, now: () => time }), expire: () => { time += 100_000; } };
}

async function run(adapter, execution, body, { commit = true, deny = false, postBlock = false } = {}) {
  const definition = adapter.wrapToolDefinition({ name: execution.name, output: { schema: {}, render: (_, value) => value.content ?? [] }, execute: body });
  const pre = await adapter.preExecute(execution, async () => deny ? { kind: 'deny', reason: 'policy' } : { kind: 'allow' });
  if (pre.kind !== 'allow') return pre;
  let result;
  try {
    result = await adapter.execute(execution, async () => {
      const value = await definition.execute(execution.arguments, execution);
      return { isError: false, value, content: definition.output.render(execution.arguments, value) };
    });
  } catch (error) { return { error }; }
  const post = await adapter.postExecute(execution, result, async () => postBlock ? { kind: 'block', feedback: [] } : { kind: 'accept' });
  if (post.kind === 'block') result = { isError: true, content: post.feedback };
  if (commit) adapter.result(execution, result);
  return result;
}

test('committed remote authorization is injected privately into exactly one matching local body', async t => {
  const { adapter } = await fixture(t);
  const outcome = await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw);
  assert.equal(JSON.stringify(outcome).includes(token), false);
  let received;
  const authored = exec(local, { nmId: 42 });
  await run(adapter, authored, async args => { received = args; return { content: [] }; });
  assert.equal(received.triggerUrl, token);
  assert.deepEqual(authored.arguments, { nmId: 42 });
  const replay = await run(adapter, exec(local, { nmId: 42 }), async () => assert.fail('replay dispatch'));
  assert.match(replay.error.message, /HANDOFF_MISSING/);
});

for (const scenario of ['missing', 'uncommitted', 'blocked', 'cross-session', 'expired']) {
  test(`${scenario} authorization never reaches the signed local body`, async t => {
    const { adapter, expire } = await fixture(t);
    if (scenario !== 'missing') await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw, { commit: scenario !== 'uncommitted', postBlock: scenario === 'blocked' });
    if (scenario === 'expired') expire();
    const outcome = await run(adapter, exec(local, {}, scenario === 'cross-session' ? 'other-session' : 'session-1'), async () => assert.fail('unauthorized dispatch'));
    assert.match(outcome.error.message, /HANDOFF_(MISSING|EXPIRED)/);
  });
}

test('authored authorization fields are rejected before consuming the grant', async t => {
  const { adapter } = await fixture(t);
  await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw);
  for (const field of ['triggerUrl', 'trigger_url']) {
    const denial = await run(adapter, exec(local, { [field]: 'forged' }), async () => assert.fail('forged dispatch'));
    assert.equal(denial.kind, 'deny');
    assert.match(denial.reason, /HANDOFF_MODEL_AUTHORIZATION/);
  }
  let called = false;
  await run(adapter, exec(local, {}), async args => { called = args.triggerUrl === token; return { content: [] }; });
  assert.equal(called, true);
});

test('a downstream denial preserves the remote grant for a permitted retry', async t => {
  const { adapter } = await fixture(t);
  await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw);
  await run(adapter, exec(local, {}), async () => assert.fail('denied dispatch'), { deny: true });
  let called = false;
  await run(adapter, exec(local, {}), async () => { called = true; return { content: [] }; });
  assert.equal(called, true);
});

test('missing native lifecycle and feedback operations fail closed', async t => {
  const { adapter } = await fixture(t);
  const definition = adapter.wrapToolDefinition({ name: local, execute: async () => assert.fail('unattested dispatch') });
  await assert.rejects(definition.execute({}, exec(local, {})), /HANDOFF_UNATTESTED/);
  for (const name of ['mcp__e-comet__report_issue', 'mcp__e-comet-local__prepare_e_comet_feedback', 'mcp__e-comet-local__submit_e_comet_feedback']) {
    const result = await run(adapter, exec(name, {}), async () => assert.fail('unsupported feedback dispatch'));
    assert.equal(result.kind, 'deny');
    assert.match(result.reason, /FEEDBACK_HOST_UNSUPPORTED/);
  }
});

test('unrelated remote namespace cannot supply authorization', async t => {
  const { adapter } = await fixture(t);
  await run(adapter, exec('mcp__untrusted__browser_job', { job: { type: 'product_card' } }), async () => raw);
  const outcome = await run(adapter, exec(local, {}), async () => assert.fail('untrusted dispatch'));
  assert.match(outcome.error.message, /HANDOFF_MISSING/);
});

test('a cancelled or replaced final remote outcome cannot authorize the local body', async t => {
  const { adapter } = await fixture(t);
  for (const mode of ['cancel', 'replace']) {
    const controller = new AbortController();
    const execution = Object.freeze({ ...exec(remote, { job: { type: 'product_card' } }), signal: controller.signal });
    const outcome = await run(adapter, execution, async () => raw, { commit: false });
    if (mode === 'cancel') controller.abort();
    adapter.result(execution, mode === 'replace' ? { isError: false, value: { content: [] }, content: [] } : outcome);
    const localOutcome = await run(adapter, exec(local, {}), async () => assert.fail('cancelled grant dispatch'));
    assert.match(localOutcome.error.message, /HANDOFF_MISSING/);
  }
});

test('multiple committed grants are invalidated rather than selecting one', async t => {
  const { adapter } = await fixture(t);
  await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw);
  await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw);
  const outcome = await run(adapter, exec(local, {}), async () => assert.fail('ambiguous dispatch'));
  assert.match(outcome.error.message, /HANDOFF_MISSING/);
});

test('local output and exceptions cannot echo the privately injected authorization', async t => {
  const { adapter } = await fixture(t);
  await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw);
  const outcome = await run(adapter, exec(local, {}), async args => ({ content: [{ type: 'text', text: args.triggerUrl }] }));
  assert.equal(JSON.stringify(outcome).includes(token), false);
  await run(adapter, exec(remote, { job: { type: 'product_card' } }), async () => raw);
  const exception = await run(adapter, exec(local, {}), async args => { throw new Error(`provider echoed ${args.triggerUrl}`); });
  assert.equal(exception.error.message.includes(token), false);
});
