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

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

const upstreamPrefix = 'contractsV2/lib/openzeppelin-contracts/contracts/';
const localPrefix = 'contracts/lib/openzeppelin-contracts/contracts/';
const vendoredFiles = inventory.dependencyPolicy?.vendoredFiles ?? {};

if (Object.keys(vendoredFiles).length !== 6) {
  throw new Error(`expected exactly 6 frozen OpenZeppelin files, got ${Object.keys(vendoredFiles).length}`);
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
