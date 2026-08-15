import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { renderSecretEnv, validateAuthoritySet } from './arc-safe-bootstrap-lib.mjs';
import { buildArcTestnetDeploymentPlan } from './arc-testnet-deployment-preflight-lib.mjs';

const ROOT = process.cwd();
const CONTRACTS = join(ROOT, 'contracts');
const DEFAULT_SECRET_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe.env');
const NETWORK_PATH = join(ROOT, 'config', 'networks', 'arc-testnet.json');
const DEPLOYMENT_PATH = join(ROOT, 'config', 'deployments', 'arc-testnet.day5.json');
const INVENTORY_PATH = join(ROOT, 'config', 'protocol', 'day5-dex-source-inventory.json');

function fail(message) {
  console.error(`day9-bread-arc-preflight: FAIL: ${message}`);
  process.exit(1);
}

function secretFilePath() {
  const index = process.argv.indexOf('--env-file');
  if (index === -1) return DEFAULT_SECRET_FILE;
  if (!process.argv[index + 1]) fail('--env-file requires a path');
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
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 120_000,
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

function normalizeAddress(value, label) {
  const match = String(value).match(/0x[0-9a-fA-F]{40}/);
  if (!match) fail(`${label} did not produce an EVM address: ${value}`);
  return match[0].toLowerCase();
}

function normalizeHash(value, label) {
  const match = String(value).match(/0x[0-9a-fA-F]{64}/);
  if (!match) fail(`${label} did not produce a bytes32 hash: ${value}`);
  return match[0].toLowerCase();
}

function parseUint(value, label) {
  const match = String(value).match(/\d+/);
  if (!match) fail(`${label} did not produce a uint: ${value}`);
  return BigInt(match[0]);
}

function codeBytes(code) {
  if (!/^0x[0-9a-fA-F]*$/.test(code)) fail(`unexpected eth_getCode response: ${code}`);
  return Math.max(0, (code.length - 2) / 2);
}

function requireCode(rpc, address, label) {
  const code = run('cast', ['code', address, '--rpc-url', rpc]);
  const bytes = codeBytes(code);
  if (bytes === 0) fail(`${label} has no runtime code on Arc Testnet`);
  return bytes;
}

function keccakText(value) {
  return normalizeHash(run('cast', ['keccak', value]), `keccak(${value})`);
}

function economicsHash(plan, stackVersion) {
  const encoded = run('cast', [
    'abi-encode',
    'f(address,uint256,uint256,uint256,uint256,address,uint16,uint16,uint16,bytes32)',
    plan.usdc,
    plan.economics.supply,
    plan.economics.phantomQuote,
    plan.economics.graduationThreshold,
    plan.economics.launchFeeUsdc,
    plan.protocolFeeRecipient,
    plan.economics.tradeFeeBps,
    plan.economics.protocolFeeShareBps,
    plan.economics.maxCreatorTaxBps,
    stackVersion,
  ]);
  return normalizeHash(run('cast', ['keccak', encoded]), 'economicsConfigHash');
}

function dexEvidenceHash(plan) {
  const canonicalEvidence = [
    plan.dexEvidenceLabel,
    `chainId=${plan.chainId}`,
    `usdc=${plan.usdc.toLowerCase()}`,
    `positionManager=${plan.dex.positionManager.toLowerCase()}`,
    `factory=${plan.dex.factory.toLowerCase()}`,
    `fee=${plan.dex.fee}`,
    `forkBlock=${plan.forkEvidenceBlock}`,
  ].join('|');
  return keccakText(canonicalEvidence);
}

const secretFile = secretFilePath();
if (resolve(secretFile).startsWith(`${resolve(ROOT)}/`)) {
  fail('authority secret file must remain outside the repository');
}
const permissions = statSync(secretFile).mode & 0o777;
if ((permissions & 0o077) !== 0) {
  fail(`authority file permissions are too broad: ${permissions.toString(8)} (expected 600-like)`);
}

const env = parseEnv(secretFile);
const rpc = requireValue(env, 'ARC_RPC_URL');
const deploymentAuthority = requireValue(env, 'BREAD_DEPLOYMENT_AUTHORITY');
const guardian = requireValue(env, 'BREAD_GUARDIAN');
const safe = requireValue(env, 'BREAD_DAY9_SAFE_ADDRESS');
const owners = [
  requireValue(env, 'BREAD_SAFE_OWNER_1'),
  requireValue(env, 'BREAD_SAFE_OWNER_2'),
  requireValue(env, 'BREAD_SAFE_OWNER_3'),
];
const deployerPrivateKey = requireValue(env, 'BREAD_DEPLOYER_PRIVATE_KEY');
const secrets = [
  deployerPrivateKey,
  env.BREAD_SAFE_OWNER_1_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_2_PRIVATE_KEY,
  env.BREAD_SAFE_OWNER_3_PRIVATE_KEY,
  env.BREAD_GUARDIAN_PRIVATE_KEY,
].filter(Boolean);

validateAuthoritySet({ deployer: deploymentAuthority, guardian, owners });
if (requireValue(env, 'BREAD_PROTOCOL_ADMIN').toLowerCase() !== safe.toLowerCase()) {
  fail('BREAD_PROTOCOL_ADMIN must equal the verified Day-9 Safe');
}
if (requireValue(env, 'BREAD_PROTOCOL_FEE_RECIPIENT').toLowerCase() !== safe.toLowerCase()) {
  fail('testnet protocol fee recipient must equal the verified Day-9 Safe');
}

const derivedDeployer = normalizeAddress(
  run('cast', ['wallet', 'address', '--private-key', deployerPrivateKey], { secrets }),
  'deployment private key',
);
if (derivedDeployer !== deploymentAuthority.toLowerCase()) {
  fail('BREAD_DEPLOYER_PRIVATE_KEY does not match BREAD_DEPLOYMENT_AUTHORITY');
}

const network = JSON.parse(readFileSync(NETWORK_PATH, 'utf8'));
const deployment = JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf8'));
const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));

