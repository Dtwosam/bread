import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { renderSecretEnv, validateAuthoritySet } from './arc-safe-bootstrap-lib.mjs';
import { buildArcTestnetDeploymentPlan } from './arc-testnet-deployment-preflight-lib.mjs';
import { buildArcTestnetDeploymentManifest } from './arc-testnet-deployment-manifest-lib.mjs';

const ROOT = process.cwd();
const CONTRACTS = join(ROOT, 'contracts');
const DEFAULT_SECRET_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe.env');
const DEFAULT_RECEIPT_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-bread-deployment.json');
const NETWORK_PATH = join(ROOT, 'config', 'networks', 'arc-testnet.json');
const DEPLOYMENT_PATH = join(ROOT, 'config', 'deployments', 'arc-testnet.day5.json');
const BROADCAST_PATH = join(
  CONTRACTS,
  'broadcast',
  'DeployDay5Graduation.s.sol',
  '5042002',
  'run-latest.json',
);

function fail(message) {
  console.error(`day9-bread-arc-deploy: FAIL: ${message}`);
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

function normalizeHash(value, label) {
  const match = String(value).match(/0x[0-9a-fA-F]{64}/);
  if (!match) fail(`${label} did not produce a bytes32 hash: ${value}`);
  return match[0];
}

function codeBytes(rpc, address) {
  const code = run('cast', ['code', address, '--rpc-url', rpc]);
  if (!/^0x[0-9a-fA-F]*$/.test(code)) fail(`unexpected bytecode response for ${address}`);
  return Math.max(0, (code.length - 2) / 2);
}

function createdAddress(broadcast, contractName) {
  const tx = broadcast.transactions?.find((item) =>
    item.transactionType === 'CREATE'
      && item.contractName === contractName
      && typeof item.contractAddress === 'string'
  );
  if (!tx?.contractAddress) fail(`broadcast is missing CREATE address for ${contractName}`);
  return tx.contractAddress;
}

function createdFromBroadcast(broadcast) {
  return {
    feePolicy: createdAddress(broadcast, 'BreadFeePolicy'),
    feeEscrow: createdAddress(broadcast, 'BreadFeeEscrow'),
    emergencyController: createdAddress(broadcast, 'BreadEmergencyController'),
    factory: createdAddress(broadcast, 'BreadLaunchFactory'),
    deployer: createdAddress(broadcast, 'BreadLaunchDeployer'),
    locker: createdAddress(broadcast, 'BreadPermanentLiquidityLocker'),
    coordinator: createdAddress(broadcast, 'GraduationCoordinator'),
    adapter: createdAddress(broadcast, 'BreadV3GraduationAdapter'),
  };
}

function transactionHashes(broadcast) {
  const hashes = [];
  for (const receipt of broadcast.receipts ?? []) {
    const hash = receipt.transactionHash ?? receipt.hash;
    if (typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash)) hashes.push(hash);
  }
  return hashes;
}

