import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REFERENCE_COMMIT = 'd5491e20be56051a68abf47136f6890c3ce3ff7d';
const CURRENT_DOCS_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';

test('Pons reference inventory and reconciliation reader are explicit before Day 1 closes', async () => {
  const reference = JSON.parse(
    await readFile('config/protocol/pons-reference.json', 'utf8'),
  );

  assert.equal(reference.referenceCommit, REFERENCE_COMMIT);
  assert.equal(reference.currentDocsFactory, CURRENT_DOCS_FACTORY);
  assert.equal(reference.parityStatus, 'REFERENCE_ONLY_NOT_PROVEN_CURRENT_LIVE_PARITY');
  assert.equal(reference.licenseInventory.rootLicenseFileObserved, false);
  assert.equal(reference.licenseInventory.inspectedProjectSourceSpdx, 'MIT');
  assert.equal(
    reference.sourceInventory['contractsV2/src/v2/PonsV2LaunchFactory.sol'].blobSha,
    '2bc506657902f4b829e45e0a10f88e2fd76239e6',
  );

  const reader = await readFile(
    'packages/protocol-sdk/src/pons-live-reconcile.ts',
    'utf8',
  );
  assert.match(reader, /createPublicClient/);
  assert.match(reader, /getBytecode/);
  assert.match(reader, /launchConfigCount/);
  assert.match(reader, /getLaunchConfig/);
  assert.match(reader, /launchFee/);
  assert.match(reader, /maxCreatorTaxBps/);
  assert.match(reader, /approvedPairTokens/);
  assert.match(reader, /pairTokenEconomics/);
  assert.doesNotMatch(reader, /writeContract/);
  assert.doesNotMatch(reader, /sendTransaction/);
});