if (['DEPLOYED', 'VERIFIED'].includes(deployment.status)) {
  fail('Arc Testnet Bread deployment manifest is already deployed/verified; refusing a second deployment');
}

const plan = buildArcTestnetDeploymentPlan({
  network,
  authority: { deploymentAuthority, guardian, safe, owners },
});

const v3Evidence = inventory?.uniswapV3?.arcDeployment;
if (v3Evidence?.realDependencyForkProof?.status !== 'PASS') {
  fail('real-dependency V3 fork evidence is not PASS in the source inventory');
}
if (Number(v3Evidence.realDependencyForkProof.forkBlock) !== plan.forkEvidenceBlock) {
  fail('source-inventory fork block does not match the preflight evidence plan');
}
if (Number(v3Evidence.realDependencyForkProof.fee) !== plan.dex.fee) {
  fail('source-inventory V3 fee does not match the preflight evidence plan');
}
if (String(v3Evidence.factory).toLowerCase() !== plan.dex.factory.toLowerCase()) {
  fail('source-inventory V3 Factory does not match the network manifest');
}
if (String(v3Evidence.positionManager).toLowerCase() !== plan.dex.positionManager.toLowerCase()) {
  fail('source-inventory Position Manager does not match the network manifest');
}

const chainId = Number(run('cast', ['chain-id', '--rpc-url', rpc]).split(/\s+/)[0]);
if (chainId !== plan.chainId) fail(`RPC chain ID mismatch: ${chainId}`);

const usdcCodeBytes = requireCode(rpc, plan.usdc, 'canonical USDC');
const factoryCodeBytes = requireCode(rpc, plan.dex.factory, 'V3 Factory');
const positionManagerCodeBytes = requireCode(rpc, plan.dex.positionManager, 'V3 Position Manager');
const safeCodeBytes = requireCode(rpc, safe, 'Protocol Admin Safe');

const decimals = Number(parseUint(run('cast', ['call', plan.usdc, 'decimals()(uint8)', '--rpc-url', rpc]), 'USDC decimals'));
if (decimals !== 6) fail(`canonical USDC decimals mismatch: ${decimals}`);

const pmFactory = normalizeAddress(
  run('cast', ['call', plan.dex.positionManager, 'factory()(address)', '--rpc-url', rpc]),
  'Position Manager factory',
);
if (pmFactory !== plan.dex.factory.toLowerCase()) fail('Position Manager Factory identity mismatch');

const tickSpacing = Number(parseUint(
  run('cast', ['call', plan.dex.factory, 'feeAmountTickSpacing(uint24)(int24)', String(plan.dex.fee), '--rpc-url', rpc]),
  'V3 tick spacing',
));
if (tickSpacing <= 0) fail(`V3 fee ${plan.dex.fee} is not enabled`);

