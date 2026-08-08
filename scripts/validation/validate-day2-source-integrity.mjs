import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix as path } from 'node:path';

const inventoryPath = 'config/protocol/day2-core-source-inventory.json';
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));

if (inventory.referenceCommit !== 'd5491e20be56051a68abf47136f6890c3ce3ff7d') {
  throw new Error(`unexpected Day 2 reference commit: ${inventory.referenceCommit}`);
}
if (inventory.parityClaim !== 'FROZEN_SOURCE_BEHAVIOR_ONLY_NOT_CURRENT_LIVE_PARITY') {
  throw new Error(`unexpected Day 2 parity claim: ${inventory.parityClaim}`);
}
if (inventory.dependencyPolicy?.dynamicInstallAllowed !== false) {
  throw new Error('Day 2 frozen OpenZeppelin dependencies must not be dynamically installed');
}
if (inventory.dependencyPolicy?.packageVersionClaim !== null) {
  throw new Error('Day 2 must not claim an unverified OpenZeppelin package version');
}

const trackedState = inventory.productionPorts?.BreadTrackedCurveState;
if (trackedState?.sourcePath !== 'contractsV2/src/v2/PonsV2BondingCurve.sol') {
  throw new Error(`unexpected tracked-state source path: ${trackedState?.sourcePath}`);
}
if (trackedState?.blobSha !== 'a5d84b3c355a1661e1bf61a4dd4e29591fbf6074') {
  throw new Error(`unexpected tracked-state source blob: ${trackedState?.blobSha}`);
}
if (trackedState?.portMode !== 'BOUNDED_TRACKED_RESERVE_EXTRACTION') {
  throw new Error(`unexpected tracked-state port mode: ${trackedState?.portMode}`);
}

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

const upstreamPrefix = 'contractsV2/lib/openzeppelin-contracts/contracts/';
const localPrefix = 'contracts/lib/openzeppelin-contracts/contracts/';
const vendoredFiles = inventory.dependencyPolicy?.vendoredFiles ?? {};

if (Object.keys(vendoredFiles).length !== 9) {
  throw new Error(`expected exactly 9 frozen OpenZeppelin files, got ${Object.keys(vendoredFiles).length}`);
}

for (const [upstreamPath, expectedSha] of Object.entries(vendoredFiles)) {
  if (!upstreamPath.startsWith(upstreamPrefix)) {
    throw new Error(`unexpected vendored upstream path: ${upstreamPath}`);
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error(`invalid frozen blob SHA for ${upstreamPath}: ${expectedSha}`);
  }

  const relative = upstreamPath.slice(upstreamPrefix.length);
  const localPath = path.join(localPrefix, relative);
  const bytes = await readFile(localPath);
  const actualSha = gitBlobSha(bytes);
  if (actualSha !== expectedSha) {
    throw new Error(`${localPath} drifted from frozen Pons blob: expected ${expectedSha}, got ${actualSha}`);
  }
}

console.log('day2-source-integrity-validation: PASS');
