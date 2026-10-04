import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

test('DeepSeek reads a branded title, description and icon through exported resources', () => {
  const script = `import {readPluginMeta} from '@deepseek-ai/dsh-app-boot';
    const m=readPluginMeta('dsh-e-comet',new URL('./package.json',import.meta.url).href);
    console.log(JSON.stringify({title:m?.title,description:m?.description,icon:m?.icon?.slice(0,22),error:m?.error}));`;
  const result = JSON.parse(execFileSync(process.execPath, ['--expose-internals', '--input-type=module', '-e', script], {
    cwd: fileURLToPath(root), encoding: 'utf8',
  }));
  assert.equal(result.title?.en, 'e-Comet');
  assert.equal(result.title?.ru, 'e-Comet');
  assert.match(result.description?.en ?? '', /Wildberries/);
  assert.equal(result.icon, 'data:image/png;base64,');
  assert.equal(result.error, undefined);
});
