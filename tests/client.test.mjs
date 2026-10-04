import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function loadClient() {
  let registration;
  vm.runInNewContext(fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (value) => { registration = value; } } },
    URL, setTimeout, clearTimeout,
  });
  return registration.factory((name) => {
    assert.equal(name, 'react');
    return { createElement: (...args) => args };
  });
}
const success = (value) => ({ ok: true, value });
function api(overrides = {}) {
  return { getStatus: async () => success({ state: 'logged_out' }), startLogin: async () => success({ authorizationUrl: 'https://e-comet.io/authorize?state=opaque' }), cancelLogin: async () => success({ state: 'logged_out' }), disconnect: async () => success({ state: 'logged_out' }), ...overrides };
}

test('account client registers lazily with host React and declared native services', () => {
  const client = loadClient();
  assert.deepEqual(Array.from(client.inject), ['slots', 'locale', 'remote']);
  assert.equal(typeof client.apply, 'function');
});
test('status read has no login side effect and failed login exposes only a safe notice', async () => {
  let starts = 0;
  const controller = loadClient().createAccountController(api({ startLogin: async () => { starts++; throw Error('secret token'); } }));
  await controller.refresh();
  assert.equal(starts, 0);
  assert.equal(controller.getSnapshot().state, 'logged_out');
  await controller.startLogin();
  assert.equal(starts, 1);
  assert.equal(controller.getSnapshot().notice, 'loginFailed');
  assert.equal(JSON.stringify(controller.getSnapshot()).includes('secret'), false);
  controller.dispose();
});
test('login publishes explicit HTTPS link and cancellation discards late login settlement', async () => {
  let settle;
  const controller = loadClient().createAccountController(api({ startLogin: () => new Promise((resolve) => { settle = resolve; }) }));
  const login = controller.startLogin();
  await controller.cancelLogin();
  settle(success({ authorizationUrl: 'https://e-comet.io/authorize?state=opaque' }));
  await login;
  assert.equal(controller.getSnapshot().authorizationUrl, null);
  assert.equal(controller.getSnapshot().state, 'logged_out');
  controller.dispose();
});
test('login rejects executable links and clears link once connected', async () => {
  const bad = loadClient().createAccountController(api({ startLogin: async () => success({ authorizationUrl: 'javascript:alert(1)' }) }));
  await bad.startLogin();
  assert.equal(bad.getSnapshot().notice, 'loginFailed');
  assert.equal(bad.getSnapshot().authorizationUrl, null);
  bad.dispose();
  const controller = loadClient().createAccountController(api({ getStatus: async () => success({ state: 'connected' }) }));
  await controller.startLogin();
  assert.match(controller.getSnapshot().authorizationUrl, /^https:/);
  await controller.refresh();
  assert.equal(controller.getSnapshot().state, 'connected');
  assert.equal(controller.getSnapshot().authorizationUrl, null);
  controller.dispose();
});
test('unmounted client drops late reads and disconnect uses native RPC', async () => {
  let settle;
  const controller = loadClient().createAccountController(api({ getStatus: () => new Promise((resolve) => { settle = resolve; }) }));
  const read = controller.refresh();
  controller.dispose();
  settle(success({ state: 'connected' }));
  await read;
  assert.notEqual(controller.getSnapshot().state, 'connected');
  let logged_out = false;
  const live = loadClient().createAccountController(api({ disconnect: async () => { logged_out = true; return success({ state: 'logged_out' }); } }));
  await live.disconnect();
  assert.equal(logged_out, true);
  assert.equal(live.getSnapshot().state, 'logged_out');
  live.dispose();
});


test('failed cancellation retains the usable login link for retry', async () => {
  const controller = loadClient().createAccountController(api({ cancelLogin: async () => ({ ok: false, error: { message: 'private details' } }) }));
  await controller.startLogin();
  const link = controller.getSnapshot().authorizationUrl;
  await controller.cancelLogin();
  assert.equal(controller.getSnapshot().authorizationUrl, link);
  assert.equal(controller.getSnapshot().notice, 'cancelFailed');
  controller.dispose();
});
test('native contribution mounts before account read and registers discoverable account pages', async () => {
  const client = loadClient();
  const registrations = [];
  const disposers = [];
  let mounted = false;
  const ctx = {
    remote: { $mount: async (remote) => { assert.equal(remote.descriptors.length, 4); mounted = true; }, eCometAccount: api({ getStatus: async () => { assert.equal(mounted, true); return success({ state: 'logged_out' }); } }) },
    effect(callback) { const result = callback(); if (typeof result === 'function') disposers.push(result); },
    on() {},
    get(name) { assert.equal(name, 'remote.eCometAccount'); return this.remote.eCometAccount; },
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: { inject(name, callback) { callback(); }, register(value) { registrations.push(value); } },
  };
  await client.apply(ctx);
  assert.equal(registrations.some((entry) => entry.name === 'plugins.item'), false);
  assert.ok(registrations.some((entry) => entry.name === 'plugins.bundle.config' && entry.key === 'dsh-e-comet'));
  for (const dispose of disposers) dispose();
});

test('status preserves backend-approved account diagnostics without displaying transport failures', async () => {
  const controller = loadClient().createAccountController(api({ getStatus: async () => success({ state: 'error', error: 'The login request expired.' }) }));
  await controller.refresh();
  assert.equal(controller.getSnapshot().detail, 'The login request expired.');
  controller.dispose();
});

test('browser and Host native RPC descriptors remain identical', async () => {
  const { ACCOUNT_REMOTE } = await import('../src/account-rpc.mjs');
  assert.deepEqual(JSON.parse(JSON.stringify(loadClient().ACCOUNT_REMOTE)), ACCOUNT_REMOTE);
});

test('account client activates with the installed Cordis and native Client API Gateway', async () => {
  const cordis = await import('@deepseek-ai/cordis');
  const { default: TypertRegistry } = await import('@deepseek-ai/dsh-typert-registry');
  const { webcrypto } = await import('node:crypto');
  let bundle;
  vm.runInNewContext(fs.readFileSync(new URL('../node_modules/@deepseek-ai/dsh-api-gateway/lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (value) => { bundle = value; } } },
    crypto: webcrypto, URL, AbortController, AbortSignal, setTimeout, clearTimeout, console,
  });
  const gateway = bundle.factory((name) => { assert.equal(name, '@deepseek-ai/cordis'); return cordis; });
  const ctx = new cordis.Context();
  const entries = [];
  ctx.provide('connection', {
    rpc: { open() {}, call: async () => success({ state: 'logged_out' }) },
    generation: { getSnapshot: () => undefined, subscribe: () => () => {} },
    registerGenerationSource: () => () => {}, start: () => ({ stop() {} }),
  });
  ctx.provide('locale', { register: () => () => {}, bind: () => (key) => key });
  ctx.provide('slots', { inject(name, callback) { callback(); }, register(entry) { entries.push(entry); } });
  try {
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(gateway);
    await ctx.plugin(loadClient());
    assert.ok(entries.some((entry) => entry.name === 'plugins.bundle.config' && entry.key === 'dsh-e-comet'));
    assert.equal(entries.some((entry) => entry.name === 'plugins.item'), false);
  } finally {
    await ctx.fiber.dispose();
  }
});




test('reopened pending login recovers the safe browser link from native status', async () => {
  const controller = loadClient().createAccountController(api({ getStatus: async () => success({ state: 'connecting', authorizationUrl: 'https://e-comet.io/authorize?state=recovered' }) }));
  await controller.refresh();
  assert.equal(controller.getSnapshot().authorizationUrl, 'https://e-comet.io/authorize?state=recovered');
  controller.dispose();
});
