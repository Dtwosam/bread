import {
  chmodSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { assessArcTestnetSmokeFunding } from './arc-testnet-smoke-readiness-lib.mjs';

const ROOT = process.cwd();
const DEFAULT_SECRET_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe.env');
const DEFAULT_RECEIPT_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-bread-deployment.json');
const DEPLOYMENT_PATH = join(ROOT, 'config', 'deployments', 'arc-testnet.day5.json');
const SMOKE_BROADCAST_PATH = join(
  ROOT,
  'contracts',
  'broadcast',
  'SmokeDay5Graduation.s.sol',
  '5042002',
  'run-latest.json',
);

function fail(message) {
  console.error(`day9-bread-arc-smoke: FAIL: ${message}`);
  process.exit(1);
}

function argPath(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  if (!process.argv[index + 1]) fail(`${flag} requires a path`);
  return resolve(process.argv[index + 1]);
}

function parseEnv(path) {
  const values = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at <= 0) fail(`invalid env line in ${path}`);
    values[line.slice(0, at)] = line.slice(at + 1);
  }
  return values;
}

function requireValue(values, key) {
  const value = values[key];
  if (!value) fail(`missing ${key} in local authority file`);
  return value;
}

function redact(value, secrets) {
  let output = String(value ?? '');
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join('[REDACTED]');
  }
  return output;
}

function run(command, args, options = {}) {
  const secrets = options.secrets ?? [];
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * 1024 * 1024,
    timeout: options.timeout ?? 180_000,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    fail([
      `${command} ${args.join(' ')} exited ${result.status}`,
      redact(result.stdout, secrets),
      redact(result.stderr, secrets),
    ].join('\n'));
  }
  return (result.stdout ?? '').trim();
}

function parseUint(value, label) {
  const match = String(value).match(/\d+/);
  if (!match) fail(`${label} did not produce a uint: ${value}`);
  return BigInt(match[0]);
}

function normalizeAddress(value, label) {
  const match = String(value).match(/0x[0-9a-fA-F]{40}/);
  if (!match) fail(`${label} did not produce an address: ${value}`);
  return match[0].toLowerCase();
}

function toQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function addressTopic(address) {
  return `0x${address.slice(2).toLowerCase().padStart(64, '0')}`;
}

function topicAddress(topic, label) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(topic ?? '')) fail(`${label} is not an indexed address topic`);
  return `0x${topic.slice(-40)}`.toLowerCase();
}

