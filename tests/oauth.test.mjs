import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileOAuthProvider, createTrustedFetch, startCallback } from '../src/oauth.mjs';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

test('SDK performs PKCE authorization, exchanges the callback code and refreshes tokens', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ecomet-flow-'));
  const requests = [];
  let authorization;
  const provider = new FileOAuthProvider({ directory, redirectUrl: 'http://127.0.0.1:3210/callback', onAuthorization: url => { authorization = url; } });
  const fetchFn = createTrustedFetch(async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, body: options.body && String(options.body) });
    if (target.includes('oauth-protected-resource')) return Response.json({ resource: 'https://mcp.e-comet.io/', authorization_servers: ['https://auth.mcp.e-comet.io/'] });
    if (target.includes('.well-known')) return Response.json({ issuer: 'https://auth.mcp.e-comet.io/', authorization_endpoint: 'https://auth.mcp.e-comet.io/authorize', token_endpoint: 'https://auth.mcp.e-comet.io/token', registration_endpoint: 'https://auth.mcp.e-comet.io/register', response_types_supported: ['code'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['client_secret_post'] });
    if (target.endsWith('/register')) return Response.json({ client_id: 'registered', client_secret: 'private', redirect_uris: [provider.redirectUrl], token_endpoint_auth_method: 'client_secret_post' });
    if (target.endsWith('/token')) return Response.json({ access_token: 'token', refresh_token: 'refresh', token_type: 'Bearer', expires_in: 3600 });
    throw new Error('Unexpected request');
  });
  try {
    assert.equal(await auth(provider, { serverUrl: 'https://mcp.e-comet.io/mcp', fetchFn }), 'REDIRECT');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authorization.searchParams.get('state'), await provider.state());
    assert.equal(await auth(provider, { serverUrl: 'https://mcp.e-comet.io/mcp', authorizationCode: 'callback-code', fetchFn }), 'AUTHORIZED');
    const exchange = new URLSearchParams(requests.findLast(x => x.target.endsWith('/token')).body);
    assert.equal(exchange.get('code_verifier'), await provider.codeVerifier());
    assert.equal(exchange.get('resource'), 'https://mcp.e-comet.io/');
    assert.equal(await auth(provider, { serverUrl: 'https://mcp.e-comet.io/mcp', fetchFn }), 'AUTHORIZED');
    assert.equal(new URLSearchParams(requests.at(-1).body).get('grant_type'), 'refresh_token');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('OAuth state persists outside protocol output and credentials can be selectively cleared', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ecomet-oauth-'));
  try {
    const provider = new FileOAuthProvider({ directory, redirectUrl: 'http://127.0.0.1:3210/callback' });
    await provider.saveTokens({ access_token: 'secret', token_type: 'Bearer', issuer: 'https://auth.mcp.e-comet.io/' });
    await provider.saveClientInformation({ client_id: 'client', client_secret: 'private' });
    await provider.saveCodeVerifier('verifier');
    const restored = new FileOAuthProvider({ directory });
    assert.equal((await restored.tokens()).access_token, 'secret');
    assert.equal(await restored.codeVerifier(), 'verifier');
    await restored.invalidateCredentials('tokens');
    assert.equal(await restored.tokens(), undefined);
    assert.equal((await restored.clientInformation()).client_id, 'client');
    assert.equal(JSON.parse(await readFile(join(directory, 'credentials.json'))).codeVerifier, 'verifier');
    if (process.platform !== 'win32') assert.equal((await stat(join(directory, 'credentials.json'))).mode & 0o777, 0o600);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('corrupt local login state permits a new login to repair it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ecomet-corrupt-'));
  try {
    await writeFile(join(directory, 'credentials.json'), '{invalid');
    const provider = new FileOAuthProvider({ directory });
    assert.equal(await provider.tokens(), undefined);
    await provider.saveTokens({ access_token: 'replacement', token_type: 'Bearer' });
    assert.equal((await provider.tokens()).access_token, 'replacement');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('callback rejects wrong state without consuming the valid callback', async () => {
  const callback = await startCallback('expected');
  try {
    assert.equal((await fetch(`${callback.url}?code=secret&state=wrong`)).status, 400);
    assert.equal((await fetch(`${callback.url}?code=valid&state=expected`)).status, 200);
    assert.equal(await callback.code, 'valid');
  } finally { callback.close(); }
});

test('OAuth network permits the issuer discovered by the resource and rejects arbitrary or insecure targets', async () => {
  const calls = [];
  const trusted = createTrustedFetch(async (url) => {
    calls.push(String(url));
    return Response.json({ resource: 'https://mcp.e-comet.io/', authorization_servers: ['https://auth.mcp.e-comet.io/'] });
  });
  await assert.rejects(trusted('https://attacker.invalid/token'), /trusted/);
  await trusted('https://mcp.e-comet.io/.well-known/oauth-protected-resource');
  await trusted('https://auth.mcp.e-comet.io/.well-known/oauth-authorization-server');
  await assert.rejects(trusted('http://auth.mcp.e-comet.io/token'), /HTTPS/);
  assert.equal(calls.length, 2);
});

test('OAuth discovery rejects mismatched issuer, cross-origin token endpoints and HTTP redirects', async () => {
  let metadata;
  const trusted = createTrustedFetch(async (url, options) => {
    assert.equal(options.redirect, 'error');
    return Response.json(String(url).includes('oauth-protected-resource')
      ? { resource: 'https://mcp.e-comet.io/', authorization_servers: ['https://auth.mcp.e-comet.io/'] }
      : metadata);
  });
  await trusted('https://mcp.e-comet.io/.well-known/oauth-protected-resource');
  metadata = { issuer: 'https://different.invalid/' };
  await assert.rejects(trusted('https://auth.mcp.e-comet.io/.well-known/oauth-authorization-server'), /issuer/);
  metadata = { issuer: 'https://auth.mcp.e-comet.io/', token_endpoint: 'https://different.invalid/token' };
  await assert.rejects(trusted('https://auth.mcp.e-comet.io/.well-known/oauth-authorization-server'), /endpoint/);
});
