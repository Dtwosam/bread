import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createPublicClient, defineChain, http } from 'viem';

import { assertArcSmokeFinalEvidence } from '../../../scripts/day9/arc-smoke-final-evidence-lib.mjs';

const ROOT = process.cwd();
const SECRET_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe.env');
const RECEIPT_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-bread-deployment.json');
const MANIFEST_FILE = join(ROOT, 'config', 'deployments', 'arc-testnet.day5.json');
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const coordinatorAbi = [{
  type: 'function', name: 'getGraduation', stateMutability: 'view',
  inputs: [{ name: 'token', type: 'address' }],
  outputs: [{ name: 'record', type: 'tuple', components: [
    { name: 'phase', type: 'uint8' },
    { name: 'sweptAt', type: 'uint64' },
    { name: 'sweptUsdc', type: 'uint256' },
    { name: 'sweptTokens', type: 'uint256' },
    { name: 'poolTokenAmount', type: 'uint256' },
    { name: 'poolId', type: 'bytes32' },
    { name: 'positionManager', type: 'address' },
    { name: 'positionId', type: 'uint256' },
  ] }],
}, {
  type: 'function', name: 'createPool', stateMutability: 'nonpayable',
  inputs: [{ name: 'token', type: 'address' }],
  outputs: [{ name: 'poolId', type: 'bytes32' }, { name: 'positionId', type: 'uint256' }],
}];

const lockerAbi = [{
  type: 'function', name: 'isPositionLocked', stateMutability: 'view',
  inputs: [{ name: 'token', type: 'address' }], outputs: [{ name: 'locked', type: 'bool' }],
}, {
  type: 'function', name: 'lockedPosition', stateMutability: 'view',
  inputs: [{ name: 'token', type: 'address' }],
  outputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }],
}];

const feeEscrowAbi = [{
  type: 'function', name: 'balanceOf', stateMutability: 'view',
  inputs: [{ name: 'recipient', type: 'address' }], outputs: [{ name: 'amount', type: 'uint256' }],
}, {
  type: 'event', name: 'FeeClaimed', anonymous: false,
  inputs: [
    { name: 'recipient', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'remainingBalance', type: 'uint256', indexed: false },
    { name: 'totalOutstanding', type: 'uint256', indexed: false },
  ],
}];

const erc721Abi = [{
  type: 'function', name: 'ownerOf', stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }],
}];

function fail(message) {
  console.error(`day9-arc-smoke-verify: FAIL: ${message}`);
  process.exit(1);
}

function parseEnv(path) {
  const values = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at > 0) values[line.slice(0, at)] = line.slice(at + 1);
  }
  return values;
}

function addr(value, label) {
  if (!ADDRESS_RE.test(value ?? '') || /^0x0{40}$/i.test(value)) fail(`${label} is not a non-zero address`);
  return value.toLowerCase();
}

for (const file of [SECRET_FILE, RECEIPT_FILE, MANIFEST_FILE]) {
  if (!existsSync(file)) fail(`required file missing: ${file}`);
}
const env = parseEnv(SECRET_FILE);
const receipt = JSON.parse(readFileSync(RECEIPT_FILE, 'utf8'));
const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
if (receipt?.phase !== 'VERIFIED' || receipt?.verified !== true) fail('deployment receipt is not VERIFIED');
if (receipt?.smoke?.phase !== 'PASS') fail(`smoke receipt is not PASS: ${receipt?.smoke?.phase ?? 'missing'}`);
if (!Number.isSafeInteger(receipt.smoke.startBlock) || receipt.smoke.startBlock <= 0) fail('smoke startBlock is invalid');
if (manifest?.status !== 'VERIFIED' || manifest?.chainId !== 5_042_002) fail('canonical Arc Testnet manifest is not VERIFIED');

