import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MODE = process.env.BREAD_DAY9_MODE;
if (MODE !== 'CONTROLLED_FIXTURE') {
  throw new Error('clean local rehearsal requires BREAD_DAY9_MODE=CONTROLLED_FIXTURE');
}

// Public Anvil development key from Foundry documentation. Never use on a public network.
const TEST_ONLY_ANVIL_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ONLY_GUARDIAN = '0x000000000000000000000000000000000000bEEF';
const RPC = 'http://127.0.0.1:18547';
const CHAIN_ID = '5042002';
const SUPPLY = '1000000000000000000000000';
const PHANTOM_QUOTE = '10000000000';
const GRADUATION_THRESHOLD = '100000000000';
const LAUNCH_FEE_USDC = '0';
const TRADE_FEE_BPS = '100';
const PROTOCOL_FEE_SHARE_BPS = '2500';
const MAX_CREATOR_TAX_BPS = '500';
const V3_FEE = '3000';
const SMOKE_QUOTE_IN = '110000000000';
const SMOKE_FUNDING = '200000000000';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 120_000,
    input: options.input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with status ${result.status}`,
      result.stdout ?? '',
      result.stderr ?? '',
    ].join('\n'));
  }
  return (result.stdout ?? '').trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForRpc(processHandle) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processHandle.exitCode !== null) {
      throw new Error(`Anvil exited before readiness with code ${processHandle.exitCode}`);
    }
    const result = spawnSync('cast', ['chain-id', '--rpc-url', RPC], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim() === CHAIN_ID) return;
    await sleep(100);
  }
  throw new Error('temporary Anvil chain did not become ready');
}

function archiveCurrentHead(destination) {
  const archive = spawnSync('git', ['archive', '--format=tar', 'HEAD'], {
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (archive.status !== 0 || !archive.stdout) {
    throw new Error(`git archive failed: ${archive.stderr?.toString() ?? ''}`);
  }
  run('tar', ['-xf', '-', '-C', destination], { input: archive.stdout });
}

function broadcastJson(root, scriptName) {
  const path = join(root, 'contracts', 'broadcast', scriptName, CHAIN_ID, 'run-latest.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function createdAddress(broadcast, contractName) {
  const tx = broadcast.transactions?.find((item) =>
    item.transactionType === 'CREATE'
      && item.contractName === contractName
      && typeof item.contractAddress === 'string'
  );
  if (!tx?.contractAddress) throw new Error(`missing CREATE address for ${contractName}`);
  return tx.contractAddress;
}

function keccakText(value) {
  return run('cast', ['keccak', value]).split(/\s+/).at(-1);
}

function economicsHash(input) {
  const encoded = run('cast', [
    'abi-encode',
    'f(address,uint256,uint256,uint256,uint256,address,uint16,uint16,uint16,bytes32)',
    input.usdc,
    SUPPLY,
    PHANTOM_QUOTE,
    GRADUATION_THRESHOLD,
    LAUNCH_FEE_USDC,
    input.protocolFeeRecipient,
    TRADE_FEE_BPS,
    PROTOCOL_FEE_SHARE_BPS,
    MAX_CREATOR_TAX_BPS,
    input.stackVersion,
  ]);
  return run('cast', ['keccak', encoded]).split(/\s+/).at(-1);
}

const root = mkdtempSync(join(tmpdir(), 'bread-day9-rehearsal-'));
const anvil = spawn('anvil', ['--silent', '--port', '18547', '--chain-id', CHAIN_ID], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let anvilStderr = '';
anvil.stderr.on('data', (chunk) => { anvilStderr += chunk.toString(); });

try {
  await waitForRpc(anvil);
  archiveCurrentHead(root);

  const contracts = join(root, 'contracts');
  const deployer = run('cast', ['wallet', 'address', '--private-key', TEST_ONLY_ANVIL_KEY]).split(/\s+/).at(-1);
  if (!deployer) throw new Error('could not derive test-only Anvil deployer');

  run('forge', [
    'script',
    'script/rehearsal/DeployDay9ControlledDependencies.s.sol:DeployDay9ControlledDependencies',
    '--broadcast',
    '--rpc-url', RPC,
    '--non-interactive',
  ], {
    cwd: contracts,
    env: { BREAD_DEPLOYER_PRIVATE_KEY: TEST_ONLY_ANVIL_KEY },
  });

  const dependencyBroadcast = broadcastJson(root, 'DeployDay9ControlledDependencies.s.sol');
  const usdc = createdAddress(dependencyBroadcast, 'Day9RehearsalUSDC6');
  const protocolAdmin = createdAddress(dependencyBroadcast, 'Day9ProtocolAdminHarness');
  const v3Factory = createdAddress(dependencyBroadcast, 'Day9RehearsalV3Factory');
  const positionManager = createdAddress(dependencyBroadcast, 'Day9RehearsalV3PositionManager');

  const stackVersion = keccakText('BREAD_DAY9_CONTROLLED_STACK_V1');
  const dexEvidenceHash = keccakText('BREAD_DAY9_CONTROLLED_V3_FIXTURE_ONLY');
  if (!stackVersion || !dexEvidenceHash) throw new Error('could not derive rehearsal hashes');
  const economicsConfigHash = economicsHash({ usdc, protocolFeeRecipient: deployer, stackVersion });
  if (!economicsConfigHash) throw new Error('could not derive rehearsal economics hash');

  const productionEnv = {
    BREAD_DEPLOYER_PRIVATE_KEY: TEST_ONLY_ANVIL_KEY,
    BREAD_DEPLOYMENT_AUTHORITY: deployer,
    BREAD_PROTOCOL_ADMIN: protocolAdmin,
    BREAD_GUARDIAN: TEST_ONLY_GUARDIAN,
    BREAD_USDC: usdc,
    BREAD_PROTOCOL_FEE_RECIPIENT: deployer,
    BREAD_V3_POSITION_MANAGER: positionManager,
    BREAD_V3_FACTORY: v3Factory,
    BREAD_SUPPLY: SUPPLY,
    BREAD_PHANTOM_QUOTE: PHANTOM_QUOTE,
    BREAD_GRADUATION_THRESHOLD: GRADUATION_THRESHOLD,
    BREAD_LAUNCH_FEE_USDC: LAUNCH_FEE_USDC,
    BREAD_TRADE_FEE_BPS: TRADE_FEE_BPS,
    BREAD_PROTOCOL_FEE_SHARE_BPS: PROTOCOL_FEE_SHARE_BPS,
    BREAD_MAX_CREATOR_TAX_BPS: MAX_CREATOR_TAX_BPS,
    BREAD_V3_FEE: V3_FEE,
    BREAD_STACK_VERSION: stackVersion,
    BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED: economicsConfigHash,
    ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED: dexEvidenceHash,
  };

  // This is the real Bread Day-5 production deployment script, pointed only at the temporary local chain.
  run('forge', [
    'script',
    'script/DeployDay5Graduation.s.sol:DeployDay5Graduation',
    '--broadcast',
    '--rpc-url', RPC,
    '--non-interactive',
  ], { cwd: contracts, env: productionEnv, timeout: 180_000 });

  const breadBroadcast = broadcastJson(root, 'DeployDay5Graduation.s.sol');
  const core = {
    feePolicy: createdAddress(breadBroadcast, 'BreadFeePolicy'),
    feeEscrow: createdAddress(breadBroadcast, 'BreadFeeEscrow'),
    emergencyController: createdAddress(breadBroadcast, 'BreadEmergencyController'),
    factory: createdAddress(breadBroadcast, 'BreadLaunchFactory'),
    deployer: createdAddress(breadBroadcast, 'BreadLaunchDeployer'),
    locker: createdAddress(breadBroadcast, 'BreadPermanentLiquidityLocker'),
    coordinator: createdAddress(breadBroadcast, 'GraduationCoordinator'),
  };
  const adapter = createdAddress(breadBroadcast, 'BreadV3GraduationAdapter');
  const adapterConfigHash = run('cast', [
    'call', adapter, 'configHash()(bytes32)', '--rpc-url', RPC,
  ]).split(/\s+/).at(-1);
  if (!adapterConfigHash) throw new Error('adapter config hash read failed');

  // Overlay only the archived temporary copy. Canonical repository manifests are never edited.
  const networkPath = join(root, 'config', 'networks', 'arc-testnet.json');
  const deploymentPath = join(root, 'config', 'deployments', 'arc-testnet.day5.json');
  const network = JSON.parse(readFileSync(networkPath, 'utf8'));
  network.rpc = [RPC];
  network.websocket = [];
  network.dex = {
    type: 'UNISWAP_V3',
    poolManager: null,
    positionManager,
    factory: v3Factory,
  };
  writeFileSync(networkPath, `${JSON.stringify(network, null, 2)}\n`);

  const deployment = JSON.parse(readFileSync(deploymentPath, 'utf8'));
  deployment.status = 'DEPLOYED';
  deployment.core = core;
  deployment.adapter = {
    active: true,
    family: 'UNISWAP_V3',
    adapter,
    positionManager,
    poolManager: null,
    v3Factory,
    configHash: adapterConfigHash,
  };
  deployment.authorities = { protocolAdmin, guardian: TEST_ONLY_GUARDIAN };
  deployment.economicsConfigHash = economicsConfigHash;
  deployment.dexEvidenceHash = dexEvidenceHash;
  deployment.deploymentStartBlock = Number(run('cast', ['block-number', '--rpc-url', RPC]));
  writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);

  const validationEnv = {
    ...productionEnv,
    ARC_RPC_URL: RPC,
    BREAD_RPC_URL: RPC,
  };
  run(process.execPath, ['scripts/day5/configure-graduation.mjs', 'arc-testnet'], {
    cwd: root,
    env: validationEnv,
  });
  run(process.execPath, ['scripts/day5/verify-graduation-deployment.mjs', 'arc-testnet'], {
    cwd: root,
    env: validationEnv,
  });

  run('cast', [
    'send', usdc, 'mint(address,uint256)', deployer, SMOKE_FUNDING,
    '--private-key', TEST_ONLY_ANVIL_KEY,
    '--rpc-url', RPC,
  ]);

  run(process.execPath, ['scripts/day5/smoke-graduation.mjs', 'arc-testnet'], {
    cwd: root,
    timeout: 180_000,
    env: {
      ...validationEnv,
      BREAD_SMOKE_PRIVATE_KEY: TEST_ONLY_ANVIL_KEY,
      BREAD_SMOKE_OPERATOR: deployer,
      BREAD_SMOKE_CREATOR_TAX_BPS: MAX_CREATOR_TAX_BPS,
      BREAD_SMOKE_QUOTE_IN: SMOKE_QUOTE_IN,
      BREAD_SMOKE_MIN_TOKENS_OUT: '1',
    },
  });

  console.log('DAY9_CLEAN_LOCAL_REHEARSAL_PASS');
  console.log('CANONICAL_ARC_DEPLOYMENT_CLAIM=false');
  console.log('PRODUCTION_ECONOMICS_CLAIM=false');
} catch (error) {
  if (anvilStderr.trim()) console.error(anvilStderr.trim());
  throw error;
} finally {
  if (anvil.exitCode === null) anvil.kill('SIGTERM');
  rmSync(root, { recursive: true, force: true });
}
