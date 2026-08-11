import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('ordinary Foundry regressions exclude environment-dependent fork tests while the dedicated Arc runner selects them explicitly', () => {
  const rootCi = read('.github/workflows/ci.yml');
  const lane3 = read('.github/workflows/day9-lane3-clean-local-rehearsal.yml');
  const forkRunner = read('scripts/day9/run-arc-v3-fork-proof.mjs');
  const forkTest = read('contracts/test/fork/ArcV3DependencyFork.t.sol');

  assert.match(
    rootCi,
    /Run Solidity bootstrap tests[\s\S]*?run:\s*forge test --no-match-path ['"]?test\/fork\/\*\*['"]?/,
  );
  assert.match(
    lane3,
    /Run full contract regression[\s\S]*?run:\s*forge test -q --no-match-path ['"]?test\/fork\/\*\*['"]?/,
  );

  assert.match(forkRunner, /'--match-path',\s*'test\/fork\/ArcV3DependencyFork\.t\.sol'/);
  assert.match(forkRunner, /'--match-test',\s*'testRealArcV3DependencyMintAndPermanentLock'/);

  for (const requiredEnv of [
    'ARC_FORK_RPC_URL',
    'ARC_FORK_BLOCK_NUMBER',
    'BREAD_CHAIN_ID',
    'BREAD_USDC',
    'BREAD_V3_FACTORY',
    'BREAD_V3_POSITION_MANAGER',
    'BREAD_V3_FEE',
  ]) {
    assert.ok(forkTest.includes(`env`), 'fork test must remain environment-bound');
    assert.ok(
      forkRunner.includes(requiredEnv),
      `dedicated Arc fork runner must supply ${requiredEnv}`,
    );
  }
});
