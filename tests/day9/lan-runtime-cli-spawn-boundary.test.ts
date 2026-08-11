import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

describe('Day 9 LAN CLI spawn boundary', () => {
  it('executes package CLI shims as commands instead of parsing them with Node', () => {
    const orchestrator = readFileSync(
      resolve(root, 'scripts/day9/lan/run-lan-acceptance.mjs'),
      'utf8',
    );

    expect(orchestrator).toContain('function spawnRuntime(label, command, args, env)');
    expect(orchestrator).toContain('const child = spawn(command, args, {');
    expect(orchestrator).not.toContain('const child = spawn(process.execPath, args, {');

    expect(orchestrator).toContain(
      "spawnRuntime('bread-api', tsx, ['apps/api/src/lan/api-server.ts'], {",
    );
    expect(orchestrator).toContain(
      "spawnRuntime('bread-web', resolve(repositoryRoot, 'apps/web/node_modules/.bin/next'), [",
    );
  });
});
