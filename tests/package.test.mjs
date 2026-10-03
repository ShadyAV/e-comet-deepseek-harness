import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
test('Git install contains a loadable prebuilt DSH bundle with no build script', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.scripts.prepare, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
  for (const path of ['index.mjs', 'cordis.patch.yml', 'vendor/e-comet/mcp/src/server.mjs', 'LICENSE', 'NOTICE']) {
    await access(new URL(path, root));
  }
  assert.equal(manifest.repository.url, 'https://github.com/ShadyAV/e-comet-deepseek-harness.git');
});

test('vendored local MCP retains the metadata needed to resolve its release version', async () => {
  const config = await import('../vendor/e-comet/mcp/src/config.mjs');
  assert.equal(config.BRIDGE_VERSION, '2026.9.3');
});