async function rpc(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) fail(`RPC HTTP ${response.status} for ${method}`);
  const body = await response.json();
  if (body.error) fail(`RPC ${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

function transactionHashes(broadcast) {
  const hashes = [];
  for (const receipt of broadcast.receipts ?? []) {
    const hash = receipt.transactionHash ?? receipt.hash;
    if (typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash)) hashes.push(hash);
  }
  return hashes;
}

function writeReceipt(path, receipt) {
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

async function findSmokeLaunch({ rpcUrl, factory, operator, fromBlock }) {
  const topic0 = run('cast', ['keccak', 'LaunchCreated(address,address,address,address,uint16,bytes32,uint64)']);
  const logs = await rpc(rpcUrl, 'eth_getLogs', [{
    address: factory,
    fromBlock: toQuantity(fromBlock),
    toBlock: 'latest',
    topics: [topic0, addressTopic(operator)],
  }]);
  if (!Array.isArray(logs) || logs.length === 0) return null;
  if (logs.length > 1) fail(`multiple LaunchCreated events found for smoke operator after block ${fromBlock}; refusing ambiguous evidence`);
  const log = logs[0];
  if (!Array.isArray(log.topics) || log.topics.length < 4) fail('LaunchCreated log is missing indexed topics');
  return {
    token: topicAddress(log.topics[2], 'LaunchCreated token'),
    curve: topicAddress(log.topics[3], 'LaunchCreated curve'),
    transactionHash: log.transactionHash,
    blockNumber: Number(BigInt(log.blockNumber)),
  };
}

function verifyLockedPosition({ rpcUrl, locker, positionManager, token }) {
  const locked = run('cast', ['call', locker, 'isPositionLocked(address)(bool)', token, '--rpc-url', rpcUrl]);
  if (!/^true$/i.test(locked.trim())) fail(`token ${token} is not registered as permanently locked`);

  const raw = run('cast', ['call', locker, 'lockedPosition(address)(address,uint256)', token, '--rpc-url', rpcUrl]);
  const manager = normalizeAddress(raw, 'locked Position Manager');
  const idMatch = raw.match(/(\d+)\s*$/);
  if (!idMatch) fail(`lockedPosition did not expose a position ID: ${raw}`);
  const positionId = BigInt(idMatch[1]);
  if (positionId === 0n) fail('locked position ID is zero');
  if (manager !== positionManager.toLowerCase()) {
    fail(`locked Position Manager mismatch: expected ${positionManager}, got ${manager}`);
  }

  const nftOwner = normalizeAddress(
    run('cast', ['call', positionManager, 'ownerOf(uint256)(address)', positionId.toString(), '--rpc-url', rpcUrl]),
    'position NFT owner',
  );
  if (nftOwner !== locker.toLowerCase()) fail(`position NFT ${positionId} is not owned by permanent locker`);
  return { positionManager: manager, positionId: positionId.toString(), nftOwner };
}

const secretFile = argPath('--env-file', DEFAULT_SECRET_FILE);
const receiptFile = argPath('--receipt-file', DEFAULT_RECEIPT_FILE);
if (!existsSync(secretFile)) fail(`authority file not found: ${secretFile}`);
if ((statSync(secretFile).mode & 0o077) !== 0) fail('authority secret file permissions are broader than 0600-like');
if (!existsSync(receiptFile)) fail(`Bread deployment receipt not found: ${receiptFile}`);

const env = parseEnv(secretFile);
const rpcUrl = requireValue(env, 'ARC_RPC_URL');
const operator = requireValue(env, 'BREAD_SMOKE_OPERATOR').toLowerCase();
const smokePrivateKey = requireValue(env, 'BREAD_SMOKE_PRIVATE_KEY');
const secrets = [
  smokePrivateKey,
  env.BREAD_DEPLOYER_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_1_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_2_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_3_PRIVATE_KEY,
  env.BREAD_GUARDIAN_PRIVATE_KEY,
].filter(Boolean);

const derivedOperator = normalizeAddress(
  run('cast', ['wallet', 'address', '--private-key', smokePrivateKey], { secrets }),
  'smoke private key',
);
if (derivedOperator !== operator) fail('BREAD_SMOKE_PRIVATE_KEY does not match BREAD_SMOKE_OPERATOR');

let receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
if (receipt?.phase !== 'VERIFIED' || receipt?.verified !== true) {
  fail('Bread deployment receipt is not VERIFIED');
}
const manifest = JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf8'));
if (manifest.status !== 'VERIFIED') fail('canonical Arc Testnet deployment manifest is not VERIFIED');

run(process.execPath, ['scripts/day5/verify-graduation-deployment.mjs', 'arc-testnet'], {
  cwd: ROOT,
  env: { ...env, ARC_RPC_URL: rpcUrl, BREAD_RPC_URL: rpcUrl },
  timeout: 240_000,
  secrets,
});

if (receipt.smoke?.phase === 'PASS') {
  const lockedPosition = verifyLockedPosition({
    rpcUrl,
    locker: receipt.created.locker,
    positionManager: manifest.adapter.positionManager,
    token: receipt.smoke.token,
  });
  console.log(JSON.stringify({
    status: 'BREAD_ARC_TESTNET_SMOKE_PASS',
    resumed: true,
    transactionBroadcast: false,
    token: receipt.smoke.token,
    curve: receipt.smoke.curve,
    lockedPosition,
    originalSmokeTransactionHashes: receipt.smoke.transactionHashes,
    productionMoneyClaim: false,
    privateKeysPrinted: false,
    nextAction: 'RECORD_DAY9_PUBLIC_ARC_EVIDENCE_AND_RUN_REMAINING_GATES',
  }, null, 2));
  process.exit(0);
}

if (receipt.smoke?.phase === 'PREPARED') {
  const priorLaunch = await findSmokeLaunch({
    rpcUrl,
    factory: receipt.created.factory,
    operator,
    fromBlock: receipt.smoke.startBlock,
  });
  if (priorLaunch) {
    const locked = run('cast', [
      'call', receipt.created.locker, 'isPositionLocked(address)(bool)', priorLaunch.token, '--rpc-url', rpcUrl,
    ]).trim();
    fail(
      `smoke intent already has on-chain launch ${priorLaunch.token} at ${priorLaunch.transactionHash}; `
      + `permanentLock=${locked}. Refusing to create a second launch; recover/inspect the existing smoke instead.`,
    );
  }
  fail('smoke PREPARED intent exists without a detected launch; inspect prior execution before retrying');
}

const currentUsdc = parseUint(
  run('cast', ['call', manifest.adapter ? env.BREAD_USDC : '', 'balanceOf(address)(uint256)', operator, '--rpc-url', rpcUrl]),
  'smoke operator USDC balance',
);
const funding = assessArcTestnetSmokeFunding(currentUsdc);
if (!funding.ready) {
  console.log(JSON.stringify({
    status: 'BREAD_ARC_TESTNET_SMOKE_FUNDING_REQUIRED',
    chainId: 5_042_002,
    operator,
    currentUsdc: funding.currentUsdc,
    minimumUsdc: funding.minimumUsdc,
    missingUsdc: funding.missingUsdc,
    transactionBroadcast: false,
    privateKeysPrinted: false,
    nextAction: 'FUND_SMOKE_OPERATOR_WITH_ARC_TESTNET_NATIVE_USDC_AND_RERUN',
  }, null, 2));
  process.exitCode = 2;
} else {
  const sourceCommit = run('git', ['rev-parse', 'HEAD']);
  const startBlock = Number(run('cast', ['block-number', '--rpc-url', rpcUrl]).split(/\s+/)[0]);
  receipt = {
    ...receipt,
    smoke: {
      phase: 'PREPARED',
      sourceCommit,
      startBlock,
      operator,
      quoteIn: requireValue(env, 'BREAD_SMOKE_QUOTE_IN'),
      creatorTaxBps: requireValue(env, 'BREAD_SMOKE_CREATOR_TAX_BPS'),
      productionMoneyClaim: false,
    },
  };
  writeReceipt(receiptFile, receipt);

  run(process.execPath, ['scripts/day5/smoke-graduation.mjs', 'arc-testnet'], {
    cwd: ROOT,
    env: { ...env, ARC_RPC_URL: rpcUrl, BREAD_RPC_URL: rpcUrl },
    timeout: 300_000,
    secrets,
  });

  const launch = await findSmokeLaunch({
    rpcUrl,
    factory: receipt.created.factory,
    operator,
    fromBlock: startBlock,
  });
  if (!launch) fail('smoke script passed but no LaunchCreated event was found for the smoke operator');

  const lockedPosition = verifyLockedPosition({
    rpcUrl,
    locker: receipt.created.locker,
    positionManager: manifest.adapter.positionManager,
    token: launch.token,
  });

  const creatorClaimRemaining = parseUint(
    run('cast', [
      'call', receipt.created.feeEscrow, 'balanceOf(address)(uint256)', operator, '--rpc-url', rpcUrl,
    ]),
    'creator claim balance after smoke',
  );
  if (creatorClaimRemaining !== 0n) fail(`creator claim balance remains after smoke: ${creatorClaimRemaining}`);

  const finalUsdc = parseUint(
    run('cast', ['call', env.BREAD_USDC, 'balanceOf(address)(uint256)', operator, '--rpc-url', rpcUrl]),
    'smoke operator final USDC balance',
  );

  let smokeTxHashes = [];
  if (existsSync(SMOKE_BROADCAST_PATH)) {
    smokeTxHashes = transactionHashes(JSON.parse(readFileSync(SMOKE_BROADCAST_PATH, 'utf8')));
  }

  receipt = {
    ...receipt,
    smoke: {
      ...receipt.smoke,
      phase: 'PASS',
      endBlock: Number(run('cast', ['block-number', '--rpc-url', rpcUrl]).split(/\s+/)[0]),
      token: launch.token,
      curve: launch.curve,
      launchTransactionHash: launch.transactionHash,
      launchBlock: launch.blockNumber,
      lockedPosition,
      transactionHashes: smokeTxHashes,
      operatorUsdcBefore: funding.currentUsdc,
      operatorUsdcAfter: finalUsdc.toString(),
      creatorClaimRemaining: '0',
    },
  };
  writeReceipt(receiptFile, receipt);

  console.log(JSON.stringify({
    status: 'BREAD_ARC_TESTNET_SMOKE_PASS',
    chainId: 5_042_002,
    sourceCommit,
    token: launch.token,
    curve: launch.curve,
    launchTransactionHash: launch.transactionHash,
    lockedPosition,
    smokeTransactionHashes: smokeTxHashes,
    operatorUsdcBefore: funding.currentUsdc,
    operatorUsdcAfter: finalUsdc.toString(),
    creatorClaimRemaining: '0',
    transactionBroadcast: true,
    productionMoneyClaim: false,
    privateKeysPrinted: false,
    receiptFile,
    nextAction: 'RECORD_DAY9_PUBLIC_ARC_EVIDENCE_AND_RUN_REMAINING_GATES',
  }, null, 2));
}
