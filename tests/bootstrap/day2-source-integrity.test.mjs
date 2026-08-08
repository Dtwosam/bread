import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inventoryPath = 'config/protocol/day2-core-source-inventory.json';

async function loadInventory() {
  return JSON.parse(await readFile(inventoryPath, 'utf8'));
}

test('Day 2 frozen dependency integrity is part of bootstrap validation', async () => {
  const validateAll = await readFile('scripts/validation/validate-all.mjs', 'utf8');
  assert.match(validateAll, /validate-day2-source-integrity\.mjs/);
});

test('Day 2 tracked curve state source boundary is frozen explicitly', async () => {
  const inventory = await loadInventory();
  assert.equal(
    inventory.productionPorts.BreadTrackedCurveState.blobSha,
    'a5d84b3c355a1661e1bf61a4dd4e29591fbf6074'
  );
  assert.equal(
    inventory.productionPorts.BreadTrackedCurveState.sourcePath,
    'contractsV2/src/v2/PonsV2BondingCurve.sol'
  );
  assert.equal(
    inventory.productionPorts.BreadTrackedCurveState.portMode,
    'BOUNDED_TRACKED_RESERVE_EXTRACTION'
  );
});

test('Day 2 frozen OpenZeppelin dependency surface contains exactly nine verified files', async () => {
  const inventory = await loadInventory();
  const vendored = inventory.dependencyPolicy.vendoredFiles;

  assert.equal(Object.keys(vendored).length, 9);
  assert.equal(
    vendored['contractsV2/lib/openzeppelin-contracts/contracts/utils/math/Math.sol'],
    'e7288595b6539e986aef1a7a524884d86fc2d643'
  );
  assert.equal(
    vendored['contractsV2/lib/openzeppelin-contracts/contracts/utils/Panic.sol'],
    'e168824d34b3f0ba0be33317fb34b9e74fc148b6'
  );
  assert.equal(
    vendored['contractsV2/lib/openzeppelin-contracts/contracts/utils/math/SafeCast.sol'],
    'ccb979f61c9577e6338276cff49625d5a2191eb3'
  );
});