const rpcUrl = env.ARC_RPC_URL;
if (!rpcUrl) fail('ARC_RPC_URL is missing from local authority file');
const operator = addr(env.BREAD_SMOKE_OPERATOR, 'smoke operator');
const token = addr(receipt.smoke.token, 'smoke token');
const coordinator = addr(receipt.created.coordinator, 'coordinator');
const locker = addr(receipt.created.locker, 'locker');
const feeEscrow = addr(receipt.created.feeEscrow, 'feeEscrow');
const expectedManager = addr(manifest.adapter.positionManager, 'manifest Position Manager');

const chain = defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc Testnet USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const client = createPublicClient({ chain, transport: http(rpcUrl) });
if (await client.getChainId() !== chain.id) fail('Arc Testnet chain ID mismatch');

const claimEvent = feeEscrowAbi.find((item) => item.type === 'event' && item.name === 'FeeClaimed');
const claimLogs = await client.getLogs({
  address: feeEscrow,
  event: claimEvent,
  args: { recipient: operator },
  fromBlock: BigInt(receipt.smoke.startBlock),
  toBlock: 'latest',
  strict: true,
});
const creatorCredit = await client.readContract({
  address: feeEscrow, abi: feeEscrowAbi, functionName: 'balanceOf', args: [operator],
});
const locked = await client.readContract({
  address: locker, abi: lockerAbi, functionName: 'isPositionLocked', args: [token],
});
if (!locked) fail('smoke token is not permanently locked');
const [lockerManagerRaw, lockerPositionId] = await client.readContract({
  address: locker, abi: lockerAbi, functionName: 'lockedPosition', args: [token],
});
const lockerManager = addr(String(lockerManagerRaw), 'locker Position Manager');
if (lockerManager !== expectedManager) fail('locker Position Manager does not match canonical manifest');
const nftOwner = addr(String(await client.readContract({
  address: lockerManager, abi: erc721Abi, functionName: 'ownerOf', args: [lockerPositionId],
})), 'LP NFT owner');
const graduation = await client.readContract({
  address: coordinator, abi: coordinatorAbi, functionName: 'getGraduation', args: [token],
});

let replayRejected = false;
try {
  await client.simulateContract({
    account: operator,
    address: coordinator,
    abi: coordinatorAbi,
    functionName: 'createPool',
    args: [token],
  });
} catch {
  replayRejected = true;
}

assertArcSmokeFinalEvidence({
  creatorClaimLogCount: claimLogs.length,
  creatorCredit,
  graduationPhase: Number(graduation.phase),
  sweptUsdc: graduation.sweptUsdc,
  sweptTokens: graduation.sweptTokens,
  poolTokenAmount: graduation.poolTokenAmount,
  lockerPositionManager: lockerManager,
  graduationPositionManager: String(graduation.positionManager),
  lockerPositionId,
  graduationPositionId: graduation.positionId,
  nftOwner,
  locker,
  replayRejected,
});

const recordedHashes = Array.isArray(receipt.smoke.transactionHashes)
  ? receipt.smoke.transactionHashes
  : (receipt.smoke.transactions ?? []).map((item) => item.hash).filter(Boolean);

console.log(JSON.stringify({
  status: 'BREAD_ARC_TESTNET_SMOKE_FINAL_EVIDENCE_PASS',
  chainId: chain.id,
  token,
  curve: receipt.smoke.curve,
  launchTransactionHash: receipt.smoke.launchTransactionHash,
  creatorClaimLogCount: claimLogs.length,
  creatorClaimRemaining: creatorCredit.toString(),
  lockedPosition: {
    positionManager: lockerManager,
    positionId: lockerPositionId.toString(),
    nftOwner,
  },
  graduationResidueZero: true,
  replayRejected: true,
  smokeTransactionHashes: recordedHashes,
  productionMoneyClaim: false,
  privateKeysUsedByVerifier: false,
  privateKeysPrinted: false,
  nextAction: 'RECORD_DAY9_PUBLIC_ARC_EVIDENCE_AND_RUN_REMAINING_GATES',
}, null, 2));
