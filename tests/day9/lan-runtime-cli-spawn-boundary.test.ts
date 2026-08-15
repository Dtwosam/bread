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

    expect(orchestrator).toContain('function spawnRuntime(label, command, args, env, cwd = repositoryRoot)');
    expect(orchestrator).toContain('const child = spawn(command, args, {');
    expect(orchestrator).not.toContain('const child = spawn(process.execPath, args, {');

    expect(orchestrator).toContain(
      "spawnRuntime('bread-api', tsx, ['apps/api/src/lan/api-server.ts'], {",
    );
    expect(orchestrator).toContain(
      "spawnRuntime('bread-web', resolve(repositoryRoot, 'apps/web/node_modules/.bin/next'), [",
    );
  });

  it('starts the built Next.js app from the workspace that owns its .next output', () => {
    const orchestrator = readFileSync(
      resolve(root, 'scripts/day9/lan/run-lan-acceptance.mjs'),
      'utf8',
    );

    expect(orchestrator).toContain('cwd,');
    expect(orchestrator).toContain("], {}, resolve(repositoryRoot, 'apps/web'));\n");
  });

  it('builds the web app through Corepack using Bread\'s pinned pnpm contract', () => {
    const orchestrator = readFileSync(
      resolve(root, 'scripts/day9/lan/run-lan-acceptance.mjs'),
      'utf8',
    );
    const rootPackage = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      packageManager?: string;
    };

    expect(rootPackage.packageManager).toBe('pnpm@11.15.1');
    expect(orchestrator).toContain(
      "await run('corepack', ['pnpm', '--filter', '@bread/web', 'build']);",
    );
    expect(orchestrator).not.toContain("run('node_modules/.bin/pnpm'");
    expect(orchestrator).not.toContain("run('npx', ['--no-install', 'pnpm'");
  });
});
