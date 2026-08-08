import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Arc testnet manifest preserves canonical Bread USDC boundary', async () => {
  const m = JSON.parse(await readFile('config/networks/arc-testnet.json', 'utf8'));
  assert.equal(m.chainId, 5042002);
  assert.equal(m.usdc.address.toLowerCase(), '0x3600000000000000000000000000000000000000');
  assert.equal(m.usdc.decimals, 6);
  assert.equal(m.nativePrecision, 18);
});

test('Arc mainnet manifest remains intentionally unresolved', async () => {
  const m = JSON.parse(await readFile('config/networks/arc-mainnet.json', 'utf8'));
  assert.equal(m.status, 'AWAITING_OFFICIAL_VALUES');
  assert.equal(m.chainId, null);
  assert.equal(m.usdc.address, null);
});
