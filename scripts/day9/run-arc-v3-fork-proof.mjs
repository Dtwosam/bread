import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const network = JSON.parse(readFileSync(join(root, 'config/networks/arc-testnet.json'), 'utf8'));

const EXPECTED_CHAIN_ID = 5_042_002;
const TEST_ONLY_V3_FEE = 3_000;
const FORK_USDC_AMOUNT = 10_000_000n; // 10 USDC, fork-local only.
// Current Synthra Arc SYN token from Synthra's documented local-development example.
// This address is used only to discover an existing fork-state USDC holder; it is not a Bread dependency.
const SYNTHRA_SYN_DONOR_DISCOVERY_TOKEN = '0xC5124C846c6e6307986988dFb7e743327aA05F19';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function fail(message) {
  console.error(`day9-arc-v3-fork: FAIL: ${message}`);
  process.exit(1);
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

function parseAddress(value, label) {
  const match = String(value).match(/0x[0-9a-fA-F]{40}/);
  if (!match) fail(`${label} did not return an EVM address: ${value}`);
  return match[0];
}

function parseUint(value, label) {
  const match = String(value).match(/^\s*(\d+)/);
  if (!match) fail(`${label} did not return a uint: ${value}`);
  return BigInt(match[1]);
}

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

let forkUsdcDonor = null;
let donorFee = null;
let donorBalance = 0n;
for (const fee of [3_000, 500, 100, 10_000]) {
  const poolRaw = run('cast', [
    'call', factory, 'getPool(address,address,uint24)(address)',
    usdc, SYNTHRA_SYN_DONOR_DISCOVERY_TOKEN, String(fee),
    '--rpc-url', rpcUrl,
    '--block', String(forkBlock),
  ]);
  const pool = parseAddress(poolRaw, `getPool fee ${fee}`);
  if (pool.toLowerCase() === ZERO_ADDRESS) continue;

  const balanceRaw = run('cast', [
    'call', usdc, 'balanceOf(address)(uint256)', pool,
    '--rpc-url', rpcUrl,
    '--block', String(forkBlock),
  ]);
  const balance = parseUint(balanceRaw, `USDC balance for pool ${pool}`);
  if (balance >= FORK_USDC_AMOUNT) {
    forkUsdcDonor = pool;
    donorFee = fee;
    donorBalance = balance;
    break;
  }
}

if (!forkUsdcDonor) {
  fail('could not find a Synthra SYN/USDC pool with at least 10 forked USDC for local-only funding');
}

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
    BREAD_FORK_USDC_DONOR: forkUsdcDonor,
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
  forkUsdcDonor,
  donorPoolFee: donorFee,
  donorUsdcBalance: donorBalance.toString(),
  liveTransactionBroadcast: false,
  privateKeyRequired: false,
  mainnetDexSelected: false,
}, null, 2));
