import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const validator = 'scripts/validation/validate-day5-graduation-operations.mjs';

test('Day-5 operations accept the verified Arc-Testnet deployment while Arc mainnet stays unresolved', () => {
  const result = spawnSync(process.execPath, [validator], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(
    result.status,
    0,
    `validator failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /day5-graduation-operations: PASS/);
});
