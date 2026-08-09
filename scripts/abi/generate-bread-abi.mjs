import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const outputPath = path.join(repoRoot, 'packages/protocol-sdk/src/abi/generated.ts');

const specs = [
  {
    role: 'factory',
    artifact: 'BreadLaunchFactory.sol/BreadLaunchFactory.json',
    functions: new Set([
      'launchToken', 'launchTokenAndBuy', 'previewLaunchEconomics', 'currentLaunchConfig', 'getLaunch',
      'tokenForCurve', 'stackVersion', 'usdc', 'feePolicy', 'feeEscrow', 'emergencyController',
      'configVersion', 'graduationCoordinator', 'launchDeployer', 'owner',
    ]),
  },
  {
    role: 'curve',
    artifact: 'BreadBondingCurve.sol/BreadBondingCurve.json',
    functions: new Set([
      'buy', 'sell', 'sweepFees', 'releaseForGraduation', 'currentSnipeTaxBps', 'graduationCoordinator',
      'getReserves', 'quoteReserve', 'realQuoteReserve', 'tokenReserve', 'sellableTokens', 'readyToGraduate',
      'token', 'pairToken', 'phantomQuote', 'graduationThreshold', 'quoteFeeBalance', 'creatorTaxBalance',
      'trackedQuote', 'trackedTokens', 'reservedTokens', 'graduated', 'creatorFeeRecipient', 'factory',
      'feePolicy', 'feeEscrow', 'emergencyController', 'protocolFeeRecipient', 'tradeFeeBps',
      'protocolFeeShareBps', 'maxCreatorTaxBps', 'creatorTaxBps', 'launchTimestamp',
      'launchBuyExemptionConsumed',
    ]),
  },
  {
    role: 'feeEscrow',
    artifact: 'BreadFeeEscrow.sol/BreadFeeEscrow.json',
    functions: new Set(['claim', 'balanceOf', 'totalOutstanding', 'surplus', 'usdc', 'authorizedCreditor', 'owner']),
  },
  {
    role: 'feePolicy',
    artifact: 'BreadFeePolicy.sol/BreadFeePolicy.json',
    functions: new Set(['currentFeePolicy', 'feeSweepOperator', 'owner']),
  },
  {
    role: 'emergencyController',
    artifact: 'BreadEmergencyController.sol/BreadEmergencyController.json',
    functions: new Set([
      'guardian', 'restrictionMode', 'graduationPaused', 'launchesAllowed', 'buysAllowed', 'sellsAllowed', 'owner',
    ]),
  },
  {
    role: 'coordinator',
    artifact: 'GraduationCoordinator.sol/GraduationCoordinator.json',
    functions: new Set([
      'sweep', 'createPool', 'getGraduation', 'factory', 'usdc', 'feeEscrow', 'emergencyController', 'locker',
      'totalSweptUsdc', 'owner',
    ]),
  },
  {
    role: 'locker',
    artifact: 'BreadPermanentLiquidityLocker.sol/BreadPermanentLiquidityLocker.json',
    functions: new Set([
      'coordinator', 'wiringAuthority', 'lockedTokenSupply', 'isPositionLocked', 'lockedPosition',
    ]),
  },
  {
    role: 'launchToken',
    artifact: 'BreadLaunchToken.sol/BreadLaunchToken.json',
    functions: new Set([
      'name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'allowance', 'approve', 'transfer', 'transferFrom',
      'deployer', 'launchFactory', 'curve', 'logo', 'description', 'socials', 'getTokenInfo',
    ]),
  },
];

function signatureKey(item) {
  const inputs = Array.isArray(item.inputs) ? item.inputs.map((input) => input.type ?? '').join(',') : '';
  return `${item.type ?? ''}:${item.name ?? ''}(${inputs})`;
}

function keepAbiItem(item, functions) {
  if (item?.type === 'event' || item?.type === 'error') return true;
  return item?.type === 'function' && functions.has(item.name);
}

export async function generateBreadAbiSource() {
  const registry = {};
  for (const spec of specs) {
    const artifactPath = path.join(repoRoot, 'contracts/out', spec.artifact);
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
    if (!Array.isArray(artifact.abi)) throw new Error(`artifact ABI missing: ${spec.artifact}`);
    const filtered = artifact.abi
      .filter((item) => keepAbiItem(item, spec.functions))
      .sort((a, b) => signatureKey(a).localeCompare(signatureKey(b)));
    if (filtered.length === 0) throw new Error(`empty generated ABI: ${spec.role}`);
    registry[spec.role] = filtered;
  }

  return `// GENERATED from exact Foundry artifacts by scripts/abi/generate-bread-abi.mjs.\n` +
    `// Do not edit by hand.\n` +
    `export const breadAbiRegistry = ${JSON.stringify(registry, null, 2)} as const;\n`;
}

export async function writeBreadAbiSource() {
  const source = await generateBreadAbiSource();
  await writeFile(outputPath, source, 'utf8');
  return source;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await writeBreadAbiSource();
  console.log(`bread-abi-generation: WROTE ${path.relative(repoRoot, outputPath)}`);
}
