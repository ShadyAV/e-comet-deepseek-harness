import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { FileOAuthProvider, CREDENTIAL_DIRECTORY, REMOTE_URL, OAUTH_ISSUER_ORIGIN, createTrustedFetch, startCallback } from './oauth.mjs';

/** Host-only account owner. Its public views never contain credentials. */
export function createAccount({ directory = CREDENTIAL_DIRECTORY, fetchImpl = fetch, connectRemote, disconnectRemote, isRemoteConnected = () => true, timeoutMs = 300_000 } = {}) {
  const saved = new FileOAuthProvider({ directory });
  let status = { state: 'logged_out' };
  let attempt;
  let disposed = false;
  const getStatus = () => {
    if (status.state === 'connected' && !isRemoteConnected()) status = { state: 'error', error: 'e-Comet could not connect. Check your connection or sign in again.' };
    return { ...status };
  };
  async function initialize() {
    try {
      if (!(await saved.tokens())?.access_token) return getStatus();
      await connectRemote();
      status = { state: 'connected' };
    } catch { status = { state: 'error', error: 'e-Comet could not connect. Check your connection or sign in again.' }; }
    return getStatus();
  }
  async function cancelLogin() {
    const current = attempt;
    if (current) {
      current.cancelled = true;
      current.abort.abort();
      current.callback?.close();
      await current.done;
      if (attempt === current) attempt = undefined;
      status = { state: 'logged_out' };
    }
    return getStatus();
  }
  async function startLogin() {
    if (disposed) throw new Error('e-Comet account service has stopped.');
    await cancelLogin();
    if (getStatus().state === 'connected') return getStatus();
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const current = { abort: new AbortController(), cancelled: false };
    const signal = AbortSignal.any([current.abort.signal, AbortSignal.timeout(timeoutMs)]);
    attempt = current;
    status = { state: 'connecting' };
    current.done = (async () => {
      let temporary;
      try {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        temporary = await mkdtemp(join(directory, 'login-'));
        const provider = new FileOAuthProvider({ directory: temporary, onAuthorization(url) {
          if (url.origin !== OAUTH_ISSUER_ORIGIN) throw new Error('Untrusted authorization URL.');
          if (current.cancelled) throw new Error('OAuth login cancelled.');
          status = { state: 'connecting', authorizationUrl: url.href };
          resolveReady({ state: 'connecting', authorizationUrl: url.href });
        } });
        current.callback = await startCallback(await provider.state(), { timeoutMs });
        // The same deadline owns discovery and token exchange, not just the browser wait.
        current.callback.code.catch(error => current.abort.abort(error));
        if (current.cancelled) { current.callback.close(); throw new Error('OAuth login cancelled.'); }
        provider.callbackUrl = current.callback.url;
        const fetchFn = createTrustedFetch((input, options) => fetchImpl(input, { ...options, signal }));
        const result = await auth(provider, { serverUrl: REMOTE_URL, fetchFn });
        if (result === 'REDIRECT') await auth(provider, { serverUrl: REMOTE_URL, authorizationCode: await current.callback.code, fetchFn });
        if (current.cancelled) throw new Error('OAuth login cancelled.');
        await provider.invalidateCredentials('verifier');
        await saved.update(await provider.read());
        if (current.cancelled) { await saved.invalidateCredentials('all'); return; }
        // Remote bootstrap still uses the SDK's bounded timeout; cancellation
        // at this stage may await it. See COMPATIBILITY.md's accepted residual.
        await connectRemote();
        if (current.cancelled) { await disconnectRemote(); await saved.invalidateCredentials('all'); return; }
        status = { state: 'connected' };
      } catch (error) {
        if (!current.cancelled) status = { state: 'error', error: /declined/.test(error.message) ? 'Authorization was declined. Try connecting again.' : error.name === 'TimeoutError' || /timed out/.test(error.message) ? 'Connection timed out. Try connecting again.' : 'e-Comet could not connect. Check your connection or sign in again.' };
      } finally {
        current.callback?.close();
        if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => {});
        resolveReady(getStatus());
        if (attempt === current) attempt = undefined;
      }
    })();
    return ready;
  }
  async function disconnect() {
    await cancelLogin();
    await disconnectRemote();
    await saved.invalidateCredentials('all');
    status = { state: 'logged_out' };
    return getStatus();
  }
  async function dispose() { disposed = true; await cancelLogin(); }
  return { initialize, getStatus, startLogin, cancelLogin, disconnect, dispose };
}
