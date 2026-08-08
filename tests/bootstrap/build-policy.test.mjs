import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('pnpm build-script allowlist explicitly approves only reviewed bootstrap builders', async () => {
  const workspace = await readFile('pnpm-workspace.yaml', 'utf8');
  assert.match(workspace, /allowBuilds:\s*[\s\S]*?esbuild:\s*true/);
  assert.match(workspace, /allowBuilds:\s*[\s\S]*?sharp:\s*true/);
  assert.doesNotMatch(workspace, /dangerouslyAllowAllBuilds:\s*true/);
});
