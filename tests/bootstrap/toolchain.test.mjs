import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('financial-contract toolchain is explicitly pinned', async () => {
  const versions = JSON.parse(await readFile('config/toolchain/versions.json', 'utf8'));
  assert.equal(versions.solidity, '0.8.26');
  assert.equal(versions.foundry, 'v1.5.0');
  assert.equal(
    versions.foundryToolchainAction,
    '50d5a8956f2e319df19e6b57539d7e2acb9f8c1e',
  );
});
