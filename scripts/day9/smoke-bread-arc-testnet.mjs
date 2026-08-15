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
const DIRECT_SMOKE_RUNNER = join(ROOT, 'packages', 'protocol-sdk', 'scripts', 'day9-arc-direct-smoke.mjs');

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

function writeReceipt(path, receipt) {
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

const secretFile = argPath('--env-file', DEFAULT_SECRET_FILE);
const receiptFile = argPath('--receipt-file', DEFAULT_RECEIPT_FILE);
if (!existsSync(secretFile)) fail(`authority file not found: ${secretFile}`);
if ((statSync(secretFile).mode & 0o077) !== 0) fail('authority secret file permissions are broader than 0600-like');
if (!existsSync(receiptFile)) fail(`Bread deployment receipt not found: ${receiptFile}`);
if (!existsSync(DIRECT_SMOKE_RUNNER)) fail(`direct Arc smoke runner not found: ${DIRECT_SMOKE_RUNNER}`);

const env = parseEnv(secretFile);
const rpcUrl = requireValue(env, 'ARC_RPC_URL');
const usdc = requireValue(env, 'BREAD_USDC');
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
if (manifest.chainId !== 5_042_002) fail(`canonical deployment manifest chain ID is ${manifest.chainId}`);
if (manifest.adapter?.family !== 'UNISWAP_V3' || !manifest.adapter?.positionManager) {
  fail('canonical Arc Testnet deployment manifest has no active UNISWAP_V3 Position Manager');
}

run(process.execPath, ['scripts/day5/verify-graduation-deployment.mjs', 'arc-testnet'], {
  cwd: ROOT,
  env: { ...env, ARC_RPC_URL: rpcUrl, BREAD_RPC_URL: rpcUrl },
  timeout: 240_000,
  secrets,
});

if (receipt.smoke?.phase === 'PASS') {
  console.log(JSON.stringify({
    status: 'BREAD_ARC_TESTNET_SMOKE_PASS',
    resumed: true,
    transactionBroadcast: false,
    token: receipt.smoke.token,
    curve: receipt.smoke.curve,
    lockedPosition: receipt.smoke.lockedPosition,
    originalSmokeTransactionHashes: receipt.smoke.transactionHashes,
    executionMode: receipt.smoke.executionMode,
    productionMoneyClaim: false,
    privateKeysPrinted: false,
    nextAction: 'RECORD_DAY9_PUBLIC_ARC_EVIDENCE_AND_RUN_REMAINING_GATES',
  }, null, 2));
  process.exit(0);
}

const currentHead = run('git', ['rev-parse', 'HEAD']);

if (!receipt.smoke) {
  const currentUsdc = parseUint(
    run('cast', ['call', usdc, 'balanceOf(address)(uint256)', operator, '--rpc-url', rpcUrl]),
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
    process.exit();
  }

  const startBlock = Number(run('cast', ['block-number', '--rpc-url', rpcUrl]).split(/\s+/)[0]);
  receipt = {
    ...receipt,
    smoke: {
      phase: 'PREPARED_DIRECT_RPC',
      sourceCommit: currentHead,
      deploymentSourceCommit: receipt.sourceCommit,
      directRpcRunnerSourceCommit: currentHead,
      startBlock,
      operator,
      quoteIn: requireValue(env, 'BREAD_SMOKE_QUOTE_IN'),
      creatorTaxBps: requireValue(env, 'BREAD_SMOKE_CREATOR_TAX_BPS'),
      productionMoneyClaim: false,
      executionMode: 'DIRECT_ARC_RPC_WITH_REAL_NODE_SIMULATION_PER_TRANSACTION',
    },
  };
  writeReceipt(receiptFile, receipt);
} else {
  receipt = {
    ...receipt,
    smoke: {
      ...receipt.smoke,
      deploymentSourceCommit: receipt.smoke.deploymentSourceCommit ?? receipt.sourceCommit,
      directRpcRunnerSourceCommit: currentHead,
      recoveredFromFoundryLocalSimulationFailure: receipt.smoke.phase === 'PREPARED',
      executionMode: 'DIRECT_ARC_RPC_WITH_REAL_NODE_SIMULATION_PER_TRANSACTION',
    },
  };
  writeReceipt(receiptFile, receipt);
}

const directOutput = run(process.execPath, [DIRECT_SMOKE_RUNNER], {
  cwd: ROOT,
  timeout: 600_000,
  env: {
    ...env,
    ARC_RPC_URL: rpcUrl,
    BREAD_RPC_URL: rpcUrl,
    BREAD_POSITION_MANAGER: manifest.adapter.positionManager,
    BREAD_SMOKE_RECEIPT_FILE: receiptFile,
  },
  secrets,
});

console.log(directOutput);
