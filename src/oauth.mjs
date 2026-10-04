import { mkdir, readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

export const REMOTE_URL = 'https://mcp.e-comet.io/mcp';
export const OAUTH_ISSUER_ORIGIN = 'https://auth.mcp.e-comet.io';
export const CREDENTIAL_DIRECTORY = join(homedir(), '.e-comet-deepseek-harness', 'account');

export class LoginRequiredError extends Error {
  constructor() { super('e-Comet login required. Open e-Comet in the app sidebar and connect your account.'); this.name = 'LoginRequiredError'; }
}

/** SDK OAuthClientProvider. Credentials are never returned as MCP content. */
export class FileOAuthProvider {
  constructor({ directory = CREDENTIAL_DIRECTORY, redirectUrl, onAuthorization } = {}) {
    this.directory = directory;
    this.file = join(directory, 'credentials.json');
    this.callbackUrl = redirectUrl;
    this.onAuthorization = onAuthorization;
    this.oauthState = randomBytes(32).toString('hex');
  }
  get redirectUrl() { return this.callbackUrl ?? 'http://127.0.0.1/callback'; }
  get clientMetadata() {
    return { client_name: 'e-Comet DeepSeek Harness', redirect_uris: [this.redirectUrl], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'client_secret_post' };
  }
  state() { return this.oauthState; }
  async read() {
    try {
      const state = JSON.parse(await readFile(this.file, 'utf8'));
      return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    }
    catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
      throw new Error('Cannot read e-Comet login state. Check access to the credentials directory.', { cause: error });
    }
  }
  async update(patch) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    const temporary = join(this.directory, `credentials-${randomBytes(8).toString('hex')}.tmp`);
    await writeFile(temporary, JSON.stringify({ ...await this.read(), ...patch }), { mode: 0o600, flag: 'wx' });
    await rename(temporary, this.file);
    await chmod(this.file, 0o600);
  }
  async tokens() { return (await this.read()).tokens; }
  async saveTokens(tokens) { await this.update({ tokens }); }
  async clientInformation() { return (await this.read()).clientInformation; }
  async saveClientInformation(clientInformation) { await this.update({ clientInformation, redirectUrl: this.redirectUrl }); }
  async saveCodeVerifier(codeVerifier) { await this.update({ codeVerifier }); }
  async codeVerifier() { const verifier = (await this.read()).codeVerifier; if (!verifier) throw new LoginRequiredError(); return verifier; }
  async redirectToAuthorization(url) {
    if (!this.onAuthorization) throw new LoginRequiredError();
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid OAuth authorization URL.');
    await this.onAuthorization(url);
  }
  async validateResourceURL(serverUrl, resource) {
    if (new URL(serverUrl).origin !== new URL(REMOTE_URL).origin) throw new Error('Untrusted MCP resource.');
    if (resource && new URL(resource).origin !== new URL(REMOTE_URL).origin) throw new Error('Untrusted OAuth resource.');
    return new URL(resource ?? REMOTE_URL);
  }
  async invalidateCredentials(scope) {
    const patch = {};
    if (scope === 'all' || scope === 'tokens') patch.tokens = undefined;
    if (scope === 'all' || scope === 'client') patch.clientInformation = undefined;
    if (scope === 'all' || scope === 'verifier') patch.codeVerifier = undefined;
    await this.update(patch);
  }
}

/** Only e-Comet and the HTTPS issuer advertised by its protected-resource metadata. */
export function createTrustedFetch(fetchImpl = fetch) {
  const resourceOrigin = new URL(REMOTE_URL).origin;
  const allowedOrigins = new Set([resourceOrigin]);
  let issuer;
  function secure(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('OAuth requires HTTPS without embedded credentials.');
    return url;
  }
  return async (input, options = {}) => {
    const url = secure(typeof input === 'object' && 'url' in input ? input.url : String(input));
    if (!allowedOrigins.has(url.origin)) throw new Error('OAuth endpoint is not trusted by e-Comet discovery.');
    const response = await fetchImpl(input, { ...options, redirect: 'error' });
    if (response.ok && url.pathname.includes('/.well-known/')) {
      const metadata = await response.clone().json();
      if (url.origin === resourceOrigin && url.pathname.includes('oauth-protected-resource')) {
        if (secure(metadata.resource).origin !== resourceOrigin) throw new Error('Untrusted protected resource metadata.');
        const server = metadata.authorization_servers?.[0];
        if (!server) throw new Error('e-Comet did not advertise an OAuth issuer.');
        issuer = secure(server);
        if (issuer.origin !== OAUTH_ISSUER_ORIGIN) throw new Error('Untrusted e-Comet OAuth issuer.');
        allowedOrigins.add(issuer.origin);
      } else if (metadata.issuer) {
        if (!issuer || secure(metadata.issuer).href !== issuer.href) throw new Error('OAuth issuer differs from e-Comet discovery.');
        for (const key of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
          if (metadata[key] && secure(metadata[key]).origin !== issuer.origin) throw new Error('OAuth endpoint differs from the discovered issuer.');
        }
      }
    }
    return response;
  };
}

/** One login attempt owns an ephemeral loopback listener and unpredictable OAuth state. */
export async function startCallback(expectedState, { timeoutMs = 300_000 } = {}) {
  let resolveCode, rejectCode;
  const code = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  // A timeout may precede the caller awaiting the promise during discovery.
  code.catch(() => {});
  let timer;
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (request.method !== 'GET' || url.pathname !== '/callback' || url.searchParams.get('state') !== expectedState) {
      response.writeHead(400); response.end('Invalid OAuth callback.'); return;
    }
    if (url.searchParams.has('error')) {
      response.writeHead(400); response.end('Authorization was declined. Return to the e-Comet panel in the app.');
      rejectCode(new Error('e-Comet authorization was declined.')); clearTimeout(timer); server.close(); return;
    }
    const authorizationCode = url.searchParams.get('code');
    if (!authorizationCode) { response.writeHead(400); response.end('Missing authorization code.'); return; }
    response.end('Authorization received. Return to the e-Comet panel in the app.');
    resolveCode(authorizationCode); clearTimeout(timer); server.close();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  timer = setTimeout(() => { rejectCode(new Error('OAuth login timed out.')); server.close(); }, timeoutMs);
  return { url: `http://127.0.0.1:${server.address().port}/callback`, code, close() { clearTimeout(timer); rejectCode(new Error('OAuth login cancelled.')); server.close(); } };
}
