import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('Day 9 clean local rehearsal', () => {
  it('reaches the controlled deploy/wire/verify/smoke lifecycle from an empty local chain', () => {
    const result = spawnSync(process.execPath, ['scripts/day9/run-clean-local-rehearsal.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, BREAD_DAY9_MODE: 'CONTROLLED_FIXTURE' },
      timeout: 180_000,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('DAY9_CLEAN_LOCAL_REHEARSAL_PASS');
    expect(result.stdout).toContain('CANONICAL_ARC_DEPLOYMENT_CLAIM=false');
    expect(result.stdout).toContain('PRODUCTION_ECONOMICS_CLAIM=false');
  }, 190_000);
});
