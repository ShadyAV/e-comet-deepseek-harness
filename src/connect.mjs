#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { FileOAuthProvider, REMOTE_URL, createTrustedFetch, startCallback } from './oauth.mjs';
import { connectRemote } from './remote-proxy.mjs';

function openBrowser(url) {
  const target = String(url);
  const command = process.platform === 'win32' ? 'powershell.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -WindowStyle Hidden -FilePath '${target.replaceAll("'", "''")}'`] : [target];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {}); child.unref();
}

export async function connect({ open = false } = {}) {
  const provider = new FileOAuthProvider({ onAuthorization(url) { console.error(`Open this URL and sign in with your e-Comet email:\n${url}`); if (open) openBrowser(url); } });
  const callback = await startCallback(await provider.state());
  provider.callbackUrl = callback.url;
  try {
    const saved = await provider.read();
    if (saved.redirectUrl !== callback.url) await provider.invalidateCredentials('client');
    const fetchFn = createTrustedFetch();
    const result = await auth(provider, { serverUrl: REMOTE_URL, fetchFn });
    if (result === 'REDIRECT') {
      await auth(provider, { serverUrl: REMOTE_URL, authorizationCode: await callback.code, fetchFn });
    }
    const client = await connectRemote(provider);
    await client.listTools();
    await client.close();
    await provider.invalidateCredentials('verifier');
    console.error('Connected to e-Comet. You can now start the DeepSeek harness.');
    if (process.platform === 'win32') console.error('Credentials are stored in your Windows user profile. Restrict that directory to your user with Windows permissions; POSIX file modes do not enforce Windows ACLs.');
  } finally { callback.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  connect({ open: process.argv.includes('--open') }).catch(() => { console.error('e-Comet connection did not complete. Run dsh-e-comet-connect or npm run connect from the repository to try again.'); process.exitCode = 1; });
}
