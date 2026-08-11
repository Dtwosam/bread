import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const network = JSON.parse(readFileSync(join(root, 'config/networks/arc-testnet.json'), 'utf8'));
const toolchain = JSON.parse(readFileSync(join(root, 'config/toolchain/versions.json'), 'utf8'));

const EXPECTED_CHAIN_ID = 5_042_002;
const TEST_ONLY_V3_FEE = 3_000;

function fail(message) {
  console.error(`day9-arc-v3-fork: FAIL: ${message}`);
  process.exit(1);
}

function probe(command, args = []) {
  return spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    timeout: 15_000,
  });
}

function requireFoundryTool(command) {
  const result = probe(command, ['--version']);
  if (result.error?.code === 'ENOENT') {
    fail(`${command} is not installed or not on PATH; Bread requires Foundry ${toolchain.foundry}. Install the pinned Foundry toolchain, then rerun this proof.`);
  }
  if (result.error) fail(`${command} preflight failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} --version exited ${result.status}: ${result.stderr ?? result.stdout ?? ''}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
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

requireFoundryTool('cast');
requireFoundryTool('forge');

if (network.chainId !== EXPECTED_CHAIN_ID) fail(`manifest chainId must be ${EXPECTED_CHAIN_ID}`);
if (network.dex?.type !== 'UNISWAP_V3') fail('Arc Testnet manifest must select UNISWAP_V3');
if (!network.usdc?.address || !network.dex?.factory || !network.dex?.positionManager) {
  fail('Arc Testnet manifest is missing USDC / V3 Factory / Position Manager');
}
if (!Array.isArray(network.rpc) || !network.rpc[0]) fail('Arc Testnet manifest is missing RPC');

const rpcUrl = process.env.ARC_FORK_RPC_URL || network.rpc[0];
const usdc = network.usdc.address;
const factory = network.dex.factory;
const positionManager = network.dex.positionManager;

const chainId = Number(run('cast', ['chain-id', '--rpc-url', rpcUrl]).split(/\s+/)[0]);
if (chainId !== EXPECTED_CHAIN_ID) fail(`RPC chain ID mismatch: expected ${EXPECTED_CHAIN_ID}, got ${chainId}`);
const forkBlock = Number(run('cast', ['block-number', '--rpc-url', rpcUrl]).split(/\s+/)[0]);
if (!Number.isSafeInteger(forkBlock) || forkBlock <= 0) fail(`invalid fork block ${forkBlock}`);

run(process.execPath, [
  'scripts/day9/verify-v3-dex-candidate.mjs',
  '--rpc-url', rpcUrl,
  '--chain-id', String(EXPECTED_CHAIN_ID),
  '--usdc', usdc,
  '--factory', factory,
  '--position-manager', positionManager,
  '--fee', String(TEST_ONLY_V3_FEE),
]);

run('forge', [
  'test',
  '--match-path', 'test/fork/ArcV3DependencyFork.t.sol',
  '--match-test', 'testRealArcV3DependencyMintAndPermanentLock',
  '-vvv',
], {
  cwd: join(root, 'contracts'),
  timeout: 300_000,
  env: {
    ARC_FORK_RPC_URL: rpcUrl,
    ARC_FORK_BLOCK_NUMBER: String(forkBlock),
    BREAD_CHAIN_ID: String(EXPECTED_CHAIN_ID),
    BREAD_USDC: usdc,
    BREAD_V3_FACTORY: factory,
    BREAD_V3_POSITION_MANAGER: positionManager,
    BREAD_V3_FEE: String(TEST_ONLY_V3_FEE),
  },
});

console.log('DAY9_ARC_V3_FORK_PROOF_PASS');
console.log(JSON.stringify({
  chainId,
  forkBlock,
  factory,
  positionManager,
  usdc,
  v3Fee: TEST_ONLY_V3_FEE,
  arcNativeCoinAuthorityMode: 'FOUNDRY_FORK_TEST_SHIM_ONLY',
  liveTransactionBroadcast: false,
  privateKeyRequired: false,
  mainnetDexSelected: false,
}, null, 2));
