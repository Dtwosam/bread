import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { posix as path } from 'node:path';

const inventoryPath = 'config/protocol/day3-trading-source-inventory.json';
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));

if (inventory.breadSourcePack?.version !== 'v1.3') {
  throw new Error(`unexpected Bread source pack: ${inventory.breadSourcePack?.version}`);
}
if (inventory.ponsTradingReference?.commit !== 'd5491e20be56051a68abf47136f6890c3ce3ff7d') {
  throw new Error(`unexpected Day 3 Pons reference commit: ${inventory.ponsTradingReference?.commit}`);
}
if (inventory.ponsTradingReference?.blobSha !== 'a5d84b3c355a1661e1bf61a4dd4e29591fbf6074') {
  throw new Error(`unexpected Day 3 Pons curve blob: ${inventory.ponsTradingReference?.blobSha}`);
}
if (inventory.feeEscrowReference?.classification !== 'ADAPT_PATTERN_ONLY') {
  throw new Error(`unexpected FeeEscrow reuse classification: ${inventory.feeEscrowReference?.classification}`);
}
if (inventory.dependencyPolicy?.dynamicInstallAllowed !== false) {
  throw new Error('Day 3 frozen OpenZeppelin dependencies must not be dynamically installed');
}
if (inventory.breadBoundaries?.quoteAsset !== 'canonical 6-decimal ERC20 USDC only') {
  throw new Error(`unexpected Day 3 quote boundary: ${inventory.breadBoundaries?.quoteAsset}`);
}
if (inventory.breadBoundaries?.nativeQuote !== false) {
  throw new Error('Day 3 must remain ERC20-USDC-only');
}
if (inventory.breadBoundaries?.buybackDay3 !== false) {
  throw new Error('Day 3 source inventory must not authorize buyback');
}
if (inventory.breadBoundaries?.launchAndBuyDay3 !== false || inventory.breadBoundaries?.antiSnipeDay3 !== false) {
  throw new Error('Day 3 source inventory must not pull Day-4 Launch+Buy or anti-snipe forward');
}
if (
  inventory.parityClaim
  !== 'FROZEN_SOURCE_BEHAVIOR_AND_APPROVED_BREAD_ADAPTATION_ONLY_NOT_CURRENT_LIVE_PONS_PARITY'
) {
  throw new Error(`unexpected Day 3 parity claim: ${inventory.parityClaim}`);
}

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

const upstreamPrefix = 'contractsV2/lib/openzeppelin-contracts/contracts/';
const localPrefix = 'contracts/lib/openzeppelin-contracts/contracts/';
const files = inventory.dependencyPolicy?.day3ToVendorBeforeGreen ?? {};

if (Object.keys(files).length !== 9) {
  throw new Error(`expected exactly 9 Day 3 frozen OpenZeppelin files, got ${Object.keys(files).length}`);
}

for (const [upstreamPath, expectedSha] of Object.entries(files)) {
  if (!upstreamPath.startsWith(upstreamPrefix)) {
    throw new Error(`unexpected Day 3 vendored upstream path: ${upstreamPath}`);
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error(`invalid Day 3 frozen blob SHA for ${upstreamPath}: ${expectedSha}`);
  }

  const relative = upstreamPath.slice(upstreamPrefix.length);
  const localPath = path.join(localPrefix, relative);
  const bytes = await readFile(localPath);
  const actualSha = gitBlobSha(bytes);
  if (actualSha !== expectedSha) {
    throw new Error(`${localPath} drifted from frozen Pons blob: expected ${expectedSha}, got ${actualSha}`);
  }
}

console.log('day3-source-integrity-validation: PASS');
