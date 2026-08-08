import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('7A financial blockers remain explicit in repository state', async () => {
  const gates = JSON.parse(await readFile('config/protocol/build-gates.json', 'utf8')).gates;
  const status = Object.fromEntries(gates.map((g) => [g.id, g.status]));
  assert.equal(status.EXACT_SNIPE_IMPLEMENTATION, 'BLOCKED');
  assert.equal(status.LAUNCH_AND_BUY_SOURCE, 'BLOCKED');
  assert.equal(status.FEE_ESCROW_SOURCE, 'BLOCKED');
  assert.equal(status.CURRENT_PONS_FACTORY_SOURCE_PARITY, 'BLOCKED');
});