const safeVersion = run('cast', ['call', safe, 'VERSION()(string)', '--rpc-url', rpc]);
if (!safeVersion.includes('1.4.1')) fail(`unexpected Safe version: ${safeVersion}`);
const threshold = Number(parseUint(run('cast', ['call', safe, 'getThreshold()(uint256)', '--rpc-url', rpc]), 'Safe threshold'));
if (threshold !== 2) fail(`Safe threshold must be 2, got ${threshold}`);
const ownersRaw = run('cast', ['call', safe, 'getOwners()(address[])', '--rpc-url', rpc]);
const actualOwners = [...ownersRaw.matchAll(/0x[0-9a-fA-F]{40}/g)].map((match) => match[0].toLowerCase());
if (actualOwners.length !== 3) fail(`Safe owner count must be 3: ${ownersRaw}`);
const actualOwnerSet = new Set(actualOwners);
for (const owner of owners.map((value) => value.toLowerCase())) {
  if (!actualOwnerSet.has(owner)) fail(`Safe is missing expected owner ${owner}`);
}

const deployerBalance = parseUint(run('cast', ['balance', deploymentAuthority, '--rpc-url', rpc]), 'deployment authority balance');
if (deployerBalance === 0n) fail('deployment authority has zero Arc Testnet native gas balance');

const stackVersion = keccakText(plan.stackVersionLabel);
const evidenceHash = dexEvidenceHash(plan);
const economicsConfigHash = economicsHash(plan, stackVersion);

Object.assign(env, {
  BREAD_CHAIN_ID: String(plan.chainId),
  BREAD_USDC: plan.usdc,
  BREAD_PROTOCOL_ADMIN: plan.protocolAdmin,
  BREAD_GUARDIAN: plan.guardian,
  BREAD_PROTOCOL_FEE_RECIPIENT: plan.protocolFeeRecipient,
  BREAD_V3_POSITION_MANAGER: plan.dex.positionManager,
  BREAD_V3_FACTORY: plan.dex.factory,
  BREAD_V3_FEE: String(plan.dex.fee),
  BREAD_SUPPLY: plan.economics.supply,
  BREAD_PHANTOM_QUOTE: plan.economics.phantomQuote,
  BREAD_GRADUATION_THRESHOLD: plan.economics.graduationThreshold,
  BREAD_LAUNCH_FEE_USDC: plan.economics.launchFeeUsdc,
  BREAD_TRADE_FEE_BPS: plan.economics.tradeFeeBps,
  BREAD_PROTOCOL_FEE_SHARE_BPS: plan.economics.protocolFeeShareBps,
  BREAD_MAX_CREATOR_TAX_BPS: plan.economics.maxCreatorTaxBps,
  BREAD_STACK_VERSION: stackVersion,
  BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED: economicsConfigHash,
  ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED: evidenceHash,
  BREAD_DAY9_TESTNET_STACK_VERSION_LABEL: plan.stackVersionLabel,
  BREAD_DAY9_TESTNET_DEX_EVIDENCE_LABEL: plan.dexEvidenceLabel,
  BREAD_DAY9_TESTNET_PRODUCTION_MONEY_CLAIM: 'false',
});
writeFileSync(secretFile, renderSecretEnv(env), { encoding: 'utf8', mode: 0o600 });
chmodSync(secretFile, 0o600);

run('forge', [
  'script',
  'script/DeployDay5Graduation.s.sol:DeployDay5Graduation',
  '--rpc-url',
  rpc,
  '--non-interactive',
  '-vv',
], {
  cwd: CONTRACTS,
  timeout: 240_000,
  env,
  secrets,
});

console.log(JSON.stringify({
  status: 'BREAD_ARC_TESTNET_DEPLOYMENT_PREFLIGHT_PASS',
  chainId: plan.chainId,
  deploymentAuthority,
  deploymentAuthorityNativeBalanceWei: deployerBalance.toString(),
  protocolAdminSafe: safe,
  safeVersion: '1.4.1',
  safeThreshold: threshold,
  safeOwners: actualOwners,
  guardian,
  canonicalUsdc: plan.usdc,
  usdcCodeBytes,
  usdcDecimals: decimals,
  dexFamily: plan.dex.family,
  v3Factory: plan.dex.factory,
  factoryCodeBytes,
  positionManager: plan.dex.positionManager,
  positionManagerCodeBytes,
  v3Fee: plan.dex.fee,
  tickSpacing,
  forkEvidenceBlock: plan.forkEvidenceBlock,
  stackVersion,
  economicsConfigHash,
  dexEvidenceHash: evidenceHash,
  testnetEconomics: plan.economics,
  productionMoneyClaim: false,
  productionAuthorityClaim: false,
  transactionBroadcast: false,
  privateKeysPrinted: false,
  nextAction: 'RUN_BREAD_ARC_TESTNET_DEPLOYMENT',
}, null, 2));
