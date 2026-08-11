import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { renderSecretEnv, validateAuthoritySet } from './arc-safe-bootstrap-lib.mjs';

const ROOT = process.cwd();
const CONTRACTS = join(ROOT, 'contracts');
const DEFAULT_SECRET_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe.env');
const ZERO = '0x0000000000000000000000000000000000000000';

function fail(message) {
  console.error(`day9-arc-safe-create: FAIL: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 120_000,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    fail([
      `${command} ${args.join(' ')} exited ${result.status}`,
      result.stdout ?? '',
      result.stderr ?? '',
    ].join('\n'));
  }
  return (result.stdout ?? '').trim();
}

function secretFilePath() {
  const index = process.argv.indexOf('--env-file');
  return resolve(index === -1 ? DEFAULT_SECRET_FILE : process.argv[index + 1]);
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

function requireValue(env, key) {
  const value = env[key];
  if (!value) fail(`missing ${key} in local authority file`);
  return value;
}

function parseAddress(output, label) {
  const match = String(output).match(/0x[0-9a-fA-F]{40}/);
  if (!match) fail(`${label} did not produce an address: ${output}`);
  return match[0].toLowerCase();
}

function codeBytes(code) {
  if (!/^0x[0-9a-fA-F]*$/.test(code)) fail(`unexpected eth_getCode response: ${code}`);
  return Math.max(0, (code.length - 2) / 2);
}

function upsert(values, key, value) {
  values[key] = value;
}

function verifySafe({ rpc, safe, expectedOwners }) {
  const code = run('cast', ['code', safe, '--rpc-url', rpc]);
  if (codeBytes(code) === 0) fail('created Safe has no runtime code');

  const version = run('cast', ['call', safe, 'VERSION()(string)', '--rpc-url', rpc]);
  if (!version.includes('1.4.1')) fail(`unexpected Safe version: ${version}`);

  const thresholdRaw = run('cast', ['call', safe, 'getThreshold()(uint256)', '--rpc-url', rpc]);
  const thresholdMatch = thresholdRaw.match(/\d+/);
  if (!thresholdMatch || BigInt(thresholdMatch[0]) !== 2n) fail(`unexpected Safe threshold: ${thresholdRaw}`);

  const ownersRaw = run('cast', ['call', safe, 'getOwners()(address[])', '--rpc-url', rpc]);
  const owners = [...ownersRaw.matchAll(/0x[0-9a-fA-F]{40}/g)].map((match) => match[0].toLowerCase());
  if (owners.length !== 3) fail(`unexpected Safe owner count: ${ownersRaw}`);
  const actual = new Set(owners);
  for (const owner of expectedOwners.map((value) => value.toLowerCase())) {
    if (!actual.has(owner)) fail(`Safe is missing expected owner ${owner}`);
  }

  return { version: '1.4.1', threshold: 2, owners, codeBytes: codeBytes(code) };
}

const secretFile = secretFilePath();
const env = parseEnv(secretFile);
const rpc = requireValue(env, 'ARC_RPC_URL');
const chainId = Number(requireValue(env, 'BREAD_CHAIN_ID'));
const safeL2 = requireValue(env, 'BREAD_DAY9_SAFE_L2');
const factory = requireValue(env, 'BREAD_DAY9_SAFE_PROXY_FACTORY');
const saltNonce = requireValue(env, 'BREAD_DAY9_SAFE_SALT_NONCE');
const deployer = requireValue(env, 'BREAD_DEPLOYMENT_AUTHORITY');
const guardian = requireValue(env, 'BREAD_GUARDIAN');
const owners = [
  requireValue(env, 'BREAD_SAFE_OWNER_1'),
  requireValue(env, 'BREAD_SAFE_OWNER_2'),
  requireValue(env, 'BREAD_SAFE_OWNER_3'),
];
validateAuthoritySet({ deployer, guardian, owners });

if (chainId !== 5_042_002) fail(`expected Arc Testnet chain ID 5042002, got ${chainId}`);
const actualChainId = Number(run('cast', ['chain-id', '--rpc-url', rpc]).split(/\s+/)[0]);
if (actualChainId !== chainId) fail(`RPC chain ID mismatch: ${actualChainId}`);

for (const [label, address] of [['SafeL2', safeL2], ['SafeProxyFactory', factory]]) {
  const code = run('cast', ['code', address, '--rpc-url', rpc]);
  if (codeBytes(code) === 0) fail(`${label} has no code on Arc Testnet`);
}

const initializer = run('cast', [
  'calldata',
  'setup(address[],uint256,address,bytes,address,address,uint256,address)',
  `[${owners.join(',')}]`,
  '2',
  ZERO,
  '0x',
  ZERO,
  ZERO,
  '0',
  ZERO,
]);

const predictedSafe = parseAddress(run('cast', [
  'call',
  factory,
  'createChainSpecificProxyWithNonce(address,bytes,uint256)(address)',
  safeL2,
  initializer,
  saltNonce,
  '--from',
  deployer,
  '--rpc-url',
  rpc,
]), 'Safe creation simulation');

const existingCode = run('cast', ['code', predictedSafe, '--rpc-url', rpc]);
let broadcastPerformed = false;

if (codeBytes(existingCode) === 0) {
  const gasEstimate = BigInt(run('cast', [
    'estimate',
    factory,
    'createChainSpecificProxyWithNonce(address,bytes,uint256)',
    safeL2,
    initializer,
    saltNonce,
    '--from',
    deployer,
    '--rpc-url',
    rpc,
  ]).match(/\d+/)?.[0] ?? '0');
  const gasPrice = BigInt(run('cast', ['gas-price', '--rpc-url', rpc]).match(/\d+/)?.[0] ?? '0');
  const balance = BigInt(run('cast', ['balance', deployer, '--rpc-url', rpc]).match(/\d+/)?.[0] ?? '0');
  const minimumRequired = gasEstimate * gasPrice * 2n;

  if (gasEstimate === 0n || gasPrice === 0n) fail('could not obtain a non-zero Safe deployment gas estimate');
  if (balance < minimumRequired) {
    console.log(JSON.stringify({
      status: 'SAFE_DEPLOYER_FUNDING_REQUIRED',
      chainId,
      deploymentAuthority: deployer,
      predictedSafe,
      currentNativeBalanceWei: balance.toString(),
      estimatedGas: gasEstimate.toString(),
      gasPriceWei: gasPrice.toString(),
      minimumNativeBalanceWei: minimumRequired.toString(),
      privateKeysPrinted: false,
      transactionBroadcast: false,
      nextAction: 'FUND_DEPLOYMENT_AUTHORITY_WITH_ARC_TESTNET_GAS_AND_RERUN',
    }, null, 2));
    process.exitCode = 2;
  } else {
    run('forge', [
      'script',
      'script/rehearsal/CreateDay9ArcSafe.s.sol:CreateDay9ArcSafe',
      '--broadcast',
      '--rpc-url',
      rpc,
      '--non-interactive',
    ], {
      cwd: CONTRACTS,
      timeout: 180_000,
      env,
    });
    broadcastPerformed = true;
  }
}

if (process.exitCode !== 2) {
  const verified = verifySafe({ rpc, safe: predictedSafe, expectedOwners: owners });
  upsert(env, 'BREAD_DAY9_SAFE_ADDRESS', predictedSafe);
  upsert(env, 'BREAD_PROTOCOL_ADMIN', predictedSafe);
  // Testnet-only default: keep protocol-fee custody under the same threshold Safe rather than the deployer EOA.
  upsert(env, 'BREAD_PROTOCOL_FEE_RECIPIENT', predictedSafe);
  writeFileSync(secretFile, renderSecretEnv(env), { encoding: 'utf8', mode: 0o600 });
  chmodSync(secretFile, 0o600);

  console.log(JSON.stringify({
    status: 'DAY9_ARC_SAFE_2_OF_3_PASS',
    chainId,
    safe: predictedSafe,
    safeVersion: verified.version,
    threshold: verified.threshold,
    owners: verified.owners,
    guardian,
    deploymentAuthority: deployer,
    safeCodeBytes: verified.codeBytes,
    chainSpecificProxy: true,
    transactionBroadcast: broadcastPerformed,
    privateKeysPrinted: false,
    officialSafeServiceSupportClaim: false,
    productionAuthorityClaim: false,
    protocolFeeRecipientTestnetOnly: predictedSafe,
    nextAction: 'PREPARE_AND_RUN_BREAD_ARC_TESTNET_DEPLOYMENT_PREFLIGHT',
  }, null, 2));
}