function writeJson0600(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

function writeManifest(value) {
  writeFileSync(DEPLOYMENT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertCreatedLive(created, rpc, context) {
  for (const [label, address] of Object.entries(created ?? {})) {
    if (codeBytes(rpc, address) === 0) fail(`${context} ${label} ${address} has no runtime code`);
  }
  if (!created || Object.keys(created).length !== 8) fail(`${context} does not contain the complete Bread address set`);
}

const secretFile = argPath('--env-file', DEFAULT_SECRET_FILE);
const receiptFile = argPath('--receipt-file', DEFAULT_RECEIPT_FILE);
if (resolve(secretFile).startsWith(`${resolve(ROOT)}/`)) fail('authority secret file must remain outside the repository');
if (existsSync(secretFile) && ((statSync(secretFile).mode & 0o077) !== 0)) {
  fail('authority secret file permissions are broader than 0600-like');
}

let env = parseEnv(secretFile);
const rpc = requireValue(env, 'ARC_RPC_URL');
const deploymentAuthority = requireValue(env, 'BREAD_DEPLOYMENT_AUTHORITY');
const guardian = requireValue(env, 'BREAD_GUARDIAN');
const safe = requireValue(env, 'BREAD_DAY9_SAFE_ADDRESS');
const owners = [
  requireValue(env, 'BREAD_SAFE_OWNER_1'),
  requireValue(env, 'BREAD_SAFE_OWNER_2'),
  requireValue(env, 'BREAD_SAFE_OWNER_3'),
];
validateAuthoritySet({ deployer: deploymentAuthority, guardian, owners });

const secrets = [
  env.BREAD_DEPLOYER_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_1_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_2_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_3_PRIVATE_KEY,
  env.BREAD_GUARDIAN_PRIVATE_KEY,
].filter(Boolean);

const network = JSON.parse(readFileSync(NETWORK_PATH, 'utf8'));
const plan = buildArcTestnetDeploymentPlan({
  network,
  authority: { deploymentAuthority, guardian, safe, owners },
});

let receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, 'utf8')) : null;
let broadcastPerformed = false;
let resumedFromIntent = false;

if (receipt) {
  if (receipt?.schema !== 'bread://receipts/day9-arc-testnet-deployment-v1') fail('invalid deployment receipt schema');
  if (receipt.chainId !== plan.chainId) fail('deployment receipt chain ID mismatch');

  if (receipt.phase === 'PREPARED') {
    const currentHead = run('git', ['rev-parse', 'HEAD']);
    if (currentHead !== receipt.sourceCommit) {
      fail(`prepared deployment intent belongs to source commit ${receipt.sourceCommit}; current HEAD is ${currentHead}`);
    }
    if (!existsSync(BROADCAST_PATH)) {
      fail('prepared deployment intent exists but no Arc broadcast file is present; inspect before retrying to avoid duplicate deployment');
    }
    const broadcast = JSON.parse(readFileSync(BROADCAST_PATH, 'utf8'));
    const created = createdFromBroadcast(broadcast);
    assertCreatedLive(created, rpc, 'recovered broadcast');
    const adapterConfigHash = normalizeHash(
      run('cast', ['call', created.adapter, 'configHash()(bytes32)', '--rpc-url', rpc]),
      'adapter configHash',
    );
    receipt = {
      ...receipt,
      phase: 'BROADCASTED',
      created,
      hashes: {
        adapterConfigHash,
        economicsConfigHash: requireValue(env, 'BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED'),
        dexEvidenceHash: requireValue(env, 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED'),
      },
      transactionHashes: transactionHashes(broadcast),
      recoveredFromPreparedIntent: true,
    };
    writeJson0600(receiptFile, receipt);
    resumedFromIntent = true;
  } else {
    assertCreatedLive(receipt.created, rpc, 'deployment receipt');
  }
} else if (existsSync(BROADCAST_PATH)) {
  fail('an unattributed live deployment broadcast file exists without a pre-broadcast receipt; refusing to infer its source commit or deploy again');
}

if (!receipt) {
  const manifestBefore = JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf8'));
  if (['DEPLOYED', 'VERIFIED'].includes(manifestBefore.status)) {
    fail('deployment manifest is already deployed/verified but no local deployment receipt exists');
  }

  run(process.execPath, ['scripts/day9/preflight-bread-arc-testnet-deployment.mjs', '--env-file', secretFile], {
    cwd: ROOT,
    timeout: 300_000,
    secrets,
  });
  env = parseEnv(secretFile);

  const sourceCommit = run('git', ['rev-parse', 'HEAD']);
  const deploymentStartBlock = Number(run('cast', ['block-number', '--rpc-url', rpc]).split(/\s+/)[0]);
  receipt = {
    schema: 'bread://receipts/day9-arc-testnet-deployment-v1',
    phase: 'PREPARED',
    chainId: plan.chainId,
    sourceCommit,
    deploymentStartBlock,
    created: null,
    hashes: null,
    transactionHashes: [],
    productionMoneyClaim: false,
    verified: false,
  };
  writeJson0600(receiptFile, receipt);

  run('forge', [
    'script',
    'script/DeployDay5Graduation.s.sol:DeployDay5Graduation',
    '--broadcast',
    '--rpc-url',
    rpc,
    '--non-interactive',
    '-vv',
  ], {
    cwd: CONTRACTS,
    timeout: 300_000,
    env,
    secrets,
  });
  broadcastPerformed = true;

  if (!existsSync(BROADCAST_PATH)) fail(`Foundry broadcast file missing at ${BROADCAST_PATH}`);
  const broadcast = JSON.parse(readFileSync(BROADCAST_PATH, 'utf8'));
  const created = createdFromBroadcast(broadcast);
  assertCreatedLive(created, rpc, 'newly deployed stack');

  const adapterConfigHash = normalizeHash(
    run('cast', ['call', created.adapter, 'configHash()(bytes32)', '--rpc-url', rpc]),
    'adapter configHash',
  );

  receipt = {
    ...receipt,
    phase: 'BROADCASTED',
    created,
    hashes: {
      adapterConfigHash,
      economicsConfigHash: requireValue(env, 'BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED'),
      dexEvidenceHash: requireValue(env, 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED'),
    },
    transactionHashes: transactionHashes(broadcast),
    recoveredFromPreparedIntent: false,
  };
  writeJson0600(receiptFile, receipt);
}

const deployedManifest = buildArcTestnetDeploymentManifest({
  plan,
  created: receipt.created,
  hashes: receipt.hashes,
  deploymentStartBlock: receipt.deploymentStartBlock,
  status: 'DEPLOYED',
});
writeManifest(deployedManifest);

const validationEnv = { ...env, ARC_RPC_URL: rpc, BREAD_RPC_URL: rpc };
run(process.execPath, ['scripts/day5/configure-graduation.mjs', 'arc-testnet'], {
  cwd: ROOT,
  env: validationEnv,
  secrets,
});
run(process.execPath, ['scripts/day5/verify-graduation-deployment.mjs', 'arc-testnet'], {
  cwd: ROOT,
  env: validationEnv,
  timeout: 240_000,
  secrets,
});

const verifiedManifest = buildArcTestnetDeploymentManifest({
  plan,
  created: receipt.created,
  hashes: receipt.hashes,
  deploymentStartBlock: receipt.deploymentStartBlock,
  status: 'VERIFIED',
});
writeManifest(verifiedManifest);

Object.assign(env, {
  BREAD_FACTORY: receipt.created.factory,
  BREAD_GRADUATION_COORDINATOR: receipt.created.coordinator,
  BREAD_PERMANENT_LIQUIDITY_LOCKER: receipt.created.locker,
  BREAD_SMOKE_PRIVATE_KEY: requireValue(env, 'BREAD_DEPLOYER_PRIVATE_KEY'),
  BREAD_SMOKE_OPERATOR: deploymentAuthority,
  BREAD_SMOKE_CREATOR_TAX_BPS: plan.economics.maxCreatorTaxBps,
  BREAD_SMOKE_QUOTE_IN: plan.smoke.quoteIn,
  BREAD_SMOKE_MIN_TOKENS_OUT: '1',
});
writeFileSync(secretFile, renderSecretEnv(env), { encoding: 'utf8', mode: 0o600 });
chmodSync(secretFile, 0o600);

receipt = {
  ...receipt,
  phase: 'VERIFIED',
  verified: true,
  verifiedAtBlock: Number(run('cast', ['block-number', '--rpc-url', rpc]).split(/\s+/)[0]),
};
writeJson0600(receiptFile, receipt);

console.log(JSON.stringify({
  status: 'BREAD_ARC_TESTNET_DEPLOYMENT_VERIFY_PASS',
  chainId: plan.chainId,
  sourceCommit: receipt.sourceCommit,
  deploymentStartBlock: receipt.deploymentStartBlock,
  created: receipt.created,
  adapterConfigHash: receipt.hashes.adapterConfigHash,
  economicsConfigHash: receipt.hashes.economicsConfigHash,
  dexEvidenceHash: receipt.hashes.dexEvidenceHash,
  protocolAdminSafe: plan.protocolAdmin,
  guardian: plan.guardian,
  v3Factory: plan.dex.factory,
  positionManager: plan.dex.positionManager,
  v3Fee: plan.dex.fee,
  transactionHashes: receipt.transactionHashes,
  broadcastPerformed,
  resumedFromIntent,
  manifestStatus: 'VERIFIED',
  productionMoneyClaim: false,
  productionAuthorityClaim: false,
  privateKeysPrinted: false,
  receiptFile,
  nextAction: 'RUN_BREAD_ARC_TESTNET_SMOKE',
}, null, 2));
